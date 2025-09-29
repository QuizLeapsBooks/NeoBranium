let chatHistory = []; // Store previous messages

// DOM Elements
const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// Backend URL
const API_BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://neobranium.onrender.com";

// Simple Markdown Parser for bold and code
function parseMarkdown(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/```(?:js|javascript)?\n([\s\S]*?)\n```/g, '<pre class="code-block">$1</pre>');
    return text.replace(/\n/g, '<br>');
}

// Get Chat Response - Include editor code and history
async function getChatResponse(userText) {
    try {
        const currentCode = editor.getValue(); // Read editor code
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText, code: currentCode, history: chatHistory })
        });

        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const data = await res.json();
        return data.reply || "No response from server.";
    } catch (error) {
        console.error("Error:", error);
        return "Oops! Server busy hai abhi. Thoda wait kar. 😅";
    }
}

// Add Message to Chat - Use innerHTML for formatting, add colors
function addMessageToChat(text, isUser, isThinking = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
        "chat-message",
        isUser ? "user-message" : isThinking ? "thinking-message" : "ai-message"
    );
    if (isUser) {
        messageDiv.innerHTML = `<span style="color: #ff4500;">${parseMarkdown(text)}</span>`; // Prompt in orange-red
    } else if (!isThinking) {
        messageDiv.innerHTML = `<span style="color: #00ced1;">${parseMarkdown(text)}</span>`; // AI response in dark turquoise
    } else {
        messageDiv.textContent = text;
    }
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (isUser) chatHistory.push({ role: "user", content: text }); // Store user message
    return messageDiv;
}

// Handle Send
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

// Events
sendButton.addEventListener("click", handleAPI);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAPI();
    }
});