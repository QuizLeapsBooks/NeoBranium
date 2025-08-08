document.addEventListener('DOMContentLoaded', () => {
  console.log("DOM Loaded, showing Sign Up form");
  showSignUpForm();
  initializeInputAnimations();
});

function initializeInputAnimations() {
  const containers = document.querySelectorAll('.container');
  containers.forEach((container, index) => {
    const inputs = container.querySelectorAll('.input-box');
    inputs.forEach((input, i) => {
      input.style.setProperty('--input-index', i);
    });
  });
}

function togglePassword(fieldId, eyeId) {
  const passwordField = document.getElementById(fieldId);
  const eyeIcon = document.getElementById(eyeId);
  if (passwordField.type === "password") {
    passwordField.type = "text";
    eyeIcon.classList.replace("fa-eye", "fa-eye-slash");
  } else {
    passwordField.type = "password";
    eyeIcon.classList.replace("fa-eye-slash", "fa-eye");
  }
}

function showSignUpForm() {
  console.log("Showing Sign Up form");
  const signup = document.getElementById("signup-page");
  const login = document.getElementById("login-page");
  const otp = document.getElementById("otp-page");
  signup.classList.remove("hidden");
  login.classList.add("hidden");
  otp.classList.add("hidden");
  initializeInputAnimations();
}

function showLoginForm() {
  console.log("Showing Login form");
  const signup = document.getElementById("signup-page");
  const login = document.getElementById("login-page");
  const otp = document.getElementById("otp-page");
  login.classList.remove("hidden");
  signup.classList.add("hidden");
  otp.classList.add("hidden");
  initializeInputAnimations();
}

function showOTPForm() {
  console.log("Showing OTP form");
  const signup = document.getElementById("signup-page");
  const login = document.getElementById("login-page");
  const otp = document.getElementById("otp-page");
  otp.classList.remove("hidden");
  login.classList.add("hidden");
  signup.classList.add("hidden");
  initializeInputAnimations();
}