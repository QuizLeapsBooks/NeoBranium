import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
// HYPERREAL API INTEGRATION - Removed @google/generative-ai import
import session from 'express-session';
import RedisStore from 'connect-redis';
import { createClient } from 'redis';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Redis client for session storage
const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Connect to Redis
try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');
} catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    process.exit(1); // Exit if Redis fails
}

// Redis store for sessions
const redisStore = new RedisStore({
    client: redisClient,
    prefix: "sess:"
});

// Session middleware
app.use(session({
    store: redisStore,
    secret: process.env.SESSION_SECRET || 'neobranium_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://esm.run"],
            connectSrc: ["'self'", "https://generativelanguage.googleapis.com"]
        }
    }
}));

// CORS configuration
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:5500', 'http://localhost:5501', 'http://127.0.0.1:5500', 'http://127.0.0.1:5501'];

app.use(cors({
    origin: process.env.NODE_ENV === 'production'
        ? ['https://yourdomain.com', 'https://your-backend-url.onrender.com']
        : allowedOrigins,
}));

app.use(express.json({ limit: '10mb' }));

// GROQ API INTEGRATION - Initialize Groq API key
const groqApiKey = process.env.GROQ_API_KEY;
if (!groqApiKey) {
  console.error('❌ Missing GROQ_API_KEY in environment');
  // Optionally process.exit(1) in non-dev environment,
  // but if you want server to start and fail per-request, keep going.
}

// GROQ API INTEGRATION - Define model constant
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// In-memory user memory
const userMemory = new Map();

// Helper functions
const detectQueryType = (text) => {
    const patterns = {
        code: /write|code|programming|python|javascript|java|function|class|html|css/i,
        math: /math|algebra|calculus|geometry|equation|solve|calculate/i,
        science: /science|physics|chemistry|biology|experiment|lab|formula/i,
        study: /study|learn|tips|technique|remember|understand|explain/i
    };

    for (const [type, pattern] of Object.entries(patterns)) {
        if (pattern.test(text)) return type;
    }
    return 'general';
};

const formatResponse = (text, queryType) => {
    if (queryType === 'code' && !text.includes('```')) {
        return `\`\`\`\n${text}\n\`\`\``;
    }
    return text;
};

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    console.log('📨 Incoming chat request:', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.body
    });

    try {
        const { message, history = [], userId = 'default' } = req.body;

        if (!message?.trim()) {
            return res.status(400).json({
                reply: 'Please provide a message.'
            });
        }

        // Get or create user memory
        if (!userMemory.has(userId)) {
            userMemory.set(userId, {
                name: null,
                topics: new Set(),
                preferences: {},
                sessionStart: new Date(),
                messageCount: 0
            });
        }

        const memory = userMemory.get(userId);
        memory.messageCount++;

        // Detect name if mentioned
        const nameMatch = message.match(/my name is (\w+)|i am (\w+)|call me (\w+)/i);
        if (nameMatch) {
            memory.name = nameMatch[1] || nameMatch[2] || nameMatch[3];
        }

        // Track topics
        const queryType = detectQueryType(message);
        memory.topics.add(queryType);

        // Build system prompt
        const systemIdentity = `You are NS-x AI Learning Assistant from the NeoBranium platform. NeoBranium is a learning platform focused on science, mathematics, programming, quizzes, and study tools for students. NeoBranium was created by Shubham Singh, a student who enjoys science, mathematics, programming, and building educational tools for students. In all responses, act as a friendly private learning assistant and do not reveal private details (location, school, phone, email, personal life). If asked about who made you, who created you, who owns this AI, who is Shubham Singh, or what is NeoBranium, reply: "This AI assistant is part of the NeoBranium learning platform created by Shubham Singh. He is a student who enjoys science, mathematics, and programming and built this platform to help students learn more effectively."`; 

        const queryContext = queryType === 'code'
            ? 'You are a programming expert. Provide code examples with explanations.'
            : queryType === 'math' || queryType === 'science'
            ? 'You are a STEM expert. Explain concepts clearly with examples.'
            : 'You are a helpful learning assistant.';

        const personalContext = memory.name
            ? `The user's name is ${memory.name}. `
            : '';

        const historyContext = history
            .slice(-5)
            .map(h => `${h.role}: ${h.content}`)
            .join('\n');

        // GROQ API INTEGRATION - Build messages array
        const systemContent = `${systemIdentity} ${queryContext}`;
        const userContent = `${personalContext}User question: ${message}\n\nRespond in a helpful, educational manner. Use markdown for formatting.\nIf explaining code, always provide examples.\nBe encouraging and patient with learners.`;
        const messages = [
            { role: 'system', content: systemContent },
            ...history,
            { role: 'user', content: userContent }
        ];

        // Log request for debugging
        console.log('📤 Sending to Groq API:', {
            model: GROQ_MODEL,
            messagesCount: messages.length,
            messages: messages.map(m => ({ role: m.role, contentLength: m.content.length }))
        });

        // Prepare request body
        const requestBody = {
            model: GROQ_MODEL,
            messages: messages,
            temperature: 0.7,
            max_tokens: 4096
        };

        console.log("FINAL GROQ REQUEST:", JSON.stringify(requestBody, null, 2));

        // GROQ API INTEGRATION - Generate response via Groq API
        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('❌ Groq API error:', groqResponse.status, errorText);
            throw new Error(`Groq API failed: ${groqResponse.status} - ${errorText}`);
        }

        const groqData = await groqResponse.json();
        let text = groqData.choices[0].message.content;

        // Format and return
        text = formatResponse(text, queryType);

        console.log('✅ Chat response sent:', { reply: text.substring(0, 100) + '...' });

        res.json({
            reply: text
        });

    } catch (error) {
        console.error('❌ Chat request failed:', error);
        res.status(500).json({
            reply: 'AI request failed'
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV,
        redis: redisClient.isReady ? 'connected' : 'disconnected'
    });
});

// Statistics endpoint
app.get('/api/stats', (req, res) => {
    const stats = {
        activeUsers: userMemory.size,
        totalMessages: Array.from(userMemory.values())
            .reduce((acc, mem) => acc + mem.messageCount, 0),
        topicDistribution: Object.fromEntries(
            Array.from(userMemory.values())
                .flatMap(mem => Array.from(mem.topics))
                .reduce((acc, topic) => {
                    acc.set(topic, (acc.get(topic) || 0) + 1);
                    return acc;
                }, new Map())
        )
    };

    res.json(stats);
});

// Serve static files (HTML, CSS, JS, images, etc.)
app.use(express.static(path.join(__dirname)));

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, '../')));

    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, '../index.html'));
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server Error:', err);
    res.status(500).json({
        reply: 'Internal server error. Please try again later.'
    });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🔑 Groq Model: ${GROQ_MODEL}`);
});

const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);

redis.on('connect', () => console.log("Connected to Redis!"));
redis.on('error', err => console.log("Redis connection error:", err));