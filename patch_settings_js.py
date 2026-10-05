import re

with open('js/settings.js', 'r') as f:
    js = f.read()

patch = """
const neolearnPrivacySettings = document.getElementById("neolearnPrivacySettings");
const neolearnMessagePrivacy = document.getElementById("neolearnMessagePrivacy");
const saveMessagePrivacyBtn = document.getElementById("saveMessagePrivacyBtn");

if (saveMessagePrivacyBtn) {
    saveMessagePrivacyBtn.addEventListener("click", async () => {
        const user = auth.currentUser;
        if (!user || !currentNeoLearnProfile) return;
        
        saveMessagePrivacyBtn.disabled = true;
        saveMessagePrivacyBtn.textContent = "Saving...";
        
        try {
            await updateDoc(doc(db, "neolearn_profiles", user.uid), {
                messagePrivacy: neolearnMessagePrivacy.value
            });
            currentNeoLearnProfile.messagePrivacy = neolearnMessagePrivacy.value;
            showNeoLearnFeedback("Message privacy updated successfully.");
        } catch (err) {
            console.error("Error updating privacy:", err);
            showNeoLearnFeedback("Failed to update privacy: " + err.message, true);
        } finally {
            saveMessagePrivacyBtn.disabled = false;
            saveMessagePrivacyBtn.textContent = "Save";
        }
    });
}
"""

if 'neolearnPrivacySettings' not in js:
    # Insert after updateNeoLearnUI
    js = js.replace('function updateNeoLearnUI(hasProfile) {', patch + '\nfunction updateNeoLearnUI(hasProfile) {')
    
    # Also update the UI to show the privacy settings when active
    ui_patch = """
        neolearnToggleBtn.className = "settings-save nl-btn-remove";
        if (neolearnPrivacySettings) {
            neolearnPrivacySettings.style.display = "block";
            if (currentNeoLearnProfile && currentNeoLearnProfile.messagePrivacy) {
                neolearnMessagePrivacy.value = currentNeoLearnProfile.messagePrivacy;
            } else {
                neolearnMessagePrivacy.value = "everyone";
            }
        }
"""
    js = js.replace('neolearnToggleBtn.className = "settings-save nl-btn-remove";', ui_patch)
    
    ui_patch2 = """
        neolearnToggleBtn.className = "settings-save";
        if (neolearnPrivacySettings) neolearnPrivacySettings.style.display = "none";
"""
    js = js.replace('neolearnToggleBtn.className = "settings-save";', ui_patch2)

    with open('js/settings.js', 'w') as f:
        f.write(js)
    print("Patched settings.js")
else:
    print("settings.js already patched")
