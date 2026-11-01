import { auth, db, loadUserData, updateUserProfile, changeUserPassword, showStatus, checkAccess } from "/js/auth.js";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-firestore.js";
import { uploadProfilePhotoToServer, removeProfilePhotoFromServer } from "/js/profile-photo-cache.js";
import { deleteNeoLearnProfile } from "/js/neolearn-social-service.js";

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

// Leaderboard Privacy Elements
const leaderboardPrivacySelect = document.getElementById("leaderboardPrivacySelect");
const leaderboardClassSelect = document.getElementById("leaderboardClassSelect");
const leaderboardDisplayNameInput = document.getElementById("leaderboardDisplayNameInput");
const saveLeaderboardPrivacyBtn = document.getElementById("saveLeaderboardPrivacyBtn");
const syncLeaderboardStatsBtn = document.getElementById("syncLeaderboardStatsBtn");
const lbStatusBadge = document.getElementById("lbStatusBadge");
const leaderboardStatusFeedback = document.getElementById("leaderboardStatusFeedback");

function showLeaderboardFeedback(message, isError = false) {
    if (!leaderboardStatusFeedback) return;
    leaderboardStatusFeedback.textContent = message;
    leaderboardStatusFeedback.style.color = isError ? "var(--account-danger, #ef4444)" : "var(--account-success, #16a34a)";
    setTimeout(() => {
        if (leaderboardStatusFeedback.textContent === message) {
            leaderboardStatusFeedback.textContent = "";
        }
    }, 4500);
}

function updateLeaderboardUI(isPublic) {
    if (lbStatusBadge) {
        if (isPublic) {
            lbStatusBadge.textContent = "Public (Active on Leaderboard)";
            lbStatusBadge.className = "neolearn-badge neolearn-badge--active";
            if (syncLeaderboardStatsBtn) syncLeaderboardStatsBtn.style.display = "inline-block";
        } else {
            lbStatusBadge.textContent = "Private (Hidden from Leaderboard)";
            lbStatusBadge.className = "neolearn-badge neolearn-badge--inactive";
            if (syncLeaderboardStatsBtn) syncLeaderboardStatsBtn.style.display = "none";
        }
    }
}

// Profile Photo Management Elements
const settingsPhotoInput = document.getElementById("settingsPhotoInput");
const settingsChangePhotoBtn = document.getElementById("settingsChangePhotoBtn");
const settingsChangePhotoText = document.getElementById("settingsChangePhotoText");
const settingsRemovePhotoBtn = document.getElementById("settingsRemovePhotoBtn");
const settingsPhotoStatus = document.getElementById("settingsPhotoStatus");
const initialAvatar = document.getElementById("initialAvatar");

function showSettingsPhotoFeedback(message, isError = false) {
    if (!settingsPhotoStatus) return;
    settingsPhotoStatus.textContent = message;
    settingsPhotoStatus.style.color = isError ? "var(--account-danger, #ef4444)" : "var(--account-success, #16a34a)";
    setTimeout(() => {
        if (settingsPhotoStatus.textContent === message) {
            settingsPhotoStatus.textContent = "";
        }
    }, 4000);
}

function updateSettingsAvatarUI(photoUrl, username) {
    const firstLetter = (username || "User").charAt(0).toUpperCase();
    if (initialAvatar) {
        if (photoUrl) {
            initialAvatar.style.backgroundImage = `url("${photoUrl}")`;
            initialAvatar.style.backgroundSize = "cover";
            initialAvatar.style.backgroundPosition = "center";
            initialAvatar.textContent = "";
        } else {
            initialAvatar.style.backgroundImage = "";
            initialAvatar.textContent = firstLetter;
        }
    }
    if (settingsRemovePhotoBtn) {
        if (photoUrl) {
            settingsRemovePhotoBtn.classList.remove("d-none");
        } else {
            settingsRemovePhotoBtn.classList.add("d-none");
        }
    }
}

// NeoLearn Elements
const neolearnToggleBtn = document.getElementById("neolearnToggleBtn");
const neolearnBtnText = document.getElementById("neolearnBtnText");
const neolearnStatusBadge = document.getElementById("neolearnStatusBadge");
const neolearnStatusFeedback = document.getElementById("neolearnStatusFeedback");
const retryNeoLearnStateBtn = document.getElementById("retryNeoLearnState");

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


// NeoLearn Privacy & Controls Elements
const privacyShowLastSeen = document.getElementById("privacyShowLastSeen");
const privacyReadReceipts = document.getElementById("privacyReadReceipts");
const neolearnMessagePrivacy = document.getElementById("neolearnMessagePrivacy");
const saveNeoLearnPrivacyBtn = document.getElementById("saveNeoLearnPrivacyBtn");
const neolearnPrivacyFeedback = document.getElementById("neolearnPrivacyFeedback");
const neolearnActiveControls = document.getElementById("neolearnActiveControls");

function showNeoLearnPrivacyFeedback(message, isError = false) {
    if (!neolearnPrivacyFeedback) return;
    neolearnPrivacyFeedback.innerHTML = isError
        ? `<i class="bi bi-exclamation-triangle-fill me-1" aria-hidden="true"></i>${message}`
        : `<i class="bi bi-check-circle-fill me-1" aria-hidden="true"></i>${message}`;
    neolearnPrivacyFeedback.style.color = isError ? "var(--account-danger, #ef4444)" : "var(--account-success, #16a34a)";
    setTimeout(() => {
        if (neolearnPrivacyFeedback.textContent.includes(message)) {
            neolearnPrivacyFeedback.textContent = "";
        }
    }, 4500);
}

async function saveNeoLearnPrivacySettings(showFeedback = true) {
    const user = auth.currentUser;
    if (!user) return;
    
    if (saveNeoLearnPrivacyBtn) {
        saveNeoLearnPrivacyBtn.disabled = true;
        saveNeoLearnPrivacyBtn.textContent = "Saving...";
    }

    const showLastSeen = privacyShowLastSeen ? privacyShowLastSeen.checked : true;
    const readReceipts = privacyReadReceipts ? privacyReadReceipts.checked : true;
    const messagePrivacy = neolearnMessagePrivacy ? neolearnMessagePrivacy.value : "everyone";

    try {
        // 1. Update Firestore users collection (permitted by firestore.rules)
        await setDoc(doc(db, "users", user.uid), {
            showLastSeen,
            readReceipts,
            messagePrivacy,
            updatedAt: serverTimestamp()
        }, { merge: true });

        // 2. Sync to backend settings API
        try {
            const token = await user.getIdToken();
            await fetch("/api/neolearn/settings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ showLastSeen, readReceipts, messagePrivacy })
            });
        } catch (apiErr) {
            console.warn("Backend settings sync warning:", apiErr);
        }

        if (currentNeoLearnProfile) {
            currentNeoLearnProfile.showLastSeen = showLastSeen;
            currentNeoLearnProfile.readReceipts = readReceipts;
            currentNeoLearnProfile.messagePrivacy = messagePrivacy;
        }

        if (showFeedback) {
            showNeoLearnPrivacyFeedback("NeoLearn privacy settings saved successfully!");
        }
    } catch (err) {
        console.error("Failed to update NeoLearn privacy settings:", err);
        if (showFeedback) {
            showNeoLearnPrivacyFeedback("Failed to save settings: " + (err.message || err), true);
        }
    } finally {
        if (saveNeoLearnPrivacyBtn) {
            saveNeoLearnPrivacyBtn.disabled = false;
            saveNeoLearnPrivacyBtn.innerHTML = '<i class="bi bi-check-circle me-1" aria-hidden="true"></i>Save Privacy Settings';
        }
    }
}

if (saveNeoLearnPrivacyBtn) {
    saveNeoLearnPrivacyBtn.addEventListener("click", () => saveNeoLearnPrivacySettings(true));
}

// Auto-save toggle switches for effortless user experience
[privacyShowLastSeen, privacyReadReceipts].forEach((checkbox) => {
    if (checkbox) {
        checkbox.addEventListener("change", () => saveNeoLearnPrivacySettings(true));
    }
});

function updateNeoLearnUI(hasProfile) {
    if (!neolearnToggleBtn || !neolearnStatusBadge) return;
    neolearnToggleBtn.disabled = false;
    if (hasProfile) {
        neolearnStatusBadge.textContent = "Active";
        neolearnStatusBadge.className = "neolearn-badge neolearn-badge--active";
        neolearnBtnText.textContent = "Remove NeoLearn Profile";
        neolearnToggleBtn.className = "settings-save nl-btn-remove";
        
        if (neolearnActiveControls) {
            neolearnActiveControls.style.display = "block";
            if (currentNeoLearnProfile && currentNeoLearnProfile.messagePrivacy && neolearnMessagePrivacy) {
                neolearnMessagePrivacy.value = currentNeoLearnProfile.messagePrivacy;
            }
        }
    } else {
        neolearnStatusBadge.textContent = "Not created yet";
        neolearnStatusBadge.className = "neolearn-badge neolearn-badge--inactive";
        neolearnBtnText.textContent = "Create Profile on NeoLearn";
        neolearnToggleBtn.className = "settings-save";
        
        if (neolearnActiveControls) {
            neolearnActiveControls.style.display = "none";
        }
    }
}

async function loadNeoLearnState(user) {
    if (!user || !user.uid) return;
    neolearnToggleBtn.disabled = true;
    retryNeoLearnStateBtn.disabled = true;
    retryNeoLearnStateBtn.hidden = true;
    neolearnStatusBadge.textContent = "Checking...";
    neolearnStatusBadge.className = "neolearn-badge neolearn-badge--checking";
    try {
        const profileSnap = await getDoc(doc(db, "neolearn_profiles", user.uid));
        if (auth.currentUser?.uid !== user.uid) return;
        if (profileSnap.exists()) {
            currentNeoLearnProfile = profileSnap.data();
            updateNeoLearnUI(true);
        } else {
            currentNeoLearnProfile = null;
            updateNeoLearnUI(false);
        }
    } catch (err) {
        console.error("Error loading NeoLearn profile:", err);
        currentNeoLearnProfile = null;
        neolearnStatusBadge.textContent = "Unavailable";
        neolearnStatusBadge.className = "neolearn-badge neolearn-badge--inactive";
        neolearnBtnText.textContent = "Status check required";
        retryNeoLearnStateBtn.hidden = false;
        showNeoLearnFeedback("Could not load NeoLearn profile status: " + err.message, true);
    } finally {
        retryNeoLearnStateBtn.disabled = false;
    }
}

retryNeoLearnStateBtn.addEventListener("click", () => loadNeoLearnState(auth.currentUser));

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
            await deleteNeoLearnProfile(user);
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

if (settingsChangePhotoBtn && settingsPhotoInput) {
    settingsChangePhotoBtn.addEventListener("click", () => {
        settingsPhotoInput.click();
    });

    settingsPhotoInput.addEventListener("change", async () => {
        const file = settingsPhotoInput.files?.[0];
        if (!file) return;

        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            return showSettingsPhotoFeedback("Invalid image format. Supported formats: JPEG, PNG, WebP, GIF.", true);
        }
        if (file.size > 5 * 1024 * 1024) {
            return showSettingsPhotoFeedback("Image size must be less than 5MB.", true);
        }

        const user = auth.currentUser;
        if (!user) return showSettingsPhotoFeedback("You must be logged in to upload a photo.", true);

        // Instant local preview
        const previewUrl = URL.createObjectURL(file);
        updateSettingsAvatarUI(previewUrl, user.displayName);

        // Uploading state
        settingsChangePhotoBtn.disabled = true;
        if (settingsRemovePhotoBtn) settingsRemovePhotoBtn.disabled = true;
        settingsChangePhotoText.textContent = "Uploading...";
        showSettingsPhotoFeedback("Uploading to Cloudinary...");

        try {
            const secureUrl = await uploadProfilePhotoToServer(user, file);
            updateSettingsAvatarUI(secureUrl, user.displayName);
            showSettingsPhotoFeedback("Profile photo updated successfully!");
        } catch (err) {
            console.error("Photo upload failed:", err);
            showSettingsPhotoFeedback(err.message || "Failed to upload photo", true);
            const userDoc = await getDoc(doc(db, "users", user.uid));
            const existingPhoto = userDoc.exists() ? userDoc.data().profilePhotoUrl : null;
            updateSettingsAvatarUI(existingPhoto, user.displayName);
        } finally {
            settingsChangePhotoBtn.disabled = false;
            if (settingsRemovePhotoBtn) settingsRemovePhotoBtn.disabled = false;
            settingsChangePhotoText.textContent = "Change Photo";
            settingsPhotoInput.value = "";
        }
    });
}

if (settingsRemovePhotoBtn) {
    settingsRemovePhotoBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;

        settingsRemovePhotoBtn.disabled = true;
        settingsChangePhotoBtn.disabled = true;
        showSettingsPhotoFeedback("Removing profile photo...");

        try {
            await removeProfilePhotoFromServer(user);
            updateSettingsAvatarUI(null, user.displayName);
            showSettingsPhotoFeedback("Profile photo removed.");
        } catch (err) {
            console.error("Failed to remove photo:", err);
            showSettingsPhotoFeedback(err.message || "Failed to remove photo", true);
        } finally {
            settingsChangePhotoBtn.disabled = false;
            settingsRemovePhotoBtn.disabled = false;
        }
    });
}

document.addEventListener("userLoaded", async (e) => {
    const { user, userData } = e.detail;
    firstNameInput.value = userData.fname || "";
    lastNameInput.value = userData.lname || "";
    usernameInput.value = userData.username || user.displayName || "User";
    bioInput.value = userData.bio || "";
    notificationPref.value = userData.notificationPref || "all";
    const activePhoto = userData.profilePhotoUrl || userData.photoURL;
    updateSettingsAvatarUI(activePhoto, userData.username || user.displayName);

    // Populate NeoLearn Privacy Preferences
    if (privacyShowLastSeen) {
        privacyShowLastSeen.checked = (userData.showLastSeen !== false);
    }
    if (privacyReadReceipts) {
        privacyReadReceipts.checked = (userData.readReceipts !== false);
    }
    if (neolearnMessagePrivacy) {
        neolearnMessagePrivacy.value = userData.messagePrivacy || "everyone";
    }

    await loadNeoLearnState(user);

    if (leaderboardPrivacySelect) {
        const isPublic = (userData.showOnLeaderboard !== false && userData.leaderboardPrivacy !== 'private');
        leaderboardPrivacySelect.value = isPublic ? 'public' : 'private';
        if (leaderboardClassSelect) leaderboardClassSelect.value = userData.targetClass === '9' ? '9' : '10';
        if (leaderboardDisplayNameInput) leaderboardDisplayNameInput.value = userData.publicDisplayName || userData.username || '';
        updateLeaderboardUI(isPublic);
    }
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

// Check for URL messages (e.g. redirected from protected NeoLearn page)
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('msg') === 'neolearn_missing') {
    setTimeout(() => {
        showStatus("NeoLearn profile not created yet. Create your NeoLearn profile in Settings to access NeoLearn.", true);
        
        const neolearnSection = document.getElementById("neolearnSection");
        if (neolearnSection) {
            neolearnSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
            neolearnSection.style.transition = 'box-shadow 0.3s ease';
            neolearnSection.style.boxShadow = '0 0 0 3px var(--account-danger, #ef4444)';
            setTimeout(() => {
                neolearnSection.style.boxShadow = '';
            }, 2500);
            showNeoLearnFeedback("NeoLearn profile not created yet. Create your NeoLearn profile here to access NeoLearn.", true);
        }
    }, 600); // slight delay to ensure UI is ready
}

// ── Leaderboard Privacy Save & Sync Handlers ───────────────────────────────
if (saveLeaderboardPrivacyBtn) {
    saveLeaderboardPrivacyBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        saveLeaderboardPrivacyBtn.disabled = true;
        saveLeaderboardPrivacyBtn.textContent = "Saving...";

        const isPublic = leaderboardPrivacySelect.value === 'public';
        const targetClass = leaderboardClassSelect ? leaderboardClassSelect.value : '10';
        const publicDisplayName = leaderboardDisplayNameInput ? leaderboardDisplayNameInput.value.trim() : '';

        try {
            // Update users document with allowed fields
            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                showOnLeaderboard: isPublic,
                leaderboardPrivacy: isPublic ? 'public' : 'private',
                targetClass: targetClass,
                publicDisplayName: publicDisplayName || user.displayName || 'Learner',
                updatedAt: serverTimestamp()
            }, { merge: true });

            // If private, delete public_profiles doc immediately
            if (!isPublic) {
                try {
                    await deleteDoc(doc(db, "public_profiles", user.uid));
                } catch (delErr) {
                    console.warn("Could not delete public profile directly:", delErr);
                }
            }

            // Sync with backend API
            try {
                const token = await user.getIdToken();
                await fetch("/api/leaderboard/privacy", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        privacy: isPublic ? 'public' : 'private',
                        targetClass,
                        publicDisplayName: publicDisplayName || user.displayName || 'Learner'
                    })
                });
            } catch (apiErr) {
                console.warn("Backend sync notice:", apiErr);
            }

            updateLeaderboardUI(isPublic);
            showLeaderboardFeedback(isPublic
                ? "Leaderboard profile is now PUBLIC. You will appear in rankings!"
                : "Leaderboard profile is now PRIVATE. You are hidden from rankings.");
        } catch (err) {
            console.error("Failed to save leaderboard settings:", err);
            showLeaderboardFeedback("Failed to update privacy: " + err.message, true);
        } finally {
            saveLeaderboardPrivacyBtn.disabled = false;
            saveLeaderboardPrivacyBtn.textContent = "Save Privacy Settings";
        }
    });
}

if (syncLeaderboardStatsBtn) {
    syncLeaderboardStatsBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user) return;
        syncLeaderboardStatsBtn.disabled = true;
        syncLeaderboardStatsBtn.textContent = "Syncing...";

        try {
            const token = await user.getIdToken();
            const res = await fetch("/api/leaderboard/sync", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            const data = await res.json();
            if (data.success) {
                showLeaderboardFeedback("Leaderboard stats synchronized successfully!");
            } else {
                showLeaderboardFeedback(data.error || "Failed to sync stats", true);
            }
        } catch (err) {
            showLeaderboardFeedback("Stats sync notice: " + err.message, true);
        } finally {
            syncLeaderboardStatsBtn.disabled = false;
            syncLeaderboardStatsBtn.textContent = "Sync Leaderboard Stats";
        }
    });
}