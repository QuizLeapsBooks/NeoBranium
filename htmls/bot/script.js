let chatHistory = []; // Store previous messages

const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// Backend URL
const API_BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://neobranium.onrender.com";

// Markdown Parser
function parseMarkdown(text) {
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/```(?:\w+)?\n([\s\S]*?)\n```/g,
        '<pre class="code-block">$1</pre>');
    return text.replace(/\n/g, '<br>');
}

// Get Chat Response
async function getChatResponse(userText) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText, history: chatHistory })
        });
        if (!res.ok) throw new Error(`HTTP error! Status: ${res.status}`);
        const data = await res.json();
        return data.reply || "No response from server.";
    } catch (error) {
        console.error("Error:", error);
        return "Hmm....! Server error or lost internet connection";
    }
}

// Add message
function addMessageToChat(text, isUser, isThinking = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
        "chat-message",
        isUser ? "user-message" : isThinking ? "thinking-message" : "ai-message"
    );
    messageDiv.innerHTML = isThinking ? text : parseMarkdown(text);
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (isUser) chatHistory.push({ role: "user", content: text });
    else if (!isThinking) chatHistory.push({ role: "ai", content: text });
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
