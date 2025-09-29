let chatHistory = []; // Store previous messages
const userId = "default"; // Simple single user session ID

// DOM Elements
const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// Backend URL
const API_BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://neobranium.onrender.com";

// Markdown parser
function parseMarkdown(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/```(?:\w+)?\n([\s\S]*?)\n```/g,
        '<pre class="code-block">$1</pre>');
    return text.replace(/\n/g, '<br>');
}

// Add CSS for code blocks
const style = document.createElement('style');
style.textContent = `
.code-block {
    background: #f5f5f5;
    padding: 1rem;
    border-radius: 8px;
    font-family: 'Courier New', monospace;
    overflow-x: auto;
    white-space: pre-wrap;
}
`;
document.head.appendChild(style);

// Get chat response
async function getChatResponse(userText) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText, history: chatHistory, userId })
        });

        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);

        const data = await res.json();
        return data.reply || "No response from server.";
    } catch (error) {
        console.error("Error:", error);
        return "Oops! Server busy hai abhi. Thoda wait kar. 😅";
    }
}

// Add message to chat
function addMessageToChat(text, isUser, isThinking = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
        "chat-message",
        isUser ? "user-message" : isThinking ? "thinking-message" : "ai-message"
    );
    if (isUser) {
        messageDiv.innerHTML = `<span style="font-weight: bold;">${parseMarkdown(text)}</span>`;
    } else if (!isThinking) {
        messageDiv.innerHTML = parseMarkdown(text);
    } else {
        messageDiv.textContent = text;
    }
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (isUser) chatHistory.push({ role: "user", content: text });
    else if (!isThinking) chatHistory.push({ role: "ai", content: text });
    return messageDiv;
}

// Handle send
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
