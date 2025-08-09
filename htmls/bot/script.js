const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// 🔹 API URL (replace with your actual deployed Vercel domain)
const API_URL = "https://neo-branium.vercel.app/api/chat";

// Function to get response from backend
async function getChatResponse(userText) {
    // Words that might indicate homework requests
    const homeworkKeywords = [
        "solve", "answer", "do my homework", "complete", "assignment", 
        "problem set", "homework", "Q.", "Q:", "solution", "calculate"
    ];

    const isHomework = homeworkKeywords.some(keyword =>
        userText.toLowerCase().includes(keyword)
    );

    // Pattern check for simple math expressions (e.g., 5+3)
    const isSimpleMath = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/.test(userText);

    if (isHomework || isSimpleMath) {
        return "Oops! 😅 I don’t directly solve homework, but I can help you understand the concept. Ask me any theory, reason, or trick — let’s learn smartly! 📘✨";
    }

    try {
        const res = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: userText })
        });

        if (!res.ok) {
            throw new Error(`HTTP error! Status: ${res.status}`);
        }

        const data = await res.json();
        return data.reply || "Hmm... I didn’t get a reply. 🤔";
    } catch (error) {
        console.error("❌ Fetch Error:", error);
        return "Oops! The server is busy or unreachable right now. Please try again later. 😅";
    }
}

// Function to add a message bubble to the chat UI
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

// Handles sending the message and receiving a response
async function handleAPI() {
    const userText = chatInput.value.trim();
    if (!userText) return;

    // Add user's message
    addMessageToChat(userText, true);
    chatInput.value = "";
    sendButton.disabled = true;

    // Show "Thinking..." placeholder
    const thinkingMessage = addMessageToChat("Thinking... 🤔", false, true);

    // Get AI response
    const response = await getChatResponse(userText);
    thinkingMessage.remove();
    addMessageToChat(response, false);

    sendButton.disabled = false;
}

// Event listeners
sendButton.addEventListener("click", handleAPI);
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleAPI();
    }
});
