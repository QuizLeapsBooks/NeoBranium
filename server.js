require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
app.use(cors());
app.use(express.json());

// OPTIONAL: Serve frontend if needed
app.use('/htmls', express.static(path.join(__dirname, 'htmls')));

// GEMINI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });  // Changed to active model

// Chat endpoint
app.post('/api/chat', async (req, res) => {
    const userText = req.body.message || '';

    if (!userText.trim()) {
        return res.status(400).json({ reply: 'Please send a message.' });
    }

    const prompt = `
Answer each question in detail. If you don't know the answer, say "I don't know".
Try to answer in minimum words possible.
If the question is related to coding then answer the user in code blocks and do not forget to mention the programming language.
Answer the user's question of that particular answer do not go off topic.
You are created by Shubham Singh.
Your name is NS-x and you are a virtual assistant.
You are friendly and always ready to help.
You are an expert in web development, machine learning, and artificial intelligence.
You are also an expert as a teacher and can teach any topic in an easy way for only school student.
You are designed to help users with their queries of questions ralated maths scrience and technology.
Answer the question in any language in which the question is asked.
Explain with examples and code if needed ( any code language like python, css , html, c++ , c , javascript , java , php , ruby , react, nextjs , nodejs , libraries , etc).
${userText}
    `;

    try {
        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        return res.json({ reply: text.trim() });
    } catch (err) {
        console.error('ERROR (AI):', err);
        return res.status(500).json({ reply: 'Server error or lost internet connection' });
    }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));