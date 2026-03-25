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
            localStorage.removeItem("guestMode"); // Clear guest mode if logged in
            
            // Set startTime if not already set
            if (!localStorage.getItem("startTime")) {
                localStorage.setItem("startTime", Date.now().toString());
            }

            const userData = await loadUserData(user);
            updateUserDisplay(userData, user);
            document.dispatchEvent(new CustomEvent("userLoaded", { detail: { user, userData } }));
        } else {
            const isGuest = localStorage.getItem("guestMode") === "true";
            const accessGranted = localStorage.getItem("accessGranted") === "true";

            if (isGuest && accessGranted) {
                console.log("Guest access active");
                
                // Set startTime if not already set
                if (!localStorage.getItem("startTime")) {
                    localStorage.setItem("startTime", Date.now().toString());
                }

                // Redirect guest away from profile and settings
                const path = window.location.pathname;
                if (path.includes("profile.html") || path.includes("setting.html")) {
                    console.log("Guest tried to access restricted page, redirecting to sign.html");
                    window.location.href = "/htmls/sign.html";
                    return;
                }

                updateUserDisplay({ username: "Guest", bio: "Browsing as Guest" }, { displayName: "Guest" });
                return;
            }
            localStorage.removeItem("loggedInUserId");
            // Only redirect if not already on index.html
            const path = window.location.pathname;
            if (path !== "/index.html" && path !== "/" && !path.endsWith("index.html")) {
                window.location.href = "/index.html";
            }
        }
    });

    // --- Usage Limit System ---
    const checkUsageLimit = () => {
        const startTime = localStorage.getItem("startTime");
        if (!startTime) return;

        const totalUsageMs = Date.now() - parseInt(startTime);
        const totalUsageMin = Math.floor(totalUsageMs / 60000);

        if (totalUsageMin >= 60) {
            localStorage.clear();
            alert("Time limit finished");
            window.location.href = "/index.html";
        }
    };

    // Check immediately and then every 1 minute
    checkUsageLimit();
    setInterval(checkUsageLimit, 60000);
    // --------------------------

    const logout = document.getElementById("logout");
    if (logout) {
        logout.addEventListener("click", async () => {
            try {
                if (localStorage.getItem("guestMode") === "true") {
                    localStorage.removeItem("guestMode");
                    localStorage.removeItem("accessGranted");
                    window.location.href = "/index.html";
                    return;
                }
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

// Removed semi-intrusive full-screen request on page load