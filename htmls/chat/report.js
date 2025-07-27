import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";

const db = getDatabase();
const auth = getAuth();
const reportModal = new bootstrap.Modal(document.getElementById('reportModal'));
let currentMessageId = null;

document.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('.menu-btn');
    const reportBtn = e.target.closest('.report-btn');
    const menu = e.target.closest('.menu-btn')?.nextElementSibling;

    // Close all open menus
    document.querySelectorAll('.menu.show').forEach(m => {
        if (m !== menu) m.classList.remove('show');
    });

    if (menuBtn) {
        menu.classList.toggle('show');
    } else if (reportBtn) {
        currentMessageId = reportBtn.dataset.messageId;
        reportModal.show();
    } else {
        // Close menu if clicking outside
        document.querySelectorAll('.menu.show').forEach(m => m.classList.remove('show'));
    }
});

document.getElementById('submitReport').addEventListener('click', async () => {
    const reason = document.getElementById('reportReason').value;
    if (!reason) {
        alert('Please select a reason for reporting.');
        return;
    }

    if (!currentMessageId || !auth.currentUser) {
        alert('Error: Unable to report message. Please try again.');
        return;
    }

    try {
        const reportRef = ref(db, `reports/${currentMessageId}/${auth.currentUser.uid}`);
        
        // Check if user has already reported this message
        const reportSnapshot = await get(reportRef);
        if (reportSnapshot.exists()) {
            alert('You have already reported this message.');
            reportModal.hide();
            return;
        }

        // Store report in Firebase
        await set(reportRef, {
            reason: reason,
            timestamp: Date.now()
        });

        // Mark message as reported
        await update(ref(db, `messages/${currentMessageId}`), { reported: true });

        console.log('Message reported:', { messageId: currentMessageId, userId: auth.currentUser.uid, reason });
        reportModal.hide();
        document.getElementById('reportReason').value = ''; // Reset dropdown
        alert('Message reported successfully.');
    } catch (error) {
        console.error('Error reporting message:', error);
        alert('Failed to report message: ' + error.message);
    }
});