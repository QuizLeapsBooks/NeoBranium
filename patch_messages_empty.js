import fs from 'fs';
let js = fs.readFileSync('js/neolearn-messages.js', 'utf8');

js = js.replace(
  "empty.textContent = peers.length || nextPeersCursor ? 'No learners match your search.' : 'No learners are available yet.';",
  "empty.innerHTML = peers.length || nextPeersCursor ? 'No learners match your search.' : 'You\\'re not Learning anyone yet. <a href=\"/htmls/neolearn/peers.html\" style=\"color: var(--primary-accent); text-decoration: underline;\">Find peers</a>';"
);

fs.writeFileSync('js/neolearn-messages.js', js);
