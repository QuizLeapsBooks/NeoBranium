import fs from 'fs';

let content = fs.readFileSync('js/neolearn-messages.js', 'utf8');

// The subscribeToPeerPresence function is defined like this:
// function subscribeToPeerPresence(peerId) {
// I need to change it to accept the peer object: subscribeToPeerPresence(peer)
content = content.replace(
  'function subscribeToPeerPresence(peerId) {',
  'function subscribeToPeerPresence(peer) {\n    const peerId = peer.userId;'
);

// We need to hide exact last seen and presence if showLastSeen === false
const presenceLogic = `
        if (!peer.showLastSeen) {
            statusText = '';
        } else if (status) {
            if (status.state === 'online') {
`;
content = content.replace(
  `if (status) {
            if (status.state === 'online') {`,
  presenceLogic
);

content = content.replace(
  'subscribeToPeerPresence(peer.userId);',
  'subscribeToPeerPresence(peer);'
);

fs.writeFileSync('js/neolearn-messages.js', content);
