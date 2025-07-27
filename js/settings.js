const firebaseConfig = {
    apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
    authDomain: "neobranium.firebaseapp.com",
    projectId: "neobranium",
    storageBucket: "neobranium.appspot.com",
    messagingSenderId: "59188872045",
    appId: "1:59188872045:web:450a70b28e4be5db335064",
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const initialAvatar = document.getElementById('initialAvatar');
const firstNameInput = document.getElementById('firstName');
const saveFirstNameBtn = document.getElementById('saveFirstNameBtn');
const lastNameInput = document.getElementById('lastName');
const saveLastNameBtn = document.getElementById('saveLastNameBtn');
const usernameInput = document.getElementById('username');
const saveUsernameBtn = document.getElementById('saveUsernameBtn');
const bioInput = document.getElementById('bio');
const saveBioBtn = document.getElementById('saveBioBtn');
const notificationPref = document.getElementById('notificationPref');
const saveNotificationBtn = document.getElementById('saveNotificationBtn');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const themeSwitch = document.getElementById('themeSwitch');
const logoutBtn = document.getElementById('logoutBtn');
const statusDiv = document.getElementById('status');

let currentUser = null;
auth.onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = '/index.html';
        return;
    }
    currentUser = user;
    const displayName = user.displayName || 'User';
    document.getElementById('usernameDisplay').textContent = `Welcome, ${displayName}!`;
    if (user.photoURL) {
        initialAvatar.style.backgroundImage = `url(${user.photoURL})`;
        initialAvatar.style.backgroundSize = 'cover';
        initialAvatar.textContent = '';
    } else {
        initialAvatar.textContent = displayName.charAt(0).toUpperCase();
    }
    try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
            const data = userDoc.data();
            firstNameInput.value = data.fname || '';
            lastNameInput.value = data.lname || '';
            usernameInput.value = data.username || displayName;
            bioInput.value = data.bio || '';
            notificationPref.value = data.notificationPref || 'all';
        }
    } catch (err) {
        showStatus('Failed to load user data: ' + err.message, true);
    }
});

themeSwitch.addEventListener('change', () => {
    document.body.classList.toggle('dark', themeSwitch.checked);
    localStorage.setItem('theme', themeSwitch.checked ? 'dark' : 'light');
});
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    themeSwitch.checked = true;
}

saveFirstNameBtn.addEventListener('click', async () => {
    const fname = firstNameInput.value.trim();
    if (!fname) return showStatus('First Name can’t be empty, bro!', true);
    if (fname.length < 2) return showStatus('First Name too short, make it 2+ chars!', true);
    try {
        await db.collection('users').doc(currentUser.uid).set({ fname }, { merge: true });
        showStatus('First Name updated, looking good!');
        console.log("Updated fname:", fname);
    } catch (err) {
        showStatus('Failed to update First Name: ' + err.message, true);
        console.error("Error updating fname:", err);
    }
});

saveLastNameBtn.addEventListener('click', async () => {
    const lname = lastNameInput.value.trim();
    if (!lname) return showStatus('Last Name can’t be empty, fam!', true);
    if (lname.length < 2) return showStatus('Last Name too short, make it 2+ chars!', true);
    try {
        await db.collection('users').doc(currentUser.uid).set({ lname }, { merge: true });
        showStatus('Last Name updated, nice!');
        console.log("Updated lname:", lname);
    } catch (err) {
        showStatus('Failed to update Last Name: ' + err.message, true);
        console.error("Error updating lname:", err);
    }
});

saveUsernameBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) return showStatus('Username can’t be empty, fam!', true);
    if (username.length < 3) return showStatus('Username too short, make it 3+ chars!', true);
    try {
        await db.collection('users').doc(currentUser.uid).set({ username }, { merge: true });
        await currentUser.updateProfile({ displayName: username });
        showStatus('Username updated, nice!');
    } catch (err) {
        showStatus('Failed to update username: ' + err.message, true);
    }
});

saveBioBtn.addEventListener('click', async () => {
    const bio = bioInput.value.trim();
    if (bio.length > 150) return showStatus('Bio too long, keep it under 150 chars!', true);
    try {
        await db.collection('users').doc(currentUser.uid).set({ bio }, { merge: true });
        showStatus('Bio updated, vibes on point!');
    } catch (err) {
        showStatus('Failed to update bio: ' + err.message, true);
    }
});

saveNotificationBtn.addEventListener('click', async () => {
    const notificationPrefValue = notificationPref.value;
    try {
        await db.collection('users').doc(currentUser.uid).set({ notificationPref: notificationPrefValue }, { merge: true });
        showStatus('Notification preferences updated, you’re all set!');
    } catch (err) {
        showStatus('Failed to update notification preferences: ' + err.message, true);
    }
});

changePasswordBtn.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    if (!currentPassword || !newPassword) return showStatus('Fill both password fields, yo!', true);
    if (newPassword.length < 6) return showStatus('New password needs 6+ chars!', true);
    try {
        const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, currentPassword);
        await currentUser.reauthenticateWithCredential(cred);
        await currentUser.updatePassword(newPassword);
        currentPasswordInput.value = '';
        newPasswordInput.value = '';
        showStatus('Password changed, you’re locked in!');
    } catch (err) {
        showStatus('Failed to change password: ' + err.message, true);
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await auth.signOut();
        showStatus('Logged out, catch ya later!');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 1500);
    } catch (err) {
        showStatus('Failed to logout: ' + err.message, true);
    }
});

function showStatus(msg, isError = false) {
    statusDiv.textContent = msg;
    statusDiv.className = `status text-sm text-center ${isError ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`;
    statusDiv.style.opacity = '1';
    setTimeout(() => statusDiv.style.opacity = '0', 3000);
    setTimeout(() => statusDiv.textContent = '', 3300);
}