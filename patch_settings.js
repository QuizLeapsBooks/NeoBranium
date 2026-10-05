const fs = require('fs');
let html = fs.readFileSync('htmls/setting.html', 'utf8');

const privacyHtml = `
            <div class="settings-field" id="neolearnPrivacySettings" style="display: none; margin-top: 1rem; border-top: 1px solid var(--account-border); padding-top: 1rem;">
              <label for="neolearnMessagePrivacy">Who can message me on NeoLearn?</label>
              <div class="settings-inline-field">
                <select id="neolearnMessagePrivacy" class="nl-modal-input" style="width: auto; min-width: 200px;">
                  <option value="everyone">Everyone</option>
                  <option value="learning_only">Only people I am Learning with</option>
                  <option value="none">No one</option>
                </select>
                <button id="saveMessagePrivacyBtn" class="settings-save" type="button">Save</button>
              </div>
            </div>
`;

if (!html.includes('neolearnPrivacySettings')) {
    html = html.replace('<div class="settings-actions">', privacyHtml + '\n            <div class="settings-actions">');
    fs.writeFileSync('htmls/setting.html', html);
    console.log("Patched setting.html");
} else {
    console.log("setting.html already patched");
}
