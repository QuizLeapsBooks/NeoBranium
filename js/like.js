import { db, auth } from './auth.js';
import { doc, getDoc, setDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

// Initialize reaction handling for like/dislike buttons
document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("User logged in:", user.uid);
            initializeReactionButtons(user);
        } else {
            console.warn("No user logged in. Disabling reaction buttons.");
            disableReactionButtons();
        }
    });
});

// Disable buttons if user is not logged in
function disableReactionButtons() {
    document.querySelectorAll('.like-btn, .dislike-btn').forEach(button => {
        button.disabled = true;
        button.classList.add('disabled');
        button.title = "Please log in to react";
    });
}

// Initialize like/dislike buttons for each note card
function initializeReactionButtons(user) {
    document.querySelectorAll('.notes-cards').forEach(card => {
        const noteId = card.getAttribute('data-note-id');
        const likeBtn = card.querySelector(`#like-${noteId}`);
        const dislikeBtn = card.querySelector(`#dislike-${noteId}`);
        const reactionCount = card.querySelector(`#reaction-count-${noteId}`);

        if (!likeBtn || !dislikeBtn || !reactionCount) {
            console.error(`Elements missing for note ${noteId}:`, { likeBtn, dislikeBtn, reactionCount });
            return;
        }

        // Load initial reaction data
        loadReactionData(noteId, reactionCount, user, likeBtn, dislikeBtn);

        // Like button event
        likeBtn.addEventListener('click', async () => {
            console.log(`Like button clicked for note ${noteId} by user ${user.uid}`);
            await handleReaction(noteId, user.uid, 'like', reactionCount, likeBtn, dislikeBtn);
        });

        // Dislike button event
        dislikeBtn.addEventListener('click', async () => {
            console.log(`Dislike button clicked for note ${noteId} by user ${user.uid}`);
            await handleReaction(noteId, user.uid, 'dislike', reactionCount, likeBtn, dislikeBtn);
        });
    });
}

// Load reaction data from Firestore and update UI
async function loadReactionData(noteId, reactionCount, user, likeBtn, dislikeBtn) {
    try {
        const reactionRef = doc(db, 'reactions', noteId);
        const reactionSnap = await getDoc(reactionRef);
        let likes = 0, dislikes = 0, userReaction = null;

        if (reactionSnap.exists()) {
            const data = reactionSnap.data();
            likes = data.likes || 0;
            dislikes = data.dislikes || 0;
            userReaction = data.users?.[user.uid] || null;
            console.log(`Loaded data for ${noteId}:`, { likes, dislikes, userReaction });
        } else {
            console.log(`No reaction data for ${noteId}. Initializing with zeros.`);
        }

        // Update UI
        reactionCount.textContent = `Likes: ${likes} | Dislikes: ${dislikes}`;
        updateButtonStyles(likeBtn, dislikeBtn, userReaction);
    } catch (error) {
        console.error(`Error loading reaction data for ${noteId}:`, error);
    }
}

// Handle like/dislike reaction
async function handleReaction(noteId, userId, reactionType, reactionCount, likeBtn, dislikeBtn) {
    try {
        const reactionRef = doc(db, 'reactions', noteId);
        const reactionSnap = await getDoc(reactionRef);
        let updates = {};
        let userReaction = null;

        // Disable buttons during operation
        likeBtn.disabled = true;
        dislikeBtn.disabled = true;

        if (reactionSnap.exists()) {
            userReaction = reactionSnap.data().users?.[userId] || null;
            console.log(`Current user reaction for ${noteId}:`, userReaction);
        }

        // Handle reaction logic
        if (userReaction === reactionType) {
            // Undo reaction
            console.log(`Undoing ${reactionType} for ${noteId}`);
            updates = {
                [reactionType + 's']: increment(-1),
                [`users.${userId}`]: null
            };
            userReaction = null;
        } else {
            // New reaction or switch
            console.log(`Applying ${reactionType} for ${noteId}`);
            updates = {
                [`users.${userId}`]: reactionType
            };
            if (userReaction) {
                // Undo previous reaction
                updates[userReaction + 's'] = increment(-1);
            }
            updates[reactionType + 's'] = increment(1);
        }

        // Update or create Firestore document
        if (!reactionSnap.exists()) {
            console.log(`Creating new reaction document for ${noteId}`);
            await setDoc(reactionRef, {
                likes: reactionType === 'like' ? 1 : 0,
                dislikes: reactionType === 'dislike' ? 1 : 0,
                users: { [userId]: reactionType }
            });
        } else {
            console.log(`Updating reaction document for ${noteId}`);
            await updateDoc(reactionRef, updates);
        }

        // Reload data to update UI
        await loadReactionData(noteId, reactionCount, { uid: userId }, likeBtn, dislikeBtn);
    } catch (error) {
        console.error(`Error handling ${reactionType} for ${noteId}:`, error);
    } finally {
        // Re-enable buttons
        likeBtn.disabled = false;
        dislikeBtn.disabled = false;
    }
}

// Update button styles based on user reaction
function updateButtonStyles(likeBtn, dislikeBtn, userReaction) {
    likeBtn.classList.toggle('btn-success', userReaction === 'like');
    likeBtn.classList.toggle('btn-outline-success', userReaction !== 'like');
    dislikeBtn.classList.toggle('btn-danger', userReaction === 'dislike');
    dislikeBtn.classList.toggle('btn-outline-danger', userReaction !== 'dislike');
    console.log('Button styles updated:', { likeActive: userReaction === 'like', dislikeActive: userReaction === 'dislike' });
}