import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getDatabase, ref, push, onValue, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Firebase config
const firebaseConfig = {
    apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
    authDomain: "neobranium.firebaseapp.com",
    projectId: "neobranium",
    storageBucket: "neobranium.appspot.com",
    messagingSenderId: "59188872045",
    appId: "1:59188872045:web:450a70b28e4be5db335064",
    databaseURL: "https://neobranium-default-rtdb.firebaseio.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const rtdb = getDatabase(app);
const messagesRef = ref(rtdb, "messages");

// Check auth state and get username
let currentUser = null;
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
                document.getElementById("usernameDisplay").innerText = `Welcome, ${currentUser.username}!`;
                document.getElementById("userInitial").innerText = currentUser.username.charAt(0).toUpperCase();
            } else {
                console.warn("User document not found in Firestore");
                currentUser = { uid: user.uid, username: "User" };
                document.getElementById("usernameDisplay").innerText = `Welcome, ${currentUser.username}!`;
                document.getElementById("userInitial").innerText = "U";
            }
        } else {
            console.log("No user logged in, redirecting to index.html");
            window.location.href = "/index.html";
        }
    } catch (error) {
        console.error("Error in auth state change:", error);
        alert("Error loading user data: " + error.message);
    }
});

// Send message
document.getElementById("chat-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const messageInput = document.getElementById("message-input");
    const messageText = messageInput.value.trim();
    if (messageText && currentUser) {
        try {
            const messageData = {
                username: currentUser.username,
                text: messageText,
                timestamp: Date.now(),
                reported: false,
                deleted: false
            };
            await push(messagesRef, messageData);
            console.log("Message sent:", messageData);
            messageInput.value = ""; // Clear input
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

// Display messages in real-time
onValue(messagesRef, (snapshot) => {
    const messageList = document.getElementById("message-list");
    messageList.innerHTML = ""; // Clear existing messages
    try {
        const messages = snapshot.val();
        const searchQuery = document.getElementById("search-input")?.value.toLowerCase() || "";
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
                    const isOwnMessage = message.username === currentUser?.username;
                    let messageText = message.deleted ? '<i>This message was deleted</i>' : message.text;
                    // Highlight search query
                    if (searchQuery && messageText !== '<i>This message was deleted</i>') {
                        const regex = new RegExp(`(${searchQuery})`, 'gi');
                        messageText = messageText.replace(regex, '<span class="bg-yellow-500/30">$1</span>');
                    }
                    li.innerHTML = `
                        <div class="message ${isOwnMessage ? 'message-sent' : 'message-received'}">
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2">
                                    <span class="avatar">${message.username.charAt(0).toUpperCase()}</span>
                                    <div class="username">${message.username}</div>
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
                                ${message.reported ? '<span class="w-2 h-2 bg-red-500 rounded-full"></span>' : ''}
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
            messageList.innerHTML = "<li class='text-center text-gray-400'>No messages yet.</li>";
        }
    } catch (error) {
        console.error("Error processing messages:", error);
        messageList.innerHTML = "<li class='text-center text-red-400'>Failed to load messages.</li>";
    }
}, {
    onlyOnce: false // Ensure real-time updates
}, (error) => {
    console.error("Error in onValue listener:", error);
    document.getElementById("message-list").innerHTML = "<li class='text-center text-red-400'>Error fetching messages.</li>";
});