import { auth, loadUserData } from './auth.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

// Initialize Realtime Database
const db = getDatabase();

// Initialize comment handling
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User logged in for comments:", user.uid);
            loadUserData(user).then(userData => {
                initializeCommentSections(user, userData);
            });
        } else {
            console.warn("No user logged in. Disabling comment inputs.");
            disableCommentInputs();
        }
    });
});

// Disable comment inputs if user is not logged in
function disableCommentInputs() {
    document.querySelectorAll('.comment-input, .comment-submit').forEach(element => {
        element.disabled = true;
        element.classList.add('disabled');
        if (element.tagName === 'INPUT') {
            element.placeholder = "Please log in to comment";
        }
    });
}

// Initialize comment sections for each note card
function initializeCommentSections(user, userData) {
    document.querySelectorAll('.notes-cards').forEach(card => {
        const noteId = card.getAttribute('data-note-id');
        const commentInput = card.querySelector(`#comment-input-${noteId}`);
        const commentSubmit = card.querySelector(`#comment-submit-${noteId}`);
        const commentList = card.querySelector(`#comment-list-${noteId}`);

        if (!commentInput || !commentSubmit || !commentList) {
            console.error(`Comment elements missing for note ${noteId}:`, { commentInput, commentSubmit, commentList });
            return;
        }

        // Load comments in real-time
        loadComments(noteId, commentList);

        // Handle comment submission
        commentSubmit.addEventListener('click', async () => {
            const commentText = commentInput.value.trim();
            if (commentText === '') {
                console.warn(`Empty comment for note ${noteId}`);
                return;
            }

            try {
                commentSubmit.disabled = true;
                await postComment(noteId, user.uid, userData.username || user.displayName || 'User', commentText);
                commentInput.value = ''; // Clear input
                console.log(`Comment posted for note ${noteId}`);
            } catch (error) {
                console.error(`Error posting comment for ${noteId}:`, error);
            } finally {
                commentSubmit.disabled = false;
            }
        });

        // Allow submitting with Enter key
        commentInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                commentSubmit.click();
            }
        });
    });
}

// Post a comment to Realtime Database
async function postComment(noteId, userId, username, text) {
    const commentRef = ref(db, `notes/${noteId}/comments`);
    const newCommentRef = push(commentRef); // Generate unique comment ID
    await set(newCommentRef, {
        username: username,
        text: text,
        timestamp: Date.now(),
        reported: false,
        deleted: false
    });
}

// Load and display comments in real-time
function loadComments(noteId, commentList) {
    const commentsRef = ref(db, `notes/${noteId}/comments`);
    onValue(commentsRef, (snapshot) => {
        commentList.innerHTML = ''; // Clear existing comments
        if (snapshot.exists()) {
            snapshot.forEach(childSnapshot => {
                const comment = childSnapshot.val();
                if (!comment.deleted) {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${escapeHtml(comment.username)}:</strong> ${escapeHtml(comment.text)} <br><small>${new Date(comment.timestamp).toLocaleString()}</small>`;
                    commentList.appendChild(li);
                }
            });
        } else {
            commentList.innerHTML = '<li>No comments yet.</li>';
        }
    }, (error) => {
        console.error(`Error loading comments for ${noteId}:`, error);
        commentList.innerHTML = '<li>Error loading comments.</li>';
    });
}

// Escape HTML to prevent XSS
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}