const chatInput = document.querySelector("#chat-input");
const sendButton = document.querySelector("#send-btn");
const chatContainer = document.querySelector(".chat-body");

async function getChatResponse(userText) {
    const homeworkKeywords = [
        "solve", "answer", "do my homework", "complete", "assignment", 
        "problem set", "homework", "Q.", "Q:", "solution", "calculate"
    ];
    const isHomework = homeworkKeywords.some(keyword =>
        userText.toLowerCase().includes(keyword)
    );
    const isSimpleMath = /^\s*\d+\s*[\+\-\*\/]\s*\d+\s*$/.test(userText);

    if (isHomework || isSimpleMath) {
        return "Oops! 😅 I don’t directly solve homework, but I can make you an expert by explaining the concept. Ask me any theory, reason, or trick — let’s learn smartly! 📘✨";
    }

    try {
        const res = await fetch("/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userText })
        });

        const data = await res.json();
        return data.reply;
    } catch (error) {
        console.error("Error:", error);
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
