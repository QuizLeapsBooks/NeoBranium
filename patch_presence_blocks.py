import re

with open('js/neolearn-messages.js', 'r') as f:
    js = f.read()

# I will append the presence tracking
presence_code = """
import { onDisconnect } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';

let presenceUnsubscribe = null;
function setupPresence(user) {
  if (!user) return;
  const userStatusDatabaseRef = ref(rtdb, `/neolearn_realtime/presence/` + user.uid);
  const isOfflineForDatabase = {
      state: 'offline',
      last_changed: serverTimestamp(),
  };
  const isOnlineForDatabase = {
      state: 'online',
      last_changed: serverTimestamp(),
  };

  const connectedRef = ref(rtdb, '.info/connected');
  onValue(connectedRef, (snap) => {
      if (snap.val() === true) {
          onDisconnect(userStatusDatabaseRef).set(isOfflineForDatabase).then(() => {
              set(userStatusDatabaseRef, isOnlineForDatabase);
          });
      }
  });
}
"""

if "setupPresence" not in js:
    js = js.replace("import { endAt, get, limitToLast, onValue, orderByChild, push, query, ref, serverTimestamp, set } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';",
                    "import { endAt, get, limitToLast, onValue, orderByChild, push, query, ref, serverTimestamp, set, onDisconnect } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';")
    
    init_match = "async function initialize() {"
    js = js.replace(init_match, init_match + "\n  setupPresence(auth.currentUser);")
    js += "\n\n" + presence_code.replace("import { onDisconnect } from 'https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js';\n", "")
    
    with open('js/neolearn-messages.js', 'w') as f:
        f.write(js)
    print("Patched presence")
