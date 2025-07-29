import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendSignInLinkToEmail,
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
  messageDiv.style.color = isError ? "red" : "green";
  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

// Utility for email validation
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Sign Up functionality with email verification
document.getElementById("submitSignUp").addEventListener("click", async () => {
  const fname = document.getElementById("signup-fname").value.trim();
  const lname = document.getElementById("signup-lname").value.trim();
  const email = document.getElementById("signup-email").value.trim();
  const phone = document.getElementById("signup-phone").value.trim();
  const password = document.getElementById("signup-password").value;

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Send verification email
    await sendEmailVerification(user);
    // Store user data, including phone number if provided
    await setDoc(doc(db, "users", user.uid), {
      fname,
      lname,
      email,
      phone: phone || null, // Store null if phone is empty
      emailVerified: false
    });
    localStorage.setItem("loggedInUserId", user.uid);
    showMessage("Account Created! Please check your email to verify your account.", "signUpMessage", false);
    // Delay redirect to allow user to see the message
    setTimeout(() => location.replace("/htmls/verify-email.html"), 3000);
  } catch (error) {
    console.error(error);
    const errorMessage = error.code === "auth/email-already-in-use"
      ? "Email Address Already Exists"
      : "Unable to create User. Please try again.";
    showMessage(errorMessage, "signUpMessage");
  }
});

// Login functionality with email verification check
document.getElementById("submitSignIn").addEventListener("click", async () => {
  const email = document.getElementById("signIn-email").value.trim();
  const password = document.getElementById("signIn-password").value;

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (!user.emailVerified) {
      showMessage("Please verify your email before logging in. Check your inbox or spam folder.", "signInMessage");
      // Option to resend verification email
      const resendLink = document.createElement("a");
      resendLink.href = "#";
      resendLink.textContent = " Resend verification email";
      resendLink.onclick = async () => {
        try {
          await sendEmailVerification(user);
          showMessage("Verification email resent. Please check your inbox.", "signInMessage", false);
        } catch (error) {
          showMessage("Failed to resend verification email.", "signInMessage");
        }
      };
      document.getElementById("signInMessage").appendChild(resendLink);
      return;
    }

    localStorage.setItem("loggedInUserId", user.uid);
    showMessage("Logged in Successfully", "signInMessage", false);
    setTimeout(() => location.replace("/htmls/dashboard.html"), 2000);
  } catch (error) {
    console.error(error);
    showMessage("Login Failed. Email or Password is incorrect.", "signInMessage");
  }
});