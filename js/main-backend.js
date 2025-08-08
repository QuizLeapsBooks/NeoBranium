import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import {
  getFirestore,
  setDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA1iWJdGtmrox9RAHgWBxaK4p8KGf7ji_Y",
  authDomain: "neobranium.firebaseapp.com",
  projectId: "neobranium",
  storageBucket: "neobranium.appspot.com",
  messagingSenderId: "59188872045",
  appId: "1:59188872045:web:450a70b28e4be5db335064",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helper function to show messages
function showMessage(message, divId, isError = true) {
  const messageDiv = document.getElementById(divId);
  messageDiv.style.display = "block";
  messageDiv.textContent = message;
  messageDiv.style.backgroundColor = isError ? "#ffebee" : "#e8f5e9";
  messageDiv.style.color = isError ? "#c62828" : "#2e7d32";
  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

// Utility for email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Utility for phone number validation
function isValidPhone(phone) {
  const phoneRegex = /^\+[0-9]{10,15}$/;
  return phoneRegex.test(phone);
}

// Sign Up functionality
window.handleSignUp = async function (event) {
  event.preventDefault();
  const fname = document.getElementById("signup-fname").value.trim();
  const lname = document.getElementById("signup-lname").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const phone = document.getElementById("signup-phone").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-confirm-password").value;
  const termsCheckbox = document.getElementById("terms-checkbox").checked;

  if (!fname || !lname || !email || !phone || !password || !confirmPassword) {
    showMessage("All fields are required", "signUpMessage");
    return;
  }

  if (!isValidEmail(email)) {
    showMessage("Invalid email format", "signUpMessage");
    return;
  }

  if (!isValidPhone(phone)) {
    showMessage("Invalid phone number format (e.g., +919876543210)", "signUpMessage");
    return;
  }

  if (password.length < 8) {
    showMessage("Password must be at least 8 characters long", "signUpMessage");
    return;
  }

  if (password !== confirmPassword) {
    showMessage("Passwords do not match", "signUpMessage");
    return;
  }

  if (!termsCheckbox) {
    showMessage("Please agree to Terms & Conditions and Privacy Policy", "signUpMessage");
    return;
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await setDoc(doc(db, "users", user.uid), { fname, lname, email, phone });
    await sendEmailVerification(user);
    localStorage.setItem("loggedInUserId", user.uid);
    showMessage("Account created! Please verify your email to continue.", "signUpMessage", false);
    setTimeout(() => location.replace("/htmls/verify-email.html"), 2000);
  } catch (error) {
    console.error(error);
    const errorMessage = error.code === "auth/email-already-in-use"
      ? "Email Address Already Exists"
      : "Unable to create user. Please try again.";
    showMessage(errorMessage, "signUpMessage");
  }
};

// Login functionality (Email/Password only)
window.handleLogin = async function (event) {
  event.preventDefault();
  const email = document.getElementById("signIn-email").value.trim();
  const password = document.getElementById("signIn-password").value;

  if (!email || !password) {
    showMessage("Email and password are required", "signInMessage");
    return;
  }

  if (!isValidEmail(email)) {
    showMessage("Invalid email format", "signInMessage");
    return;
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    if (!user.emailVerified) {
      showMessage("Please verify your email before logging in.", "signInMessage");
      return;
    }
    localStorage.setItem("loggedInUserId", user.uid);
    showMessage("Logged in successfully!", "signInMessage", false);
    setTimeout(() => location.replace("/htmls/dashboard.html"), 2000);
  } catch (error) {
    console.error(error);
    showMessage("Login failed. Email or password is incorrect.", "signInMessage");
  }
};