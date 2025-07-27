import { getDatabase, ref, push, update } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";
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
        const reportData = {
            messageId: currentMessageId,
            reporterUid: auth.currentUser.uid,
            reason: reason,
            timestamp: Date.now()
        };

        // Store report in Firebase
        await push(ref(db, 'reports'), reportData);

        // Mark message as reported
        await update(ref(db, `messages/${currentMessageId}`), { reported: true });

        console.log('Message reported:', reportData);
        reportModal.hide();
        document.getElementById('reportReason').value = ''; // Reset dropdown
        alert('Message reported successfully.');
    } catch (error) {
        console.error('Error reporting message:', error);
        alert('Failed to report message: ' + error.message);
    }
});