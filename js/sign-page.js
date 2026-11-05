const signupPage = document.getElementById("signup-page");
const loginPage = document.getElementById("login-page");

document.getElementById("showLoginLink")?.addEventListener("click", (event) => {
  event.preventDefault();
  signupPage?.classList.add("hidden");
  loginPage?.classList.remove("hidden");
});

document.getElementById("showSignUpLink")?.addEventListener("click", (event) => {
  event.preventDefault();
  loginPage?.classList.add("hidden");
  signupPage?.classList.remove("hidden");
});
