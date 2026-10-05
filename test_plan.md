# NeoLearn Messages Implementation Plan

## 1. Learning-Only Messaging & Chat List
- Modify `js/neolearn-messages.js` to fetch peers from `/api/neolearn/social/connections/:uid?type=learning` instead of `/api/neolearn/peers`. This ensures only "Learning" peers are shown in the chat list.
- Fallback: If `getConnections` doesn't provide what we need, we will filter locally but ALSO enforce on the backend.

## 2. Real-time Listeners & Unbounded Reads (Performance)
- Fix the N+1 unbounded reads issue flagged in the audit. Currently, the app loads the last 50 messages for EVERY peer on page load to count unread messages.
- Strategy: For non-active peers, change the RTDB listener to `limitToLast(1)`. If the single latest message is unread, we show an unread dot (or "1+"). For the active peer, we load the standard 50-message page. This bounds the data read significantly.

## 3. Authorization Architecture (Sending & Seen Status)
- RTDB rules cannot natively query Firestore relationships/blocks.
- Create new backend endpoints in `server.js` (and a handler module like `neolearn-message-handler.js`):
  - `POST /api/neolearn/messages/send`: Validates identity, block status, and learning relationship before writing the message to RTDB using `admin.database()`.
  - `POST /api/neolearn/messages/seen`: Validates that the user is the recipient before marking a message as seen in RTDB.
- Change `neolearn-messages.js` to use these API endpoints instead of direct `push()` and `set()` on RTDB.
- Update `database.rules.json` to block client writes to `neolearn_direct_messages` entirely (or restrict them strictly). Since reads of old messages between previously-learning users are acceptable (they just can't send new ones), direct client reads remain allowed for participants.

## 4. Privacy Settings (Last Seen & Read Receipts)
- Add "Show my last seen" and "Read receipts" toggles to `htmls/setting.html` and `js/settings.js`.
- Store these in Firestore under `neolearn_profiles` or `users` (e.g. `messagePrivacySettings: { showLastSeen: true, readReceipts: true }`).
- When sending a read receipt, check the user's setting. If disabled, do not send the receipt (or don't expose it).
- When rendering presence/last seen, fetch the peer's privacy setting. If `showLastSeen` is false, hide the exact timestamp/online status.

## 5. Block Integration
- Existing blocks (checked in the backend) will correctly block sending/receiving via the new backend endpoints.
- If a user is blocked, they will be omitted from the "Learning" list API response, hiding them from the Messages page.

## 6. UI & State
- Add proper loading/empty/error states to `messages.html` (skeleton loaders, "You're not learning anyone yet" messages).
- Ensure mobile responsiveness and dark mode compatibility using existing CSS variables.
