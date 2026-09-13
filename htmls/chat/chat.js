import { getDatabase, ref, push, onValue, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { canSendMessage, incrementChatCount } from "../../js/usage-limits.js";
import { app, auth, db, isGuestUser } from "../../js/auth.js";

// Use central Firebase instance
const rtdb = getDatabase(app, "https://neobranium-default-rtdb.firebaseio.com");
const messagesRef = ref(rtdb, "messages");

// Check auth state and get username
let currentUser = null;

// UI update helper for user info
function updateUserInfo(username, initial) {
    const usernameEl = document.getElementById("usernameDisplay");
    if (usernameEl) usernameEl.innerText = `Welcome, ${username}!`;

    const initialEl = document.getElementById("userInitial");
    if (initialEl) initialEl.innerText = initial;

    const chatHeaderEl = document.getElementById("chatHeaderUsernameText");
    if (chatHeaderEl) chatHeaderEl.innerText = username;
}

onAuthStateChanged(auth, async (user) => {
    try {
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                currentUser = {
                    uid: user.uid,
                    username: userData.fname || user.displayName || "User"
                };
                console.log("User loaded:", currentUser);
                updateUserInfo(currentUser.username, currentUser.username.charAt(0).toUpperCase());
            } else {
                console.warn("User document not found in Firestore");
                currentUser = { uid: user.uid, username: user.displayName || "User" };
                updateUserInfo(currentUser.username, currentUser.username.charAt(0).toUpperCase() || "U");
            }
        } else {
            if (isGuestUser()) {
                console.log("Guest access active in chat");
                currentUser = { uid: "guest", username: "Guest" };
                updateUserInfo("Guest", "G");

                // Restriction for guest: Disable chat input
                const messageInput = document.getElementById("message-input");
                const sendButton = document.getElementById("send-button");
                if (messageInput) {
                    messageInput.disabled = true;
                    messageInput.placeholder = "Sign in to chat";
                    messageInput.style.transition = "all 0.5s ease-in-out";
                    messageInput.style.opacity = "0.5";
                    messageInput.classList.add("cursor-not-allowed");
                }
                if (sendButton) {
                    sendButton.disabled = true;
                    sendButton.style.transition = "all 0.5s ease-in-out";
                    sendButton.style.opacity = "0.5";
                    sendButton.classList.add("cursor-not-allowed");
                }
                return;
            }

            console.log("No user or guest access, redirecting to index.html");
            window.location.href = "/index.html";
        }
    } catch (error) {
        console.error("Error in auth state change:", error);
    }
});

// Send message
document.getElementById("chat-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    
    // Hardened Guest Check: Prevent bypass via DevTools
    if (isGuestUser() || !currentUser || currentUser.uid === "guest") {
        alert("You're in guest mode. Sign in to send messages.");
        return;
    }
    
    // Check chat limit before sending
    if (!canSendMessage()) {
        return;
    }

    const messageInput = document.getElementById("message-input");
    const messageText = messageInput.value.trim();
    if (messageText && currentUser) {
        try {
            const messageData = {
                uid: currentUser.uid,
                username: currentUser.username,
                text: messageText,
                timestamp: Date.now(),
                reported: false,
                deleted: false
            };
            await push(messagesRef, messageData);
            console.log("Message sent:", messageData);
            messageInput.value = ""; // Clear input
            
            // Increment chat count after successful send
            incrementChatCount();
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message: " + error.message);
        }
    } else {
        console.warn("Cannot send message: Empty text or user not loaded");
        if (!messageText) {
            alert("Please enter a message.");
        } else if (!currentUser) {
            alert("User data is still loading, please wait.");
        }
    }
});

// Helper to escape HTML and prevent injection
function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Display messages in real-time
onValue(messagesRef, (snapshot) => {
    const messageList = document.getElementById("message-list");
    if (!messageList) return;
    messageList.innerHTML = ""; // Clear existing messages
    try {
        const messages = snapshot.val();
        const searchQuery = document.getElementById("search-input")?.value.toLowerCase().trim() || "";
        if (messages) {
            console.log("Messages fetched:", Object.keys(messages).length, "messages");
            // Sort messages by timestamp
            const sortedMessages = Object.entries(messages).sort((a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0));
            sortedMessages.forEach(([key, message]) => {
                if (message.username && message.timestamp) {
                    // Skip if message doesn't match search query
                    if (searchQuery && !(message.text?.toLowerCase().includes(searchQuery) || message.username.toLowerCase().includes(searchQuery))) {
                        return;
                    }
                    const li = document.createElement("li");
                    const isOwnMessage = currentUser && (
                        (message.uid && message.uid === currentUser.uid) ||
                        message.username === currentUser.username
                    );
                    let messageText = message.deleted ? '<i>This message was deleted</i>' : escapeHtml(message.text);
                    // Highlight search query
                    if (searchQuery && !message.deleted) {
                        const regex = new RegExp(`(${searchQuery.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')})`, 'gi');
                        messageText = messageText.replace(regex, '<span class="bg-yellow-500/30">$1</span>');
                    }
                    li.innerHTML = `
                        <div class="message ${isOwnMessage ? 'message-sent' : 'message-received'}">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="avatar">${escapeHtml(message.username.charAt(0).toUpperCase())}</span>
                                    <div class="username">${escapeHtml(message.username)}</div>
                                </div>
                                <div class="relative">
                                    <button class="menu-btn text-gray-400 hover:text-white" data-message-id="${key}">
                                        <i class="bi bi-three-dots-vertical"></i>
                                    </button>
                                    <ul class="menu hidden absolute right-0 mt-2 w-32 bg-gray-800 border border-indigo-500/30 rounded-lg shadow-lg z-10">
                                        ${isOwnMessage && !message.deleted ? `
                                            <li>
                                                <button class="delete-btn w-full text-left px-4 py-2 text-white hover:bg-indigo-600" data-message-id="${key}">Delete</button>
                                            </li>
                                        ` : ''}
                                        <li>
                                            <button class="report-btn w-full text-left px-4 py-2 text-white hover:bg-indigo-600" data-message-id="${key}">Report</button>
                                        </li>
                                    </ul>
                                </div>
                            </div>
                            <div class="text">${messageText}</div>
                            <div class="timestamp flex items-center gap-2">
                                ${new Date(message.timestamp).toLocaleString()}
                                ${message.reported ? '<span class="w-2 h-2 bg-red-500 rounded-full" title="Reported"></span>' : ''}
                            </div>
                            <div class="reactions flex gap-2 mt-2">
                                <!-- Reactions will be populated by message.js -->
                            </div>
                        </div>
                    `;
                    messageList.appendChild(li);
                } else {
                    console.warn("Skipping invalid message:", message);
                }
            });
            messageList.scrollTop = messageList.scrollHeight; // Auto-scroll to bottom
        } else {
            console.log("No messages in database");
            messageList.innerHTML = "<li class='text-center text-gray-400'>No messages yet. Start the conversation!</li>";
        }
    } catch (error) {
        console.error("Error processing messages:", error);
        messageList.innerHTML = "<li class='text-center text-red-400'>Failed to load messages.</li>";
    }
}, (error) => {
    console.error("Error in onValue listener:", error);
    const messageList = document.getElementById("message-list");
    if (messageList) {
        messageList.innerHTML = "<li class='text-center text-red-400'>Error fetching messages. Please refresh the page.</li>";
    }
});