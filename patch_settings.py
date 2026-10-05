import re

with open('htmls/setting.html', 'r') as f:
    html = f.read()

privacy_html = """
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
"""

if 'neolearnPrivacySettings' not in html:
    html = html.replace('<div class="settings-actions">', privacy_html + '            <div class="settings-actions">', 1)
    with open('htmls/setting.html', 'w') as f:
        f.write(html)
    print("Patched setting.html")
else:
    print("setting.html already patched")
