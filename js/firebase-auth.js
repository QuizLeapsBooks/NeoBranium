import { auth, db } from "./auth.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  setDoc,
  getDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

const googleProvider = new GoogleAuthProvider();

// ==========================================
// UI State Management & View Toggling
// ==========================================
const signupPage = document.getElementById("signup-page");
const loginPage = document.getElementById("login-page");

document.getElementById("showLoginLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  signupPage.classList.add("hidden");
  loginPage.classList.remove("hidden");
});

document.getElementById("showSignUpLink")?.addEventListener("click", (e) => {
  e.preventDefault();
  loginPage.classList.add("hidden");
  signupPage.classList.remove("hidden");
});

// Toggle password visibility
document.querySelectorAll(".toggle-password").forEach(toggle => {
  toggle.addEventListener("click", function () {
    const targetId = this.getAttribute("data-target");
    const input = document.getElementById(targetId);
    const icon = this.querySelector("i");
    
    if (input.type === "password") {
      input.type = "text";
      icon.classList.replace("fa-eye", "fa-eye-slash");
    } else {
      input.type = "password";
      icon.classList.replace("fa-eye-slash", "fa-eye");
    }
  });
});

// Toast Notifications
function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  
  const icon = type === "error" ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
  toast.innerHTML = `${icon} <span>${message}</span>`;
  
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("fade-out");
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Loading state manager
function setLoading(buttonId, isLoading) {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  if (isLoading) {
    btn.classList.add("loading");
    btn.disabled = true;
  } else {
    btn.classList.remove("loading");
    btn.disabled = false;
  }
}

// Utilities
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const isValidPhone = (phone) => /^\+[0-9]{10,15}$/.test(phone);

// Note: onAuthStateChanged is handled globally by auth.js. 
// This file only handles the specific login/signup actions on sign.html.

// Check redirect result for Google Auth fallback on page load
getRedirectResult(auth).then(async (result) => {
  if (result && result.user) {
    console.log("Processing redirect result for user:", result.user.uid);
    await handleGoogleUserFirestore(result.user);
    showToast("Login Successful!", "success");
    // auth.js will handle the redirect once onAuthStateChanged fires
  }
}).catch((error) => {
  console.error("Redirect Auth Error Details:", error);
  showToast("Authentication failed: " + (error.message || "Unknown error"));
});

// ==========================================
// Email & Password Auth
// ==========================================
document.getElementById("signup-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const fname = document.getElementById("signup-fname").value.trim();
  const lname = document.getElementById("signup-lname").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;
  const termsCheckbox = document.getElementById("terms-checkbox").checked;

  if (!fname || !lname || !email || !password || !confirmPassword) {
    return showToast("All fields are required");
  }
  if (!isValidEmail(email)) return showToast("Invalid email format");
  if (password.length < 8) return showToast("Password must be at least 8 characters");
  if (password !== confirmPassword) return showToast("Passwords do not match");
  if (!termsCheckbox) return showToast("Please agree to Terms & Conditions");

  setLoading("submitSignUp", true);

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Save to Firestore
    await setDoc(doc(db, "users", user.uid), { 
      fname, 
      lname, 
      username: fname + " " + lname,
      email, 
      phone: "",
      createdAt: Date.now()
    });
    
    await sendEmailVerification(user);
    showToast("Account created! Verify your email to continue.", "success");
    setTimeout(() => location.replace("/htmls/verify-email.html"), 2000);
  } catch (error) {
    console.error(error);
    const msg = error.code === "auth/email-already-in-use" 
      ? "Email address already exists" 
      : "Unable to create account. Try again.";
    showToast(msg);
  } finally {
    setLoading("submitSignUp", false);
  }
});

document.getElementById("login-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const email = document.getElementById("signIn-email").value.trim();
  const password = document.getElementById("signIn-password").value;

  if (!email || !password) return showToast("Email and password are required");
  if (!isValidEmail(email)) return showToast("Invalid email format");

  setLoading("submitSignIn", true);

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    if (!user.emailVerified) {
      showToast("Please verify your email before logging in.");
      setLoading("submitSignIn", false);
      return;
    }
    
    showToast("Logged in successfully!", "success");
    setTimeout(() => location.replace("/htmls/dashboard.html"), 1000);
  } catch (error) {
    console.error(error);
    showToast("Login failed. Incorrect email or password.");
    setLoading("submitSignIn", false);
  }
});

// ==========================================
// Google Authentication
// ==========================================
async function handleGoogleUserFirestore(user) {
  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    // First time login - create record with consistent schema
    const [fname, ...lnameArr] = (user.displayName || "User").split(" ");
    const lname = lnameArr.join(" ");
    
    await setDoc(userRef, {
      fname: fname,
      lname: lname,
      username: user.displayName || "Google User",
      email: user.email,
      phone: user.phoneNumber || "",
      photoURL: user.photoURL || "",
      bio: "Hey there! I'm using NeoBranium.",
      notificationPref: "all",
      createdAt: Date.now()
    });
    console.log("New Google user created in Firestore");
  } else {
    console.log("Existing Google user found in Firestore");
  }
}

async function signInWithGoogle(btnId) {
  setLoading(btnId, true);
  const btn = document.getElementById(btnId);
  btn.disabled = true;

  try {
    // Attempt popup auth first
    const result = await signInWithPopup(auth, googleProvider);
    console.log("Popup login successful for:", result.user.email);
    
    await handleGoogleUserFirestore(result.user);
    
    showToast("Login Successful!", "success");
    // Global auth.js listener will handle the dashboard redirect automatically
  } catch (error) {
    console.error("Google Sign-In Error:", error);
    
    // Handle specific popup errors
    if (error.code === 'auth/popup-closed-by-user') {
      showToast("Sign-in cancelled.");
      setLoading(btnId, false);
      btn.disabled = false;
      return;
    }

    // If popup fails (blocked, cross-origin issues), fallback to redirect
    showToast("Popup blocked. Redirecting to Google...");
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (redirectError) {
      console.error("Redirect Auth Error:", redirectError);
      showToast("Failed to initialize Google Sign-In.");
      setLoading(btnId, false);
      btn.disabled = false;
    }
  }
}

document.getElementById("googleSignUpBtn")?.addEventListener("click", () => signInWithGoogle("googleSignUpBtn"));
document.getElementById("googleSignInBtn")?.addEventListener("click", () => signInWithGoogle("googleSignInBtn"));

const handleGuestLogin = () => {
    sessionStorage.setItem("isGuestMode", "true");
    window.location.replace("/htmls/dashboard.html");
};
document.getElementById("guestSignUpBtn")?.addEventListener("click", handleGuestLogin);
document.getElementById("guestSignInBtn")?.addEventListener("click", handleGuestLogin);
