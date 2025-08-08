import { auth, loadUserData, updateUserProfile, changeUserPassword, showStatus } from "/js/auth.js";

const firstNameInput = document.getElementById("firstName");
const saveFirstNameBtn = document.getElementById("saveFirstNameBtn");
const lastNameInput = document.getElementById("lastName");
const saveLastNameBtn = document.getElementById("saveLastNameBtn");
const usernameInput = document.getElementById("username");
const saveUsernameBtn = document.getElementById("saveUsernameBtn");
const bioInput = document.getElementById("bio");
const saveBioBtn = document.getElementById("saveBioBtn");
const notificationPref = document.getElementById("notificationPref");
const saveNotificationBtn = document.getElementById("saveNotificationBtn");
const currentPasswordInput = document.getElementById("currentPassword");
const newPasswordInput = document.getElementById("newPassword");
const changePasswordBtn = document.getElementById("changePasswordBtn");
const themeSwitch = document.getElementById("themeSwitch");

document.addEventListener("userLoaded", async (e) => {
    const { user, userData } = e.detail;
    firstNameInput.value = userData.fname || "";
    lastNameInput.value = userData.lname || "";
    usernameInput.value = userData.username || user.displayName || "User";
    bioInput.value = userData.bio || "";
    notificationPref.value = userData.notificationPref || "all";
});

themeSwitch.addEventListener("change", () => {
    document.body.classList.toggle("dark", themeSwitch.checked);
    localStorage.setItem("theme", themeSwitch.checked ? "dark" : "light");
});

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    themeSwitch.checked = true;
}

saveFirstNameBtn.addEventListener("click", async () => {
    const fname = firstNameInput.value.trim();
    if (!fname) return showStatus("First Name can’t be empty, bro!", true);
    if (fname.length < 2) return showStatus("First Name too short, make it 2+ chars!", true);
    try {
        await updateUserProfile(auth.currentUser, "fname", fname);
        showStatus("First Name updated, looking good!");
    } catch (err) {
        showStatus("Failed to update First Name: " + err.message, true);
    }
});

saveLastNameBtn.addEventListener("click", async () => {
    const lname = lastNameInput.value.trim();
    if (!lname) return showStatus("Last Name can’t be empty, fam!", true);
    if (lname.length < 2) return showStatus("Last Name too short, make it 2+ chars!", true);
    try {
        await updateUserProfile(auth.currentUser, "lname", lname);
        showStatus("Last Name updated, nice!");
    } catch (err) {
        showStatus("Failed to update Last Name: " + err.message, true);
    }
});

saveUsernameBtn.addEventListener("click", async () => {
    const username = usernameInput.value.trim();
    if (!username) return showStatus("Username can’t be empty, fam!", true);
    if (username.length < 3) return showStatus("Username too short, make it 3+ chars!", true);
    try {
        await updateUserProfile(auth.currentUser, "username", username);
        showStatus("Username updated, nice!");
    } catch (err) {
        showStatus("Failed to update username: " + err.message, true);
    }
});

saveBioBtn.addEventListener("click", async () => {
    const bio = bioInput.value.trim();
    if (bio.length > 150) return showStatus("Bio too long, keep it under 150 chars!", true);
    try {
        await updateUserProfile(auth.currentUser, "bio", bio);
        showStatus("Bio updated, vibes on point!");
    } catch (err) {
        showStatus("Failed to update bio: " + err.message, true);
    }
});

saveNotificationBtn.addEventListener("click", async () => {
    const notificationPrefValue = notificationPref.value;
    try {
        await updateUserProfile(auth.currentUser, "notificationPref", notificationPrefValue);
        showStatus("Notification preferences updated, you’re all set!");
    } catch (err) {
        showStatus("Failed to update notification preferences: " + err.message, true);
    }
});

changePasswordBtn.addEventListener("click", async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    if (!currentPassword || !newPassword) return showStatus("Fill both password fields, yo!", true);
    if (newPassword.length < 6) return showStatus("New password needs 6+ chars!", true);
    try {
        await changeUserPassword(auth.currentUser, currentPassword, newPassword);
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        showStatus("Password changed, you’re locked in!");
    } catch (err) {
        showStatus("Failed to change password: " + err.message, true);
    }
});