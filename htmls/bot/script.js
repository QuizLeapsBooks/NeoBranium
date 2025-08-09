const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

// 🔹 Backend API ka URL (localhost ki jagah tumhara Vercel URL lagao)
const API_URL = "https://neo-branium.vercel.app/api/chat";

async function getChatResponse(userText) {
    // Homework keywords check
    const homeworkKeywords = [
        "solve", "answer", "do my homework", "complete", "assignment", 
        "problem set", "homework", "Q.", "Q:", "solution", "calculate"
    ];

    const isHomework = homeworkKeywords.some(keyword =>
        userText.toLowerCase().includes(keyword)
    );

    // Simple math pattern check (like 5+3)
    const isSimpleMath = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/.test(userText);

    if (isHomework || isSimpleMath) {
        return "Oops! 😅 I don’t directly solve homework, but I can make you an expert by explaining the concept. Ask me any theory, reason, or trick — let’s learn smartly! 📘✨";
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
        return "Oops! Server is busy or unreachable right now. Please try again later. 😅";
    }
}

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
