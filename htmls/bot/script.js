// ========================
// DOM Elements
// ========================
const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// ========================
// Backend URL Setup
// ========================
const API_BASE_URL = window.location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://neobranium.onrender.com"; // Live backend URL

// ========================
// Function: Get Chat Response
// ========================
async function getChatResponse(userText) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText })
        });

        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();
        return data.reply || "No response from server.";
    } catch (error) {
        console.error("Error:", error);
        return "Oops! Server is busy right now. Please try again later. 😅";
    }
}

// ========================
// Function: Add Message to Chat
// ========================
function addMessageToChat(text, isUser, isThinking = false) {
    const messageDiv = document.createElement("div");
    messageDiv.classList.add(
        "chat-message",
        isUser ? "user-message" : isThinking ? "thinking-message" : "ai-message"
    );
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return messageDiv;
}

// ========================
// Function: Handle Send Button Click
// ========================
async function handleAPI() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Show user's message
    addMessageToChat(userText, true);
    chatInput.value = "";
    sendButton.disabled = true;

    // Show "Thinking..."
    const thinkingMessage = addMessageToChat("Thinking... 🤔", false, true);

    // Get AI Response
    const response = await getChatResponse(userText);

    // Remove thinking message & show AI reply
    thinkingMessage.remove();
    addMessageToChat(response, false);

    sendButton.disabled = false;
}

// ========================
// Event Listeners
// ========================
sendButton.addEventListener("click", handleAPI);

chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAPI();
    }
});
