import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, EmailAuthProvider, reauthenticateWithCredential, updatePassword, updateProfile } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getFirestore, getDoc, doc, setDoc } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { getStorage, ref, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-storage.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
    authDomain: "neobranium.firebaseapp.com",
    projectId: "neobranium",
    storageBucket: "neobranium.appspot.com",
    messagingSenderId: "59188872045",
    appId: "1:59188872045:web:450a70b28e4be5db335064",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth();
export const db = getFirestore();
export const storage = getStorage();

export async function loadUserData(user) {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        const userData = userDoc.exists() ? userDoc.data() : { username: user.displayName || "User", fname: "", lname: "", bio: "", notificationPref: "all" };
        return { ...userData, email: user.email, photoURL: user.photoURL };
    } catch (error) {
        console.error("Error loading user data:", error);
        return { username: user.displayName || "User", fname: "", lname: "", bio: "", notificationPref: "all", email: user.email };
    }
}

export function updateUserDisplay(userData, user) {
    const usernameDisplay = document.getElementById("usernameDisplay");
    const initialAvatar = document.getElementById("initialAvatar");
    if (usernameDisplay) {
        usernameDisplay.textContent = `Welcome, ${userData.username || user.displayName || "User"}!`;
    }
    if (initialAvatar) {
        if (userData.photoURL) {
            initialAvatar.style.backgroundImage = `url(${userData.photoURL})`;
            initialAvatar.style.backgroundSize = "cover";
            initialAvatar.textContent = "";
        } else {
            initialAvatar.textContent = (userData.username || user.displayName || "User").charAt(0).toUpperCase();
        }
    }
    const userInitial = document.getElementById("userInitial");
    if (userInitial) {
        userInitial.textContent = (userData.username || user.displayName || "User").charAt(0).toUpperCase();
    }
    const userBioText = document.getElementById("userBioText");
    if (userBioText) {
        userBioText.textContent = userData.bio || "--Your Bio--";
    }
}

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            localStorage.setItem("loggedInUserId", user.uid);
            const userData = await loadUserData(user);
            updateUserDisplay(userData, user);
            document.dispatchEvent(new CustomEvent("userLoaded", { detail: { user, userData } }));
        } else {
            localStorage.removeItem("loggedInUserId");
            window.location.href = "/index.html";
        }
    });

    const logout = document.getElementById("logout");
    if (logout) {
        logout.addEventListener("click", async () => {
            try {
                await signOut(auth);
                localStorage.removeItem("loggedInUserId");
                window.location.href = "/index.html";
            } catch (error) {
                console.error("Logout Error:", error);
                showStatus("Failed to logout: " + error.message, true);
            }
        });
    }
});

export async function updateUserProfile(user, field, value) {
    try {
        await setDoc(doc(db, "users", user.uid), { [field]: value }, { merge: true });
        if (field === "username") {
            await updateProfile(user, { displayName: value });
        }
        return true;
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        throw error;
    }
}

export async function changeUserPassword(user, currentPassword, newPassword) {
    try {
        const credential = EmailAuthProvider.credential(user.email, currentPassword);
        await reauthenticateWithCredential(user, credential);
        await updatePassword(user, newPassword);
        return true;
    } catch (error) {
        console.error("Error changing password:", error);
        throw error;
    }
}

export function showStatus(msg, isError = false) {
    const statusDiv = document.getElementById("status");
    if (statusDiv) {
        statusDiv.textContent = msg;
        statusDiv.className = `status text-sm text-center ${isError ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`;
        statusDiv.style.opacity = "1";
        setTimeout(() => (statusDiv.style.opacity = "0"), 3000);
        setTimeout(() => (statusDiv.textContent = ""), 3300);
    } else {
        console.warn("Status div not found!");
    }
}

document.addEventListener("DOMContentLoaded", function() {
    // Check if the screen width is less than 768px (typical for mobile devices)
    if (window.innerWidth <= 768) {
        // Get the document element
        const elem = document.documentElement;
        
        // Request full screen mode
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.mozRequestFullScreen) { // Firefox
            elem.mozRequestFullScreen();
        } else if (elem.webkitRequestFullscreen) { // Chrome, Safari, Opera
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) { // IE/Edge
            elem.msRequestFullscreen();
        }
    }
});