import { onAuthStateChanged, sendEmailVerification } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { auth, getEmailVerificationSettings } from "./auth.js";

const API_BASE = "https://neobranium.onrender.com";

async function sendVerificationViaServer() {
  const user = auth.currentUser;
  if (!user) throw new Error("No user logged in");
  const idToken = await user.getIdToken();
  const response = await fetch(`${API_BASE}/api/send-verification-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`
    },
    credentials: "include",
    body: JSON.stringify({})
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Server error");
  return data;
}


function showMessage(message, isError = true) {
  const messageDiv = document.getElementById("verifyMessage");
  if (!messageDiv) return;
  messageDiv.style.display = "block";
  messageDiv.textContent = message;
  messageDiv.classList.toggle("error", isError);
  messageDiv.classList.toggle("success", !isError);
  setTimeout(() => {
    messageDiv.style.display = "none";
  }, 5000);
}

window.checkVerification = async () => {
  const user = auth.currentUser;
  if (user) {
    try {
      await user.reload();
      if (user.emailVerified) {
        showMessage("Email verified! Redirecting to dashboard...", false);
        setTimeout(() => location.replace("/htmls/dashboard.html"), 1500);
      } else {
        showMessage("Email not verified yet. Check your inbox or spam folder.");
      }
    } catch (error) {
      console.error("Verification status check failed:", error);
      showMessage(`Could not check verification status (${error.code || "unknown error"}).`);
    }
  } else {
    showMessage("No signed-in account found. Please sign in again.");
  }
};

window.resendVerification = async () => {
  const user = auth.currentUser;
  if (user) {
    try {
      // Try Render server (Gmail SMTP) first for reliable delivery
      await sendVerificationViaServer();
      showMessage("Verification email sent! Please check your inbox.", false);
    } catch (serverError) {
      console.error("Server resend failed:", serverError);
      showMessage(`Could not resend the email: ${serverError.message}`);
    }
  } else {
    showMessage("No signed-in account found. Please sign in again.");
  }
};

// Check user status on page load
onAuthStateChanged(auth, (user) => {
  const emailAddress = document.getElementById("verifyEmailAddress");
  const checkButton = document.getElementById("checkVerificationButton");
  const resendButton = document.getElementById("resendVerificationButton");

  if (emailAddress) emailAddress.textContent = user?.email || "your email address";
  if (checkButton) checkButton.disabled = !user;
  if (resendButton) resendButton.disabled = !user || user.emailVerified;

  if (user && user.emailVerified) {
    showMessage("Email already verified! Redirecting to dashboard...", false);
    setTimeout(() => location.replace("/htmls/dashboard.html"), 1500);
  } else if (!user) {
    showMessage("No signed-in account found. Please sign in again.");
  }
});

document.getElementById("resendVerificationButton")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    await window.resendVerification();
  } finally {
    button.disabled = !auth.currentUser || auth.currentUser.emailVerified;
  }
});

document.getElementById("checkVerificationButton")?.addEventListener("click", window.checkVerification);
document.getElementById("resendVerificationButton")?.addEventListener("click", window.resendVerification);