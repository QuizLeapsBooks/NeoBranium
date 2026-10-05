import re

with open('js/neolearn-messages.js', 'r') as f:
    js = f.read()

presence_ui_code = """
let peerPresenceUnsubscribe = null;

function subscribeToPeerPresence(peerId) {
    if (peerPresenceUnsubscribe) {
        peerPresenceUnsubscribe();
        peerPresenceUnsubscribe = null;
    }
    const presenceRef = ref(rtdb, `/neolearn_realtime/presence/` + peerId);
    peerPresenceUnsubscribe = onValue(presenceRef, (snap) => {
        const status = snap.val();
        let statusText = 'Offline';
        if (status) {
            if (status.state === 'online') {
                statusText = 'Online';
            } else if (status.last_changed) {
                const date = new Date(status.last_changed);
                statusText = 'Last seen: ' + new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' }).format(date);
            }
        }
        let statusEl = document.getElementById('messageThreadPresence');
        if (!statusEl) {
            statusEl = document.createElement('div');
            statusEl.id = 'messageThreadPresence';
            statusEl.style.fontSize = '0.75rem';
            statusEl.style.color = 'var(--account-muted)';
            const headerDiv = threadHeader.querySelector('div');
            if (headerDiv) headerDiv.appendChild(statusEl);
        }
        statusEl.textContent = statusText;
    });
}
"""

if "subscribeToPeerPresence" not in js:
    js = js.replace("async function selectPeer(peer) {", presence_ui_code + "\nasync function selectPeer(peer) {")
    js = js.replace("threadProfile.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;", 
                    "threadProfile.href = `/htmls/neolearn/profile.html?uid=${encodeURIComponent(peer.userId)}`;\n  subscribeToPeerPresence(peer.userId);")
    js = js.replace("function returnToPeerList() {", 
                    "function returnToPeerList() {\n  if (peerPresenceUnsubscribe) { peerPresenceUnsubscribe(); peerPresenceUnsubscribe = null; }")
    
    with open('js/neolearn-messages.js', 'w') as f:
        f.write(js)
    print("Patched presence UI")
