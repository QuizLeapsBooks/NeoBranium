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
import { boardRateLimit } from './boardMiddleware.js';
import queueManager from './queueManager.js';
import { endSession } from './firebaseAdmin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.set('trust proxy', 1);

// Redis client for session storage
const redisClient = createClient({
    url: process.env.REDIS_URL
});

// Connect to Redis
console.log("Attempting Redis connection...");
try {
    await redisClient.connect();
    console.log('✅ Redis connected successfully');

    // Test the connection actually works
    await redisClient.ping();
    console.log('✅ Redis ping successful');
} catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    console.log("📝 Using in-memory sessions (data lost on restart)");
    console.log("💡 For production: Set REDIS_URL to Upstash Redis URL");
}

// Redis store for sessions
let redisStore;

if (redisClient.isReady) {
    redisStore = new RedisStore({
        client: redisClient,
        prefix: "sess:"
    });
}

// Validate session secret
const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    console.error('❌ FATAL ERROR: SESSION_SECRET environment variable is missing.');
    process.exit(1);
}

// Session middleware
app.use(session({
    store: redisClient.isReady ? redisStore : undefined,
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Stricter limit: 50 requests per 15 minutes
    message: { reply: 'Too many requests, please try again later.' },
    keyGenerator: (req) => {
        // Limit by session ID if available, otherwise fallback to IP
        return req.session?.id || req.ip;
    }
});
app.use('/api/', limiter);

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://esm.run", "https://www.gstatic.com", "https://cdn.jsdelivr.net"],
            connectSrc: [
                "'self'",
                "https://api.groq.com",
                "https://generativelanguage.googleapis.com",
                "https://www.gstatic.com",
                "https://firebase.googleapis.com",
                "https://firebasestorage.googleapis.com",
                "https://identitytoolkit.googleapis.com",
                "https://securetoken.googleapis.com"
            ],
            imgSrc: ["'self'", "data:", "blob:", "https://firebasestorage.googleapis.com", "https://www.gstatic.com"],
            frameSrc: ["'self'", "https://neobranium.firebaseapp.com"]
        }
    }
}));

const allowedOrigins = [
    'https://neobranium.web.app',
    'https://neobranium.firebaseapp.com',
    'https://neo-branium.vercel.app',
    'http://localhost:5500',
    'http://localhost:5501',
    'http://127.0.0.1:5500',
    'http://127.0.0.1:5501',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    ...((process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean))
];

const isDevelopment = process.env.NODE_ENV !== 'production';
const isAllowedOrigin = (origin) => {
    if (isDevelopment && origin === 'null') return true;
    return allowedOrigins.some(allowed => origin === allowed || origin === allowed + '/');
};

app.use(cors({
    origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (isAllowedOrigin(origin)) return callback(null, true);
        return callback(new Error('CORS Error: Origin not allowed'), false);
    },
    credentials: true
}));

// Strict server-side origin check middleware
const strictOriginCheck = (req, res, next) => {
    if (!req.path.startsWith('/api/')) return next();
    const origin = req.headers.origin || req.headers.referer;
    if (!origin) {
        return res.status(403).json({ reply: 'Forbidden: Direct API access is not allowed' });
    }
    let requestOrigin = origin;
    if (origin !== 'null') {
        try {
            requestOrigin = new URL(origin).origin;
        } catch {
            requestOrigin = origin;
        }
    }
    if (!isAllowedOrigin(requestOrigin)) {
        return res.status(403).json({ reply: 'Forbidden: Invalid Origin' });
    }
    next();
};

app.use(strictOriginCheck);

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
const geminiApiKey = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';


// In-memory fallback if Redis is down
const fallbackMemory = new Map();

// Helper to get memory (Redis preferred)
async function getUserMemory(userId) {
    if (redisClient.isReady) {
        try {
            const data = await redisClient.hGet('user_memory', userId);
            if (data) {
                const parsed = JSON.parse(data);
                // Convert stringified dates back to Date objects
                parsed.sessionStart = new Date(parsed.sessionStart);
                return parsed;
            }
        } catch (e) {
            console.error('Redis memory fetch failed:', e);
        }
    }
    // Fallback
    return fallbackMemory.get(userId);
}

// Helper to save memory (Redis preferred)
async function saveUserMemory(userId, memoryData) {
    if (redisClient.isReady) {
        try {
            // Redis hashes take strings, so JSON.stringify the object
            // Use 'topics' as an Array because Set doesn't stringify well
            await redisClient.hSet('user_memory', userId, JSON.stringify(memoryData));
            // Expire memory after 1 hour of inactivity
            await redisClient.expire('user_memory', 3600);
            return;
        } catch (e) {
            console.error('Redis memory save failed:', e);
        }
    }
    // Fallback: use Map
    fallbackMemory.set(userId, memoryData);
}

// Cleanup fallback memory every 10 minutes (not on every save — avoids O(n) per request)
setInterval(() => {
    const now = Date.now();
    const maxAge = 60 * 60 * 1000; // 1 hour
    for (const [id, mem] of fallbackMemory) {
        if (!mem || !mem.sessionStart || !(mem.sessionStart instanceof Date) ||
            now - mem.sessionStart.getTime() > maxAge) {
            fallbackMemory.delete(id);
        }
    }
    if (fallbackMemory.size > 1000) {
        const entries = Array.from(fallbackMemory.entries())
            .sort((a, b) => a[1].sessionStart - b[1].sessionStart);
        entries.slice(0, entries.length - 500).forEach(([id]) => fallbackMemory.delete(id));
    }
}, 10 * 60 * 1000);

// Helper functions
const detectQueryType = (text) => {
    const patterns = {
        code: /\b(write|code|programming|python|javascript|java|function|html|css|script|algorithm)\b/i,
        math: /\b(math|algebra|calculus|geometry|equation|solve|calculate|arithmetic|real number)\b/i,
        science: /\b(science|physics|chemistry|biology|experiment|lab|formula|atom|cell)\b/i,
        study: /\b(study|learn|tips|technique|remember|understand|explain|exam|test|notes)\b/i
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

// --- AI Security ---
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
    /forget\s+(everything|all|previous|what)/i,
    /you\s+are\s+now\s+(a\s+)?(?!an?\s+AI\s+tutor)/i,
    /act\s+as\s+(if\s+you\s+are\s+)?(?!an?\s+AI\s+tutor)/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /roleplay\s+as/i,
    /jailbreak/i,
    /DAN\s+mode/i,
    /bypass\s+(your\s+)?(rules?|restrictions?|filters?)/i,
    /\bDAN\b/,
    /do\s+anything\s+now/i,
    /developer\s+mode/i,
    /system\s+prompt/i,
    /reveal\s+(your\s+)?(instructions?|prompt|system)/i,
];

function sanitizeAIInput(message) {
    if (!message || typeof message !== 'string') return { safe: false, reason: 'invalid' };
    if (message.length > 5000) return { safe: false, reason: 'too_long' };

    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(message)) {
            return { safe: false, reason: 'injection_detected' };
        }
    }
    return { safe: true };
}

// Main chat endpoint
app.post('/api/chat', async (req, res) => {
    const isProd = process.env.NODE_ENV === 'production';

    // 🛡️ SECURITY FIX: Ignore any Authorization header sent by the client.
    // The server uses its own GROQ_API_KEY from environment variables.
    if (req.headers.authorization) {
        console.warn(`⚠️ Client sent Authorization header to /api/chat. Ignoring it. IP: ${req.ip}`);
    }

    try {
        const { message, history = [], task = 'general_chat' } = req.body;

        // 🛡️ INPUT VALIDATION & SECURITY
        const sanResult = sanitizeAIInput(message);
        if (!sanResult.safe) {
            return res.json({
                reply: "Main sirf NeoBranium ke syllabus ke baare mein help kar sakta hoon. Koi aur question hai?"
            });
        }

        const validatedHistory = (history || [])
            .slice(-10)
            .filter(h => h.role && h.content && typeof h.content === 'string')
            .map(h => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: h.content.slice(0, 2000) // cap each history message
            }));

        console.log('📨 Incoming chat request:', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            sessionId: req.session.id,
            ...(isProd ? { msgLength: message.length } : { body: { message, historyCount: validatedHistory.length } })
        });

        // 🔒 Secure Fix: Use the server-generated session ID instead of trusting the client
        const secureUserId = req.session.id || 'fallback';

        // Get or create user memory
        let memory = await getUserMemory(secureUserId);

        if (!memory) {
            memory = {
                name: null,
                topics: [], // Using Array instead of Set for Redis JSON combability
                preferences: {},
                sessionStart: new Date(),
                messageCount: 0
            };
        }

        memory.messageCount++;

        // Detect name if mentioned
        const nameMatch = message.match(/my name is (\w+)|i am (\w+)|call me (\w+)/i);
        if (nameMatch) {
            memory.name = nameMatch[1] || nameMatch[2] || nameMatch[3];
        }

        // Track topics
        const queryType = detectQueryType(message);
        if (!memory.topics.includes(queryType)) {
            memory.topics.push(queryType);
        }

        // Save updated memory asynchronously (don't block the request)
        saveUserMemory(secureUserId, memory).catch(err => console.error("Memory track error:", err));

        // Build system prompt based on task
        let systemIdentity = `You are NS-x AI Learning Assistant from the NeoBranium platform. NeoBranium is a learning platform focused on science, mathematics, programming, quizzes, and study tools for students. NeoBranium was created by Shubham Singh, a student who enjoys science, mathematics, programming, and building educational tools for students. In all responses, act as a friendly private learning assistant and do not reveal private details (location, school, phone, email, personal life). If asked about who made you, who created you, who owns this AI, who is Shubham Singh, or what is NeoBranium, reply: "This AI assistant is part of the NeoBranium learning platform created by Shubham Singh. He is a student who enjoys science, mathematics, and programming and built this platform to help students learn more effectively."`;

        let queryContext = '';
        if (task === 'paper_generation') {
            systemIdentity = `You are a professional Indian school exam paper setter AI for NeoBranium. Your task is to generate high-quality, NCERT-compliant exam papers.`;
            queryContext = `Act as an expert examiner. Follow all formatting instructions for the exam paper strictly.`;
        } else {
            queryContext = queryType === 'code'
                ? 'You are a programming expert. Provide code examples with explanations.'
                : queryType === 'math' || queryType === 'science'
                    ? 'You are a STEM expert. Explain concepts clearly with examples.'
                    : 'You are a helpful learning assistant.';
        }

        const personalContext = memory.name
            ? `The user's name is ${memory.name}. `
            : '';



        // Build messages array
        const systemContent = `${systemIdentity} ${queryContext}`;

        const userContent = task === 'paper_generation'
            ? message // Keep specialized task prompts clean from chat instructions
            : `${personalContext}User question: ${message}\n\nRespond in a helpful, educational manner. Use markdown for formatting.\nIf explaining code, always provide examples.\nBe encouraging and patient with learners.`;
        const messages = [
            { role: 'system', content: systemContent },
            ...validatedHistory,
            { role: 'user', content: userContent }
        ];

        // Log request for debugging
        console.log('📤 Sending to Ns-x API:', {
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

        // Question papers use Gemini; regular chat continues to use Groq.
        if (task === 'paper_generation') {
            if (!geminiApiKey) {
                console.error('Missing GEMINI_API_KEY in environment');
                return res.status(500).json({ reply: 'Gemini AI service unavailable. Configure GEMINI_API_KEY on the server.' });
            }

            let geminiResponse;
            try {
                geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiApiKey}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        systemInstruction: { parts: [{ text: systemContent }] },
                        contents: [{ role: 'user', parts: [{ text: userContent }] }],
                        generationConfig: {
                            temperature: 0.7,
                            maxOutputTokens: 8192
                        }
                    })
                });
            } catch (fetchError) {
                console.error('Gemini fetch error:', fetchError);
                return res.status(500).json({ reply: 'Gemini AI request failed' });
            }

            if (!geminiResponse.ok) {
                const errorText = await geminiResponse.text();
                console.error('Gemini API error:', geminiResponse.status, errorText);
                return res.status(500).json({ reply: 'Gemini AI request failed' });
            }

            const geminiData = await geminiResponse.json();
            const text = geminiData.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
            if (!text) {
                console.error('Gemini API returned no text:', geminiData);
                return res.status(500).json({ reply: 'Gemini AI returned an empty response' });
            }

            return res.json({ reply: text });
        }

        // Check if API key is available for regular chat
        if (!groqApiKey) {
            console.error('❌ Some went wrong');
            return res.status(500).json({ reply: 'AI service unavailable' });
        }

        let groqResponse;
        try {
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${groqApiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
        } catch (fetchError) {
            console.error('❌ Fetch error:', fetchError);
            return res.status(500).json({ reply: 'AI request failed' });
        }

        if (!groqResponse.ok) {
            const errorText = await groqResponse.text();
            console.error('❌ Groq API error:', groqResponse.status, errorText);
            return res.status(500).json({ reply: 'AI request failed' });
        }

        let groqData;
        try {
            groqData = await groqResponse.json();
        } catch (jsonError) {
            console.error('❌ Failed to parse Ns-x response:', jsonError);
            return res.status(500).json({ reply: 'AI request failed' });
        }

        if (!groqData.choices || groqData.choices.length === 0) {
            console.error('❌ Ns-x API returned no choices:', groqData);
            return res.status(500).json({ reply: 'AI request failed' });
        }

        let text = groqData.choices[0].message.content;
        if (!text) {
            console.error('❌ Ns-x API returned empty content');
            return res.status(500).json({ reply: 'AI request failed' });
        }

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

// Streaming Chat Endpoint for Live Tutor
app.post('/api/chat-stream', boardRateLimit, async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        const { message, history = [], task = 'tutor_chat', tutorState = {} } = req.body;

        const sanResult = sanitizeAIInput(message);
        const sanEq = sanitizeAIInput(tutorState.detectedEquation || '');
        const sanTopic = sanitizeAIInput(tutorState.currentTopic || '');
        
        if (!sanResult.safe || !sanEq.safe || !sanTopic.safe) {
            res.write(`data: ${JSON.stringify({ content: "Main sirf NeoBranium ke syllabus ke baare mein help kar sakta hoon. Koi aur question hai?" })}\n\n`);
            res.write('data: [DONE]\n\n');
            return res.end();
        }

        const safeHistory = (history || [])
            .slice(-10)
            .filter(h => h.role && h.content && typeof h.content === 'string')
            .map(h => ({
                role: h.role === 'assistant' ? 'assistant' : 'user',
                content: h.content.slice(0, 2000) // cap each history message
            }));

        const secureUserId = req.session?.id || 'fallback';
        let memory = await getUserMemory(secureUserId);
        if (!memory) {
            memory = {
                name: null,
                topics: [],
                preferences: {},
                sessionStart: new Date(),
                messageCount: 0
            };
        }
        memory.messageCount++;
        saveUserMemory(secureUserId, memory).catch(e => console.error(e));

        // Validate mode
        const mode = tutorState.mode || 'hinglish';
        let modeInstruction = "";
        switch (mode) {
            case 'english': modeInstruction = "Respond in formal English. Be professional, encouraging, and concise."; break;
            case 'hindi': modeInstruction = "Respond in pure, formal Hindi using Devanagari script. Ensure explanations are easy for CBSE students."; break;
            case 'hinglish': modeInstruction = "Respond in extremely natural Indian Hindi. Mix Hindi and English naturally (e.g. hindi). Sound like an educated Indian student tutor."; break;
            case 'teacher': modeInstruction = "Explain like an experienced Indian CBSE coaching teacher. Patiently reinforce concepts, warn about common mistakes."; break;
            default: modeInstruction = "Respond naturally.";
        }

        // Build prompt
        let systemContent = `You are a patient, adaptive, emotionally intelligent AI Tutor from NeoBranium. 
You are currently helping a student who is looking at a digital study board.
Board Context: The student has drawn/written: "${tutorState.detectedEquation ? tutorState.detectedEquation.slice(0, 500) : 'unknown'}"
Recent Topic: "${tutorState.currentTopic ? tutorState.currentTopic.slice(0, 100) : 'general'}"

RULES:
1. Act as a human-like, conversational tutor.
2. DO NOT repeat the entire solution if they ask a small follow-up. 
3. Encourage curiosity and explain incrementally step-by-step.
4. Sometimes ask small guiding questions instead of giving the final answer instantly.
5. If the user asks 'why', explain the reasoning simply. If they ask 'next', show just the next step.
6. Tone/Language: ${modeInstruction}
7. IMPORTANT: Format math with $$ for blocks and \\( \\) for inline.`;

        // Intent detection (lightweight preprocessing instruction)
        let processedMessage = message;
        if (message.match(/^(again|repeat|one more time)$/i)) processedMessage = "Please explain that again, but simpler.";
        if (message.match(/^(next|next step|continue)$/i)) processedMessage = "Please show me the next step in the solution.";
        if (message.match(/^(why|how come)$/i)) processedMessage = "Why is that the case? Please explain the reasoning.";

        const messages = [
            { role: 'system', content: systemContent },
            ...safeHistory,
            { role: 'user', content: processedMessage }
        ];

        const requestBody = {
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            messages: messages,
            temperature: 0.7,
            max_tokens: 1024,
            stream: true // Enable streaming
        };

        if (!groqApiKey) {
            res.write(`data: ${JSON.stringify({ error: 'AI service unavailable' })}\n\n`);
            return res.end();
        }

        const groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!groqResponse.ok) {
            console.error("Groq Stream Error:", await groqResponse.text());
            res.write(`data: ${JSON.stringify({ error: 'AI stream failed' })}\n\n`);
            return res.end();
        }

        // Process SSE stream from Groq
        const reader = groqResponse.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.trim()) {
                    // Process any remaining buffer
                    const line = buffer.trim();
                    if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                        try {
                            const data = JSON.parse(line.slice(6));
                            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                                res.write(`data: ${JSON.stringify({ content: data.choices[0].delta.content })}\n\n`);
                            }
                        } catch (e) {
                            console.error('Error parsing final SSE chunk:', e);
                        }
                    }
                }
                res.write('data: [DONE]\n\n');
                res.end();
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep the last incomplete line in the buffer

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue;

                try {
                    const jsonStr = trimmed.slice(6);
                    if (!jsonStr.endsWith('}') && !jsonStr.endsWith(']')) continue; // Basic incomplete JSON check

                    const data = JSON.parse(jsonStr);
                    if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                        res.write(`data: ${JSON.stringify({ content: data.choices[0].delta.content })}\n\n`);
                    }
                } catch (e) {
                    // Only log real errors, not common incomplete chunks
                    if (trimmed.length > 50) {
                        console.warn('Skipping incomplete SSE chunk');
                    }
                }
            }
        }
    } catch (error) {
        console.error('❌ Stream request failed:', error);
        res.write(`data: ${JSON.stringify({ error: 'Internal Server Error' })}\n\n`);
        res.end();
    }
});


// Gemini Image Solving API with Session-based Rate Limiting
app.post('/api/gemini-solve', async (req, res) => {
    // 1. Enforce Server-Side Daily Limit (15 per 24h)
    const SOLVER_DAILY_LIMIT = 15;
    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Initialize or Reset solver-specific usage window in session
    if (!req.session.solverUsage) {
        req.session.solverUsage = { count: 0, firstSolve: now };
    } else if (now - req.session.solverUsage.firstSolve >= WINDOW_MS) {
        req.session.solverUsage.count = 0;
        req.session.solverUsage.firstSolve = now;
    }

    // Reject if limit exceeded
    if (req.session.solverUsage.count >= SOLVER_DAILY_LIMIT) {
        return res.status(429).json({
            success: false,
            error: "Daily solver limit reached. Please try again after 24 hours."
        });
    }

    try {
        let { base64, mimeType } = req.body;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            console.error('❌ Server Side Error - Contact NeoBranium Support');
            return res.status(500).json({ success: false, error: 'Server Side Error' });
        }

        if (!base64 || !mimeType) {
            return res.status(400).json({ success: false, error: 'Missing image data or mimeType' });
        }

        // 🛡️ Strip data URI prefix
        if (base64.startsWith('data:')) {
            base64 = base64.split(',')[1];
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: "Extract the question from the image, fix any OCR errors, and solve it step-by-step. Follow NCERT Class 10 standards and use simple language." },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64
                            }
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Gemini API Failure:', JSON.stringify(data, null, 2));
            return res.status(500).json({ success: false, error: 'Gemini API request failed' });
        }

        // Increment solver session count ONLY on successful solve
        req.session.solverUsage.count++;

        // Robust extraction of AI generated text with fallback handling
        const candidates = data?.candidates || [];
        const firstCandidate = candidates[0];
        const contentParts = firstCandidate?.content?.parts || [];
        const resultText = contentParts[0]?.text || "No solution could be generated. Please try with a clearer image.";

        res.json({
            success: true,
            result: resultText
        });

    } catch (error) {
        console.error('❌ Gemini Solve Route Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Safe JSON parser for Gemini responses — handles invalid LaTeX escape sequences
function safeParseGeminiJSON(rawText) {
    let cleaned = rawText
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/, '')
        .replace(/```\s*$/, '')
        .trim();
    // Fix invalid JSON escape sequences from LaTeX (e.g. \d, \f not valid in JSON)
    cleaned = cleaned.replace(
        /"((?:[^"\\]|\\.)*)"/g,
        (match, inner) => {
            const fixed = inner.replace(/\\(?!["\\/bfnrtu])/g, '\\\\');
            return `"${fixed}"`;
        }
    );
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('safeParseGeminiJSON failed:', e.message, '| First 200 chars:', cleaned.slice(0, 200));
        return {
            confidence: 80,
            inputType: 'text',
            blocks: [{ type: 'text', content: rawText.replace(/```json|```/g, '').trim() }],
            commands: []
        };
    }
}

// AI Board Analysis API
app.post('/api/analyze-board', boardRateLimit, async (req, res) => {
    // 🛡️ Reuse session-based rate limiting
    const DAILY_LIMIT = 5;
    const WINDOW_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    if (!req.session.usage) {
        req.session.usage = { count: 0, firstSolve: now };
    } else if (now - req.session.usage.firstSolve >= WINDOW_MS) {
        req.session.usage.count = 0;
        req.session.usage.firstSolve = now;
    }

    if (req.session.usage.count >= DAILY_LIMIT) {
        return res.status(429).json({
            success: false,
            error: "Daily limit reached. Please try again later."
        });
    }

    try {
        let { base64, mimeType, mode = 'hinglish', isAutoScan = false } = req.body;
        const geminiApiKey = process.env.GEMINI_API_KEY;

        if (!geminiApiKey) {
            return res.status(500).json({ success: false, error: 'AI service configuration missing' });
        }

        if (!base64 || !mimeType) {
            return res.status(400).json({ success: false, error: 'Missing image data' });
        }

        // 🛡️ SECURITY & STABILITY: Strip data URI prefix if present
        if (base64.startsWith('data:')) {
            base64 = base64.split(',')[1];
        }

        let modeInstruction = "";
        switch (mode) {
            case 'english':
                modeInstruction = "Respond in formal English. Be professional, encouraging, student-friendly, and concise but clear. No slang.";
                break;
            case 'hindi':
                modeInstruction = "Respond in pure, formal Hindi using Devanagari script. Ensure explanations are easy for CBSE students. Avoid robotic translation.";
                break;
            case 'hinglish':
                modeInstruction = "Respond in extremely natural Indian Hinglish. Mix Hindi and English naturally. Tone should be warm, friendly, and human-like (e.g. 'Dekho yaha basically...'). Do NOT translate technical terms (keep 'variable', 'carry', etc). No exaggerated slang. Sound like an educated Indian student.";
                break;
            case 'teacher':
                modeInstruction = "Explain like an experienced Indian CBSE coaching teacher. Patiently reinforce concepts, warn about common mistakes, emphasize exam relevance, and occasionally repeat key concepts (e.g. 'Beta, yaha dhyan dena').";
                break;
            default:
                modeInstruction = "Respond naturally.";
        }

        // Specialized prompt for digital study board analysis
        let prompt = "";
        const structureInstructions = `
Provide your response strictly in the following JSON format:
{
  "confidence": <integer 0-100>,
  "inputType": "<math|text|diagram|unclear>",
  "blocks": [
    {
      "type": "text",
      "content": "<plain text, Hindi or Hinglish as requested>"
    },
    {
      "type": "equation",
      "format": "latex",
      "content": "<pure LaTeX without delimiters, e.g. 2Mg + O_{2} \\rightarrow 2MgO>"
    },
    {
      "type": "heading",
      "content": "<heading text>"
    },
    {
      "type": "bullet_list",
      "items": ["<item 1>", "<item 2>"]
    },
    {
      "type": "step",
      "content": "<step explanation>",
      "number": <integer>
    },
    {
      "type": "warning",
      "content": "<warning or common mistake note>"
    },
    {
      "type": "final_answer",
      "content": "<the final result or conclusion>"
    }
  ],
  "commands": [
    {"type": "circle", "x": <0-1000>, "y": <0-1000>, "radius": <optional 1-100>},
    {"type": "underline", "x": <0-1000>, "y": <0-1000>, "width": <optional 1-200>},
    {"type": "arrow", "x1": <0-1000>, "y1": <0-1000>, "x2": <0-1000>, "y2": <0-1000>},
    {"type": "write", "text": "<short label>", "x": <0-1000>, "y": <0-1000>}
  ]
}

Scientific Notation Rules:
1. Detect subscripts and superscripts intelligently (e.g., O2 -> O_{2}, x2 -> x^{2} if intended as power).
2. For chemistry, use proper LaTeX notation for reactions (e.g. \\rightarrow, \\Delta).
3. Never output scientific equations as raw plain text; always use the "equation" block.
4. Tone/Style: ${modeInstruction}`;

        if (isAutoScan) {
            prompt = `You are the NeoBranium Live Tutor. PASSIVELY observe the student's writing. Only speak up if you see a mistake or if you can provide a helpful hint.
${structureInstructions}

Guidelines for Live Tutor:
- If correct, leave "blocks" and "commands" empty.
- Coordinates (0-1000) are relative to the image (0,0 is top-left).
- DO NOT give final answers. Use "write" command for small hints only.`;
        } else {
            prompt = `You are the NeoBranium AI Board analyzer. The user has drawn or written something on their digital study board. Analyze it and provide a detailed explanation.
${structureInstructions}

Explanation Guidelines:
- Use "commands" to highlight key parts of the student's work on the canvas.
- Maximum total length: 300 words.
- If inputType is 'unclear', leave blocks and commands empty.`;
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { text: prompt },
                        {
                            inline_data: {
                                mime_type: mimeType,
                                data: base64
                            }
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('❌ Gemini Analysis Failure:', JSON.stringify(data, null, 2));
            return res.status(500).json({ success: false, error: 'AI Analysis failed' });
        }

        req.session.usage.count++;

        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        let parsedResult = safeParseGeminiJSON(rawText);

        // Normalize legacy explanation if present
        if (parsedResult.explanation && !parsedResult.blocks) {
            parsedResult.blocks = [{
                type: 'text',
                content: parsedResult.explanation
                    .replace(/\[\[math\]\]/g, '$$$$')
                    .replace(/\[\[\/math\]\]/g, '$$$$')
                    .replace(/\[math\]/g, '\\(')
                    .replace(/\[\/math\]/g, '\\)')
            }];
            delete parsedResult.explanation;
        }

        if (parsedResult.blocks) {
            parsedResult.blocks.forEach(block => {
                if (block.content && typeof block.content === 'string') {
                    block.content = block.content
                        .replace(/\[\[math\]\]/g, '$$$$')
                        .replace(/\[\[\/math\]\]/g, '$$$$')
                        .replace(/\[math\]/g, '\\(')
                        .replace(/\[\/math\]/g, '\\)');
                }
            });
        }

        res.json({
            success: true,
            result: parsedResult
        });

    } catch (error) {
        console.error('❌ Analyze Board Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// Rephrase API for AI Board Modes
app.post('/api/rephrase-board', boardRateLimit, async (req, res) => {
    try {
        const { text, mode } = req.body;
        const groqApiKey = process.env.GROQ_API_KEY;

        if (!groqApiKey) {
            return res.status(500).json({ success: false, error: 'AI service configuration missing' });
        }

        if (!text || !mode) {
            return res.status(400).json({ success: false, error: 'Missing text or mode' });
        }

        let modeInstruction = "";
        switch (mode) {
            case 'english':
                modeInstruction = "Respond in formal English. Be professional, encouraging, student-friendly, and concise but clear. No slang.";
                break;
            case 'hindi':
                modeInstruction = "Respond in pure, formal Hindi using Devanagari script. Ensure explanations are easy for CBSE students. Avoid robotic translation.";
                break;
            case 'hinglish':
                modeInstruction = "Respond in extremely natural Indian Hinglish. Mix Hindi and English naturally (e.g. 'Dekho yaha basically addition ho raha hai.'). Do NOT translate technical terms. No exaggerated slang. Speak like educated real Indian students.";
                break;
            case 'teacher':
                modeInstruction = "Explain like an experienced Indian CBSE tuition teacher. Patiently reinforce concepts, warn about common mistakes, emphasize exam relevance, and repeat key concepts (e.g. 'Beta, yaha students usually mistake kar dete hain').";
                break;
            default:
                modeInstruction = "Respond naturally.";
        }

        const prompt = `You are an educational assistant. Rephrase the following explanation into the requested mode. Limit to 250 words. Do not change facts.

Requested Mode Instruction:
${modeInstruction}

IMPORTANT: Format all mathematical equations using standard LaTeX delimiters ($$ for block math, and \\( \\) for inline math).

Explanation to rephrase:
${text}`;

        const requestBody = {
            model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
            messages: [{ role: 'system', content: prompt }],
            temperature: 0.7,
            max_tokens: 1024
        };

        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${groqApiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (!response.ok || !data.choices || data.choices.length === 0) {
            console.error('❌ Rephrase Error:', data);
            return res.status(500).json({ success: false, error: 'Rephrase failed' });
        }

        res.json({
            success: true,
            result: data.choices[0].message.content
        });

    } catch (error) {
        console.error('❌ Rephrase API Error:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ElevenLabs TTS Route  (nb-tts — new addition)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const ELEVENLABS_API_KEY = (process.env.ELEVENLABS_API_KEY || '').trim().replace(/^['"]|['"]$/g, '');

// Voice IDs for each mode. Change these to your preferred ElevenLabs voice IDs.
const NB_VOICE_MAP = {
    hinglish: (process.env.EL_VOICE_HINGLISH || '').trim().replace(/^['"]|['"]$/g, '') || 'pNInz6obpgDQGcFmaJgB', // Adam — neutral, clear
    teacher: (process.env.EL_VOICE_TEACHER || '').trim().replace(/^['"]|['"]$/g, '') || 'ErXwobaYiN019PkySvjV', // Antoni — authoritative
    english: (process.env.EL_VOICE_ENGLISH || '').trim().replace(/^['"]|['"]$/g, '') || 'EXAVITQu4vr4xnSDxMaL', // Bella — professional
    hindi: (process.env.EL_VOICE_HINDI || '').trim().replace(/^['"]|['"]$/g, '') || 'pNInz6obpgDQGcFmaJgB'  // Adam — works for Hindi
};

// Hinglish pronunciation corrections applied before sending to ElevenLabs
const applyHinglishPronunciationFixes = (text) => {
    return text
        // Common Hinglish words that get mispronounced
        .replace(/\bkaro\b/gi, 'kuh-ro')
        .replace(/\bsuno\b/gi, 'soo-no')
        .replace(/\bdekho\b/gi, 'dek-ho')
        .replace(/\bsahi\b/gi, 'saa-hi')
        .replace(/\btheek\b/gi, 'theek')
        .replace(/\bwaala\b/gi, 'waa-la')
        .replace(/\bwaale\b/gi, 'waa-le')
        .replace(/\byaad\b/gi, 'yaad')
        .replace(/\bpadho\b/gi, 'puh-dho')
        .replace(/\blikho\b/gi, 'lik-ho')
        .replace(/\bsamjhe\b/gi, 'sum-jheh')
        .replace(/\bsamajh\b/gi, 'sum-ujh')
        .replace(/\bkya\b/gi, 'kyaa')
        .replace(/\bhaan\b/gi, 'haan')
        .replace(/\bnahi\b/gi, 'nuh-hee')
        .replace(/\bnahin\b/gi, 'nuh-heen')
        .replace(/\bacha\b/gi, 'uh-chha')
        .replace(/\bachha\b/gi, 'uh-chha')
        .replace(/\bthoda\b/gi, 'tho-daa')
        .replace(/\bbeta\b/gi, 'bay-taa')
        .replace(/\bgyaan\b/gi, 'gyaan')
        // Math terms that sound unnatural when read as text
        .replace(/\bsqrt\b/gi, 'square root of')
        .replace(/\^2\b/g, ' squared')
        .replace(/\^3\b/g, ' cubed')
        // Strip markdown tokens that would be spoken aloud
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/#{1,6}\s?/g, '')
        .replace(/`{1,3}[^`]*`{1,3}/g, '')
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
        // Strip LaTeX delimiters (leave the content readable)
        .replace(/\$\$(.*?)\$\$/gs, (_, eq) => eq.replace(/[\\{}^_]/g, ' '))
        .replace(/\\\((.*?)\\\)/g, (_, eq) => eq.replace(/[\\{}^_]/g, ' '))
        .trim();
};

app.post('/api/tts', boardRateLimit, async (req, res) => {
    try {
        const { text, mode = 'hinglish' } = req.body;

        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({ error: 'Missing or invalid text' });
        }

        if (text.length > 5000) {
            return res.status(400).json({ error: 'Text too long for TTS' });
        }

        if (!ELEVENLABS_API_KEY) {
            return res.status(503).json({ error: 'ElevenLabs not configured' });
        }

        const voiceId = NB_VOICE_MAP[mode] || NB_VOICE_MAP['hinglish'];

        // Apply pronunciation fixes for Hinglish and Hindi modes
        let processedText = text;
        if (mode === 'hinglish' || mode === 'teacher' || mode === 'hindi') {
            processedText = applyHinglishPronunciationFixes(text);
        } else {
            // Strip markdown for all modes
            processedText = text
                .replace(/\*\*(.*?)\*\*/g, '$1')
                .replace(/\*(.*?)\*/g, '$1')
                .replace(/#{1,6}\s?/g, '')
                .replace(/`{1,3}[^`]*`{1,3}/g, '')
                .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
                .replace(/\$\$(.*?)\$\$/gs, (_, eq) => eq.replace(/[\\{}^_]/g, ' '))
                .replace(/\\\((.*?)\\\)/g, (_, eq) => eq.replace(/[\\{}^_]/g, ' '))
                .trim();
        }

        // Voice settings tuned per mode
        const voiceSettings = {
            hinglish: { stability: 0.45, similarity_boost: 0.75, style: 0.3, use_speaker_boost: true },
            teacher: { stability: 0.60, similarity_boost: 0.80, style: 0.2, use_speaker_boost: true },
            english: { stability: 0.55, similarity_boost: 0.78, style: 0.25, use_speaker_boost: false },
            hindi: { stability: 0.50, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true }
        };

        const settings = voiceSettings[mode] || voiceSettings['hinglish'];

        const elResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json',
                    'Accept': 'audio/mpeg'
                },
                body: JSON.stringify({
                    text: processedText,
                    model_id: 'eleven_multilingual_v2',
                    voice_settings: settings
                })
            }
        );

        if (!elResponse.ok) {
            const errText = await elResponse.text();
            console.error('❌ ElevenLabs TTS error:', elResponse.status, errText);
            return res.status(elResponse.status).json({
                error: 'ElevenLabs request failed',
                details: errText
            });
        }

        // Stream audio back to client
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Transfer-Encoding', 'chunked');

        const reader = elResponse.body.getReader();
        const pump = async () => {
            while (true) {
                const { done, value } = await reader.read();
                if (done) { res.end(); break; }
                res.write(Buffer.from(value));
            }
        };
        await pump();

    } catch (error) {
        console.error('❌ /api/tts error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'TTS internal error' });
        }
    }
});
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// END ElevenLabs TTS Route
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Statistics endpoint
app.get('/api/stats', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!process.env.ADMIN_KEY || authHeader !== `Bearer ${process.env.ADMIN_KEY}`) {
        return res.status(403).json({ error: 'Unauthorized' });
    }
    try {
        let activeUsers = 0;
        let totalMessages = 0;
        const topicMap = new Map();

        let allMemories = [];

        if (redisClient.isReady) {
            // Fetch from Redis
            const allRedisData = await redisClient.hGetAll('user_memory');
            allMemories = Object.values(allRedisData).map(val => JSON.parse(val));
        } else {
            // Fetch from fallback Map
            allMemories = Array.from(fallbackMemory.values());
        }

        activeUsers = allMemories.length;

        for (const memory of allMemories) {
            totalMessages += memory.messageCount || 0;
            const topics = memory.topics || [];
            for (const topic of topics) {
                topicMap.set(topic, (topicMap.get(topic) || 0) + 1);
            }
        }

        const stats = {
            activeUsers,
            totalMessages,
            topicDistribution: Object.fromEntries(topicMap)
        };

        res.json(stats);
    } catch (error) {
        console.error("Stats processing error:", error);
        res.status(500).json({ error: "Failed to load stats" });
    }
});

app.post('/api/board-heartbeat', async (req, res) => {
    const userId = req.session?.id;
    if (!userId) return res.status(403).json({ error: 'No session' });
    queueManager.heartbeat(userId);
    res.json({ ok: true });
});

app.post('/api/board-session-end', async (req, res) => {
    const userId = req.session?.id;
    if (!userId) return res.status(403).json({ error: 'No session' });
    queueManager.leave(userId);
    await endSession(userId).catch(e => console.error(e));
    res.json({ ok: true });
});

app.get('/api/board-queue-status', async (req, res) => {
    try {
        const userId = req.session?.id;
        if (!userId) return res.status(403).json({ error: 'No session' });
        const position = queueManager.getPosition(userId);
        const { getSessionStatus } = await import('./firebaseAdmin.js');
        const sessionData = await getSessionStatus(userId).catch(() => null);
        res.json({ ...position, sessionData });
    } catch (error) {
        console.error('Error in /api/board-queue-status:', error);
        res.status(500).json({ error: 'Internal Server Error', message: error.message });
    }
});

// Serve static files safely - block access to root backend files
app.use((req, res, next) => {
    const forbiddenExtensions = ['.js', '.json', '.md', '.env', '.rdb', '.py'];
    const pathLower = req.path.toLowerCase();
    
    // Explicitly allow client-side folders
    if (pathLower.startsWith('/css/') || 
        pathLower.startsWith('/js/') || 
        pathLower.startsWith('/htmls/') || 
        pathLower.startsWith('/ai-board/') ||
        pathLower.startsWith('/blog/') ||
        pathLower.startsWith('/screenshot_images/')) {
        return next();
    }
    
    // Allow specific root HTML files
    if (pathLower === '/' || pathLower === '/index.html' || pathLower === '/about.html') {
        return next();
    }
    
    // Block backend file extensions
    const ext = path.extname(pathLower);
    if (forbiddenExtensions.includes(ext) || pathLower.includes('.env')) {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    next();
});
app.use(express.static(path.join(__dirname)));

if (process.env.NODE_ENV === 'production') {
    app.get('*', (req, res) => {
        res.sendFile(path.join(__dirname, 'index.html'));
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
