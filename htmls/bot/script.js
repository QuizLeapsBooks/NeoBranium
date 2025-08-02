import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyCshENXW82VynAiFZ-strGvyvVvocTK_tA";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

async function getChatResponse(userText) {
    const homeworkKeywords = [
        "solve", "answer", "do my homework", "complete", "assignment", 
        "problem set", "homework", "Q.", "Q:", "solution", "calculate"
    ];
    const isHomework = homeworkKeywords.some(keyword => userText.toLowerCase().includes(keyword));
    const isSimpleMath = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/.test(userText);

    if (isHomework || isSimpleMath) {
        return "Oops! 😅 I don’t directly solve homework, but I can make you an expert by explaining the concept. Ask me any theory, reason, or trick — let’s learn smartly! 📘✨";
    }

    const systemPrompt = `You are NEOBranium's AI Assistant for Class 9-10 students. Your default language is English, but always respond in the same language the user uses (e.g., Hindi, Hinglish, etc.). Be concise (2-4 lines max), clear, friendly, and creative.
You're here to:
- explain Science and Math concepts in simple language,
- spark curiosity with short facts or analogies,
- give study tips and motivate students to learn.
Avoid solving homework or giving direct answers to textbook questions. Instead, guide the user with explanations and questions that promote thinking.`;

    try {
        const result = await model.generateContent(`${systemPrompt}\nUser: ${userText}`);
        const response = await result.response.text();
        return response.trim();
    } catch (error) {
        console.error("Gemini Error:", error);
        return "Oops! Server is busy right now. Please try again later. 😅";
    }
}

function addMessageToChat(text, isUser, isThinking = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add("chat-message", isUser ? "user-message" : isThinking ? "thinking-message" : "ai-message");
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

async function handleAPI() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    addMessageToChat(userText, true);
    chatInput.value = "";
    sendButton.disabled = true;

    const thinkingMessage = addMessageToChat("Thinking... 🤔", false, true);

    const response = await getChatResponse(userText);
    thinkingMessage.remove();
    addMessageToChat(response, false);
    sendButton.disabled = false;
}

sendButton.addEventListener("click", handleAPI);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAPI();
    }
});
