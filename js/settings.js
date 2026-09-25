import { auth, db, loadUserData, updateUserProfile, changeUserPassword, showStatus, checkAccess } from "/js/auth.js";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";

// Immediate access check for guest protection
await checkAccess(true);

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

// NeoLearn Elements
const neolearnToggleBtn = document.getElementById("neolearnToggleBtn");
const neolearnBtnText = document.getElementById("neolearnBtnText");
const neolearnStatusBadge = document.getElementById("neolearnStatusBadge");
const neolearnStatusFeedback = document.getElementById("neolearnStatusFeedback");

const neolearnModal = document.getElementById("neolearnModal");
const neolearnModalBackdrop = document.getElementById("neolearnModalBackdrop");
const neolearnStep1 = document.getElementById("neolearnStep1");
const neolearnStep2 = document.getElementById("neolearnStep2");
const neolearnStep1CancelBtn = document.getElementById("neolearnStep1CancelBtn");
const neolearnStep1ProceedBtn = document.getElementById("neolearnStep1ProceedBtn");
const neolearnStep2CancelBtn = document.getElementById("neolearnStep2CancelBtn");
const neolearnConfirmPhraseInput = document.getElementById("neolearnConfirmPhraseInput");
const neolearnFinalDeleteBtn = document.getElementById("neolearnFinalDeleteBtn");
const neolearnDeleteBtnText = document.getElementById("neolearnDeleteBtnText");

let currentNeoLearnProfile = null;
let isNeoLearnLoading = false;
const REQUIRED_REMOVAL_PHRASE = "I want to remove my NeoLearn profile";

function showNeoLearnFeedback(message, isError = false) {
    if (!neolearnStatusFeedback) return;
    neolearnStatusFeedback.textContent = message;
    neolearnStatusFeedback.style.color = isError ? "var(--account-danger, #ef4444)" : "var(--account-success, #16a34a)";
    setTimeout(() => {
        if (neolearnStatusFeedback.textContent === message) {
            neolearnStatusFeedback.textContent = "";
        }
    }, 5000);
}

function updateNeoLearnUI(hasProfile) {
    if (!neolearnToggleBtn || !neolearnStatusBadge) return;
    neolearnToggleBtn.disabled = false;
    if (hasProfile) {
        neolearnStatusBadge.textContent = "Active";
        neolearnStatusBadge.className = "neolearn-badge neolearn-badge--active";
        neolearnBtnText.textContent = "Remove NeoLearn Profile";
        neolearnToggleBtn.className = "settings-save nl-btn-remove";
    } else {
        neolearnStatusBadge.textContent = "Not created yet";
        neolearnStatusBadge.className = "neolearn-badge neolearn-badge--inactive";
        neolearnBtnText.textContent = "Create Profile on NeoLearn";
        neolearnToggleBtn.className = "settings-save";
    }
}

async function loadNeoLearnState(user) {
    if (!user || !user.uid) return;
    try {
        const profileSnap = await getDoc(doc(db, "neolearn_profiles", user.uid));
        if (profileSnap.exists()) {
            currentNeoLearnProfile = profileSnap.data();
            updateNeoLearnUI(true);
        } else {
            currentNeoLearnProfile = null;
            updateNeoLearnUI(false);
        }
    } catch (err) {
        console.error("Error loading NeoLearn profile:", err);
        showNeoLearnFeedback("Could not load NeoLearn profile status: " + err.message, true);
    }
}

async function handleCreateNeoLearnProfile() {
    const user = auth.currentUser;
    if (!user || isNeoLearnLoading) return;
    isNeoLearnLoading = true;
    neolearnToggleBtn.disabled = true;
    neolearnBtnText.textContent = "Creating...";

    try {
        const profileRef = doc(db, "neolearn_profiles", user.uid);
        const existingSnap = await getDoc(profileRef);

        if (!existingSnap.exists()) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userData = userDoc.exists() ? userDoc.data() : {};
            const displayName = userData.username || user.displayName || "Learner";
            const photoUrl = userData.profilePhotoUrl || userData.photoURL || user.photoURL || "";

            const profilePayload = {
                userId: user.uid,
                name: displayName,
                profilePhotoUrl: photoUrl,
                thoughtOfTheDay: "",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(profileRef, profilePayload);
            currentNeoLearnProfile = profilePayload;
        } else {
            currentNeoLearnProfile = existingSnap.data();
        }

        updateNeoLearnUI(true);
        showNeoLearnFeedback("NeoLearn profile created successfully!");
    } catch (err) {
        console.error("Error creating NeoLearn profile:", err);
        showNeoLearnFeedback("Failed to create NeoLearn profile: " + err.message, true);
        updateNeoLearnUI(false);
    } finally {
        isNeoLearnLoading = false;
    }
}

function openNeoLearnModal() {
    if (!neolearnModal) return;
    neolearnStep1.classList.remove("d-none");
    neolearnStep2.classList.add("d-none");
    neolearnConfirmPhraseInput.value = "";
    neolearnFinalDeleteBtn.disabled = true;
    neolearnModal.classList.add("is-open");
    neolearnModal.setAttribute("aria-hidden", "false");
}

function closeNeoLearnModal() {
    if (!neolearnModal) return;
    neolearnModal.classList.remove("is-open");
    neolearnModal.setAttribute("aria-hidden", "true");
    neolearnConfirmPhraseInput.value = "";
    neolearnFinalDeleteBtn.disabled = true;
}

if (neolearnToggleBtn) {
    neolearnToggleBtn.addEventListener("click", () => {
        if (currentNeoLearnProfile) {
            openNeoLearnModal();
        } else {
            handleCreateNeoLearnProfile();
        }
    });
}

if (neolearnStep1CancelBtn) {
    neolearnStep1CancelBtn.addEventListener("click", closeNeoLearnModal);
}
if (neolearnModalBackdrop) {
    neolearnModalBackdrop.addEventListener("click", closeNeoLearnModal);
}

if (neolearnStep1ProceedBtn) {
    neolearnStep1ProceedBtn.addEventListener("click", () => {
        neolearnStep1.classList.add("d-none");
        neolearnStep2.classList.remove("d-none");
        neolearnConfirmPhraseInput.value = "";
        neolearnFinalDeleteBtn.disabled = true;
        neolearnConfirmPhraseInput.focus();
    });
}

if (neolearnStep2CancelBtn) {
    neolearnStep2CancelBtn.addEventListener("click", closeNeoLearnModal);
}

if (neolearnConfirmPhraseInput) {
    neolearnConfirmPhraseInput.addEventListener("input", () => {
        const isExactMatch = neolearnConfirmPhraseInput.value.trim() === REQUIRED_REMOVAL_PHRASE;
        neolearnFinalDeleteBtn.disabled = !isExactMatch;
    });
}

if (neolearnFinalDeleteBtn) {
    neolearnFinalDeleteBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user || isNeoLearnLoading) return;
        if (neolearnConfirmPhraseInput.value.trim() !== REQUIRED_REMOVAL_PHRASE) return;

        isNeoLearnLoading = true;
        neolearnFinalDeleteBtn.disabled = true;
        neolearnDeleteBtnText.textContent = "Removing...";

        try {
            const profileRef = doc(db, "neolearn_profiles", user.uid);
            await deleteDoc(profileRef);
            currentNeoLearnProfile = null;
            closeNeoLearnModal();
            updateNeoLearnUI(false);
            showNeoLearnFeedback("Your NeoLearn profile has been removed.");
        } catch (err) {
            console.error("Error deleting NeoLearn profile:", err);
            showNeoLearnFeedback("Failed to remove NeoLearn profile: " + err.message, true);
        } finally {
            isNeoLearnLoading = false;
            neolearnDeleteBtnText.textContent = "Remove Profile";
        }
    });
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && neolearnModal && neolearnModal.classList.contains("is-open")) {
        closeNeoLearnModal();
    }
});

document.addEventListener("userLoaded", async (e) => {
    const { user, userData } = e.detail;
    firstNameInput.value = userData.fname || "";
    lastNameInput.value = userData.lname || "";
    usernameInput.value = userData.username || user.displayName || "User";
    bioInput.value = userData.bio || "";
    notificationPref.value = userData.notificationPref || "all";
    await loadNeoLearnState(user);
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
    if (newPassword.length < 8) return showStatus("New password needs 8+ chars!", true);
    try {
        await changeUserPassword(auth.currentUser, currentPassword, newPassword);
        currentPasswordInput.value = "";
        newPasswordInput.value = "";
        showStatus("Password changed, you’re locked in!");
    } catch (err) {
        showStatus("Failed to change password: " + err.message, true);
    }
});