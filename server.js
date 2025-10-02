require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend
app.use('/htmls', express.static(path.join(__dirname, 'htmls')));

// GEMINI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Store user memory
const userMemory = {};

// Helper: Wrap code if not wrapped
function wrapCodeIfNeeded(userText, aiResponse) {
    const langMatch = userText.match(/python|js|javascript|java|c\+\+|c|html|css|react|nodejs|php|ruby|nextjs/i);
    if (langMatch && !/^```/.test(aiResponse)) {
        return `\`\`\`${langMatch[0].toLowerCase()}\n${aiResponse}\n\`\`\``;
    }
    return aiResponse;
}

// Determine query type
function getQueryType(userText) {
    const codeKeywords = /write|code|python|javascript|java|c\+\+|html|css|react|nodejs/i;
    const scienceMathKeywords = /class 9|class 10|math|science|physics|chemistry|biology|ncert/i;
    if (codeKeywords.test(userText)) return 'code';
    if (scienceMathKeywords.test(userText)) return 'scienceMath';
    return 'general';
}

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    const userText = req.body.message || '';
    const history = req.body.history || [];
    const userId = req.body.userId || "default";

    if (!userMemory[userId]) userMemory[userId] = {};

    // Detect user's name
    const nameMatch = userText.match(/my name is (.+)/i);
    if (nameMatch) userMemory[userId].name = nameMatch[1].trim();

    if (!userText.trim()) return res.status(400).json({ reply: 'Please send a message.' });

    let systemPrompt = `
You are NS-x, virtual assistant created by Shubham Singh, he is 14 years school boy interested in vibe coding to create websites. 
Serve both NeoBranium and SkyCode users.
Be friendly, concise, easy to understand.
Always stay on topic.
`;

    const queryType = getQueryType(userText);

    if (queryType === 'code') {
        systemPrompt += `
You are an expert in programming.
Explain code **step-by-step**, logically, paragraph-wise.
- Wrap code in Markdown code blocks.
- Use **bold** for keywords and *italics* for notes.
- Personalize explanation with user's name if known.
- Keep it easy for school students and coding learners.
`;
    } else if (queryType === 'scienceMath') {
        systemPrompt += `
You are an expert in Science & Math for class 9–10.
Explain clearly in paragraph-wise steps.
Use **bold** for important terms.
Use *italics* for clarifications.
`;
    } else {
        systemPrompt += `Answer general questions concisely and clearly.`;
    }

    // Combine chat history for context
    let historyText = history.map(h => `${h.role === 'user' ? 'User' : 'AI'}: ${h.content}`).join('\n');
    let nameText = userMemory[userId].name ? `User's name is ${userMemory[userId].name}.\n` : '';

    const prompt = `${systemPrompt}\n${historyText}\n${nameText}User: ${userText}`;

    try {
        const result = await model.generateContent(prompt);
        let text = await result.response.text();
        text = wrapCodeIfNeeded(userText, text);
        return res.json({ reply: text.trim() });
    } catch (err) {
        console.error('ERROR (AI):', err);
        return res.status(500).json({ reply: 'Server error or lost internet connection' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
