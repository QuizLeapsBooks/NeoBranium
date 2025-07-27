import { getDatabase, ref, set, get, update, onValue } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const db = getDatabase();
const auth = getAuth();

// Delete Message
document.addEventListener('click', async (e) => {
    const deleteBtn = e.target.closest('.delete-btn');
    if (deleteBtn) {
        const messageId = deleteBtn.dataset.messageId;
        try {
            await update(ref(db, `messages/${messageId}`), { deleted: true });
            console.log('Message deleted:', messageId);
            alert('Message deleted successfully.');
        } catch (error) {
            console.error('Error deleting message:', error);
            alert('Failed to delete message: ' + error.message);
        }
    }
});

// Message Reactions
document.addEventListener('click', (e) => {
    const message = e.target.closest('.message');
    const reactionBtn = e.target.closest('.reaction-btn');
    const reactionPicker = e.target.closest('.message')?.querySelector('.reaction-picker');

    // Close all open reaction pickers
    document.querySelectorAll('.reaction-picker.show').forEach(picker => {
        if (picker !== reactionPicker) picker.classList.remove('show');
    });

    if (message && !reactionBtn && !e.target.closest('.menu-btn') && !e.target.closest('.menu')) {
        // Toggle reaction picker on message click (except menu or reaction buttons)
        reactionPicker?.classList.toggle('show');
    } else if (reactionBtn) {
        // Handle reaction submission
        const messageId = reactionBtn.dataset.messageId;
        const emoji = reactionBtn.dataset.emoji;
        if (!messageId || !auth.currentUser) {
            alert('Error: Unable to add reaction. Please try again.');
            return;
        }

        // Check if user has already reacted
        const reactionRef = ref(db, `reactions/${messageId}/${auth.currentUser.uid}`);
        get(reactionRef).then(snapshot => {
            if (snapshot.exists()) {
                alert('You have already reacted to this message.');
                return;
            }

            // Store reaction
            set(reactionRef, {
                emoji: emoji,
                timestamp: Date.now()
            }).then(() => {
                console.log('Reaction added:', { messageId, userId: auth.currentUser.uid, emoji });
            }).catch(error => {
                console.error('Error adding reaction:', error);
                alert('Failed to add reaction: ' + error.message);
            });
        }).catch(error => {
            console.error('Error checking reaction:', error);
            alert('Failed to check reaction: ' + error.message);
        });
    } else {
        // Close reaction picker if clicking outside
        document.querySelectorAll('.reaction-picker.show').forEach(picker => picker.classList.remove('show'));
    }
});

// Update reactions display
const updateReactions = (messageId, reactionsDiv) => {
    const reactionsRef = ref(db, `reactions/${messageId}`);
    onValue(reactionsRef, (snapshot) => {
        const reactions = snapshot.val();
        if (reactions) {
            const reactionCounts = { '👍': 0, '👎': 0, '😄': 0 };
            Object.values(reactions).forEach(reaction => {
                if (reaction.emoji) reactionCounts[reaction.emoji]++;
            });
            reactionsDiv.innerHTML = Object.entries(reactionCounts)
                .filter(([_, count]) => count > 0)
                .map(([emoji, count]) => `${emoji} ${count}`)
                .join(' ');
        } else {
            reactionsDiv.innerHTML = '';
        }
    });
};

// Initialize reaction pickers and listeners
document.addEventListener('DOMContentLoaded', () => {
    const messageList = document.getElementById('message-list');
    // Watch for changes in message list to add reaction pickers
    const observer = new MutationObserver(() => {
        document.querySelectorAll('.message').forEach(message => {
            const messageId = message.querySelector('.menu-btn').dataset.messageId;
            let reactionsDiv = message.querySelector('.reactions');
            if (!reactionsDiv.dataset.initialized) {
                // Add reaction picker
                const picker = document.createElement('div');
                picker.className = 'reaction-picker hidden absolute left-0 bottom-[-40px] bg-gray-800 border border-indigo-500/30 rounded-lg shadow-lg z-10 flex gap-2 p-2';
                picker.innerHTML = `
                    <button class="reaction-btn text-xl" data-message-id="${messageId}" data-emoji="👍">👍</button>
                    <button class="reaction-btn text-xl" data-message-id="${messageId}" data-emoji="👎">👎</button>
                    <button class="reaction-btn text-xl" data-message-id="${messageId}" data-emoji="😄">😄</button>
                `;
                message.appendChild(picker);
                // Update reactions display
                updateReactions(messageId, reactionsDiv);
                reactionsDiv.dataset.initialized = true;
            }
        });
    });
    observer.observe(messageList, { childList: true, subtree: true });
});

// Search Messages (client-side)
document.getElementById('search-input')?.addEventListener('input', () => {
    // Trigger re-render by updating messages (handled in index.html onValue)
    document.getElementById('message-list').dispatchEvent(new Event('input'));
});