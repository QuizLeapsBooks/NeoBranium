import re

with open('js/neolearn-messages.js', 'r') as f:
    js = f.read()

seen_patch = """
      if (Number.isFinite(message.createdAt)) {
        const time = document.createElement('time');
        time.className = 'nl-message-time';
        time.dateTime = new Date(message.createdAt).toISOString();
        time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt);
        if (message.senderId === auth.currentUser?.uid) {
            const statusIcon = document.createElement('i');
            statusIcon.className = message.readByRecipient ? 'bi bi-check2-all' : 'bi bi-check2';
            statusIcon.style.marginLeft = '4px';
            statusIcon.style.color = message.readByRecipient ? '#4ade80' : 'inherit';
            time.appendChild(statusIcon);
        }
        bubble.append(time);
      }
"""

if "bi-check2-all" not in js:
    # We replace the time block inside entries.forEach
    old_time_block = """      if (Number.isFinite(message.createdAt)) {
        const time = document.createElement('time');
        time.className = 'nl-message-time';
        time.dateTime = new Date(message.createdAt).toISOString();
        time.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(message.createdAt);
        bubble.append(time);
      }"""
    if old_time_block in js:
        js = js.replace(old_time_block, seen_patch)
        with open('js/neolearn-messages.js', 'w') as f:
            f.write(js)
        print("Patched seen UI")
    else:
        print("old_time_block not found")
else:
    print("seen UI already patched")
