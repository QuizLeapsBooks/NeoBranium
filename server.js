require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// Serve frontend if needed
app.use('/htmls', express.static(path.join(__dirname, 'htmls')));

// GEMINI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

// Helper function to wrap code automatically
function wrapCodeIfNeeded(userText, aiResponse) {
    const langMatch = userText.match(/python|js|javascript|java|c\+\+|c|html|css|react|nodejs|php|ruby|nextjs/i);
    if (langMatch && !/^```/.test(aiResponse)) {
        return `\`\`\`${langMatch[0].toLowerCase()}\n${aiResponse}\n\`\`\``;
    }
    return aiResponse;
}

// Determine user query type
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
    if (!userText.trim()) return res.status(400).json({ reply: 'Please send a message.' });

    // Base system prompt for common AI
    let systemPrompt = `
You are NS-x, a virtual assistant created by Shubham Singh.
You serve both NeoBranium and SkyCode users.
Be friendly, concise, and easy to understand.
Always stay on topic and do not repeat introductions.
`;

    // Adjust instructions based on query type
    const queryType = getQueryType(userText);
    if (queryType === 'code') {
        systemPrompt += `
You are an expert in web development, machine learning, AI, and programming.
Answer coding questions with examples and always use proper code blocks.
Use multiple languages if asked (Python, JS, Java, C++, etc.).
Explain in an interactive and clear way suitable for SkyCode users.
`;
    } else if (queryType === 'scienceMath') {
        systemPrompt += `
You are an expert in science and math for class 9–10 students.
Answers should be concise, NCERT-aligned, and easy to understand.
Explain examples when needed, suitable for NeoBranium users.
`;
    } else {
        systemPrompt += `
Answer general questions concisely and clearly, explaining examples if needed.
`;
    }

    // Final prompt
    const prompt = `${systemPrompt}\nUser: ${userText}`;

    try {
        const result = await model.generateContent(prompt);
        let text = await result.response.text();

        // Wrap code answers if needed
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
