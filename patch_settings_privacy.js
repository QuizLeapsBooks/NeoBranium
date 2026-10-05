import fs from 'fs';

// 1. htmls/setting.html
let html = fs.readFileSync('htmls/setting.html', 'utf8');
if (!html.includes('id="privacyShowLastSeen"')) {
    const privacySection = `
    <section class="settings-section">
      <h3>NeoLearn Privacy</h3>
      <div class="setting-item">
        <div class="setting-text">
          <label for="privacyShowLastSeen">Show my last seen</label>
          <span class="setting-desc">Let others see when you were last online.</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="privacyShowLastSeen">
          <span class="slider round"></span>
        </label>
      </div>
      <div class="setting-item">
        <div class="setting-text">
          <label for="privacyReadReceipts">Read receipts</label>
          <span class="setting-desc">Let others see when you have read their messages.</span>
        </div>
        <label class="switch">
          <input type="checkbox" id="privacyReadReceipts">
          <span class="slider round"></span>
        </label>
      </div>
    </section>
    `;
    html = html.replace('</main>', privacySection + '\n  </main>');
    fs.writeFileSync('htmls/setting.html', html);
}

// 2. js/settings.js
let js = fs.readFileSync('js/settings.js', 'utf8');
if (!js.includes('privacyShowLastSeen')) {
    const vars = `
const privacyShowLastSeen = document.getElementById('privacyShowLastSeen');
const privacyReadReceipts = document.getElementById('privacyReadReceipts');
`;
    js = js.replace("const deleteAccountBtn = document.getElementById('deleteAccountBtn');", vars + "const deleteAccountBtn = document.getElementById('deleteAccountBtn');");

    const loadCode = `
      // Load NeoLearn privacy settings
      if (privacyShowLastSeen && privacyReadReceipts) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
              const data = userDoc.data();
              privacyShowLastSeen.checked = data.showLastSeen !== false;
              privacyReadReceipts.checked = data.readReceipts !== false;
          } else {
              privacyShowLastSeen.checked = true;
              privacyReadReceipts.checked = true;
          }
      }
    `;
    js = js.replace("emailUpdatesSwitch.checked = (emailUpdates === undefined || emailUpdates === true);", "emailUpdatesSwitch.checked = (emailUpdates === undefined || emailUpdates === true);\n" + loadCode);

    const saveCode = `
    if (privacyShowLastSeen && privacyReadReceipts) {
        updates.showLastSeen = privacyShowLastSeen.checked;
        updates.readReceipts = privacyReadReceipts.checked;
    }
    `;
    js = js.replace("updates.theme = themeSelect.value;", "updates.theme = themeSelect.value;\n" + saveCode);

    fs.writeFileSync('js/settings.js', js);
}
