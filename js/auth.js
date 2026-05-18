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

// Initialize Firebase (Singleton pattern)
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };

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

export async function verifyBoardAccess() {
    try {
        const resp = await fetch('/api/board-queue-status', {
            credentials: 'include'
        });
        if (!resp.ok) return { allowed: false, reason: 'server_error' };
        const data = await resp.json();
        
        // If limit reached, server will have returned 429 on actual API calls
        // This is just for UI display
        return { 
            allowed: true, 
            minutesUsed: data.sessionData?.minutesUsed || 0,
            remainingMinutes: data.sessionData?.remainingMinutes || 20
        };
    } catch(e) {
        return { allowed: true }; // Fail open for UX
    }
}

export function isGuestUser() {
    if (auth.currentUser) return false;
    
    // UI flag: User must have explicitly opted into guest mode for this tab session
    return sessionStorage.getItem('isGuestMode') === 'true';
}

export async function checkAccess(requiredAuth = false) {
    if (requiredAuth && isGuestUser()) {
        console.info("Guest access restriction: Redirecting to sign-in page.");
        window.location.href = "/htmls/sign.html";
        return false;
    }
    return true;
}

function injectGuestBanner() {
    if (!document.getElementById("guest-banner")) {
        const banner = document.createElement("div");
        banner.id = "guest-banner";
        banner.innerHTML = "You're in guest mode. <a href='/htmls/sign.html' style='color: #a5b4fc; text-decoration: underline; font-weight: bold; margin-left: 5px; transition: color 0.3s ease;'>Sign in</a> to unlock all features.";
        
        banner.style.position = "fixed";
        banner.style.top = "15px";
        banner.style.left = "50%";
        banner.style.transform = "translateX(-50%)";
        banner.style.background = "rgba(15, 23, 42, 0.7)";
        banner.style.backdropFilter = "blur(12px)";
        banner.style.webkitBackdropFilter = "blur(12px)";
        banner.style.border = "1px solid rgba(99, 102, 241, 0.3)";
        banner.style.boxShadow = "0 8px 32px rgba(0, 0, 0, 0.2)";
        banner.style.color = "#e2e8f0";
        banner.style.padding = "8px 24px";
        banner.style.borderRadius = "20px";
        banner.style.fontSize = "0.95rem";
        banner.style.zIndex = "9999";
        banner.style.display = "flex";
        banner.style.alignItems = "center";
        banner.style.justifyContent = "center";
        banner.style.animation = "fadeInDown 0.5s ease-out";
        
        if (!document.getElementById("guest-banner-styles")) {
            const style = document.createElement("style");
            style.id = "guest-banner-styles";
            style.innerHTML = `
                @keyframes fadeInDown {
                    from { opacity: 0; transform: translate(-50%, -20px); }
                    to { opacity: 1; transform: translate(-50%, 0); }
                }
                #guest-banner a:hover { color: #818cf8 !important; }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(banner);
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
    // Single source of truth for Auth State
    onAuthStateChanged(auth, async (user) => {
        const path = window.location.pathname;
        const isLandingPage = path === "/" || path === "/index.html" || (path.endsWith("/index.html") && !path.includes("/htmls/"));
        const isAuthPage = path.includes("sign.html") || path.includes("verify-email.html");
        const isEntryPage = isLandingPage || isAuthPage;

        if (user) {
            // --- LOGGED IN ---
            sessionStorage.removeItem('isGuestMode'); // Clear guest mode if logged in

            // Redirect if on landing/auth pages
            if (isEntryPage) {
                // If they need verification, don't auto-redirect to dashboard yet
                if (!user.emailVerified && !user.providerData.some(p => p.providerId === 'google.com')) {
                    if (!path.includes("verify-email.html")) {
                        window.location.replace("/htmls/verify-email.html");
                    }
                    return;
                }
                window.location.replace("/htmls/dashboard.html");
                return;
            }

            // Normal page load for authenticated routes
            const userData = await loadUserData(user);
            updateUserDisplay(userData, user);
            document.dispatchEvent(new CustomEvent("userLoaded", { detail: { user, userData } }));
            document.body.style.opacity = "1";
        } else {
            // --- NOT LOGGED IN ---
            
            // Auto-enable guest mode if coming from landing page
            const referrer = document.referrer;
            const isFromLanding = referrer && (referrer.includes("index.html") || referrer === window.location.origin + "/");
            
            if (isFromLanding && sessionStorage.getItem('isGuestMode') !== 'true') {
                sessionStorage.setItem('isGuestMode', 'true');
            }

            if (isGuestUser()) {
                if (isEntryPage) {
                    // Let the user stay on the entry page (e.g. sign.html) so they can actually log in
                    document.body.style.opacity = "1";
                    return;
                }
                injectGuestBanner();
                updateUserDisplay({ username: "Guest", bio: "Browsing as Guest" }, { displayName: "Guest" });
                document.body.style.opacity = "1";
                return;
            }


            // Only allow entry pages
            if (!isEntryPage) {
                window.location.replace("/index.html");
            } else {
                document.body.style.opacity = "1";
            }
        }
    });

    // --- Usage Limit System ---
    const checkUsageLimit = async () => {
        const path = window.location.pathname;
        const isAIBoard = path.includes("ai-board.html");
        const isTutor = path.includes("doubt/index.html");
        
        // Only kick users out if they are actively on the AI features pages
        if (!isAIBoard && !isTutor) return;

        const access = await verifyBoardAccess();
        if (!access.allowed) {
            alert("Your AI usage limit has finished. Please try again later.");
            window.location.href = "/htmls/dashboard.html";
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
                if (!auth.currentUser && isGuestUser()) {
                    sessionStorage.removeItem('isGuestMode');
                    window.location.href = "/index.html";
                    return;
                }
                await signOut(auth);
                sessionStorage.removeItem('isGuestMode');
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