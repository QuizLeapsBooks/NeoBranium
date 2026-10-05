import fs from 'fs';

let content = fs.readFileSync('js/neolearn-messages.js', 'utf8');

// 1. Change getNeoLearnPeersPage to use getConnections
// Actually, it uses getNeoLearnPeersPage which is in neolearn-social-service.js. 
// We can just import and use a new function or fetch directly.
content = content.replace(
  "const page = await getNeoLearnPeersPage(user, nextPeersCursor);",
  `const page = await getNeoLearnPeersPage(user, nextPeersCursor, 'learning');`
);
content = content.replace(
  "const page = await getNeoLearnPeersPage(user);",
  `const page = await getNeoLearnPeersPage(user, null, 'learning');`
);

// 2. Modify subscribeToPeerUnreadMessages to bound reads
content = content.replace(
  `const recentConversation = query(
    conversationRef(user.uid, peer.userId),
    orderByChild('createdAt'),
    limitToLast(NEOLEARN_MESSAGE_PAGE_SIZE)
  );`,
  `const recentConversation = query(
    conversationRef(user.uid, peer.userId),
    orderByChild('createdAt'),
    limitToLast(activePeer?.userId === peer.userId ? NEOLEARN_MESSAGE_PAGE_SIZE : 1)
  );`
);

// 3. Mark read using API
const markReadCode = `
  await fetch('/api/neolearn/messages/seen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await auth.currentUser.getIdToken() },
    body: JSON.stringify({ targetUserId: peerId, messageIds: unreadEntries.map(e => e[0]) })
  });
`;

content = content.replace(
  `await Promise.all(unreadEntries.map(async ([messageId]) => {
    try {
      await set(ref(rtdb, \`neolearn_direct_messages/\${[uid, peerId].sort().join('/')}/messages/\${messageId}/readByRecipient\`), true);
    } catch (error) {
      console.warn('[NeoLearn Messages] Could not mark message read:', error?.message || error);
    }
  }));`,
  markReadCode
);

// 4. Send message using API
const sendCode = `
  const response = await fetch('/api/neolearn/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await auth.currentUser.getIdToken() },
    body: JSON.stringify({ targetUserId: activePeer.userId, text })
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Message could not be sent.');
  }
`;

content = content.replace(
  `await push(conversationRef(uid, activePeer.userId), {
      senderId: uid,
      text,
      createdAt: serverTimestamp()
    });`,
  sendCode
);

// 5. Hide Last Seen if disabled
// We will update subscribeToPeerPresence to respect the setting if available. But the prompt says "fetch the peer's privacy setting. If showLastSeen is false, hide the exact timestamp/online status."
// We'll modify it later.

fs.writeFileSync('js/neolearn-messages.js', content);
