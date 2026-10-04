const fs = require('fs');

// 1. Fix Bug 1 in neolearn-social-ui.js
let uiCode = fs.readFileSync('js/neolearn-social-ui.js', 'utf8');

// Change createNeoLearnLikeButton to establish state from initial snapshot
uiCode = uiCode.replace(
  /export function createNeoLearnLikeButton\(\{ postId, isLiked = false, likeCount = null \}, status\) \{([\s\S]*?)const icon = element\('i', isLiked \? 'bi bi-heart-fill' : 'bi bi-heart', ''\);\s*icon\.setAttribute\('aria-hidden', 'true'\);\s*const labelSpan = element\('span', '', isLiked \? 'Liked' : 'Like'\);\s*const countSpan = element\('span', 'nl-like-count', likeCount === null \? '—' : String\(likeCount\)\);/,
  `export function createNeoLearnLikeButton({ postId, isLiked = false, likeCount = null }, status) {
  const likeButton = element('button', 'nl-post-action', '');
  likeButton.type = 'button';
  likeButton.disabled = true; // Wait for initial snapshot

  let currentIsLiked = false;

  function applyLikeState(liked, count) {
    currentIsLiked = liked;
    likeButton.disabled = false;
    likeButton.setAttribute('aria-pressed', String(liked));
    likeButton.setAttribute('aria-label', liked ? 'Unlike this post' : 'Like this post');
    icon.className = liked ? 'bi bi-heart-fill' : 'bi bi-heart';
    labelSpan.textContent = liked ? 'Liked' : 'Like';
    if (typeof count === 'number') {
      countSpan.textContent = String(count);
      countSpan.title = \`\${count} like\${count === 1 ? '' : 's'}\`;
    }
  }

  const icon = element('i', 'bi bi-heart', '');
  icon.setAttribute('aria-hidden', 'true');
  const labelSpan = element('span', '', 'Loading...');
  const countSpan = element('span', 'nl-like-count', '—');`
);

// 2. Fix Bug 2 in neolearn-social-ui.js (Comment Profile Resolution)
uiCode = uiCode.replace(
  /function renderComment\(comment\) \{([\s\S]*?)return item;\n\}/,
  `const profileCache = new Map();
import { auth } from './auth.js';

async function resolveProfile(userId) {
  if (profileCache.has(userId)) return profileCache.get(userId);
  try {
    const profile = await getNeoLearnProfile(auth.currentUser, userId);
    const data = {
      name: profile.name || profile.username || 'NeoLearn user',
      photo: profile.profilePhotoUrl
    };
    profileCache.set(userId, data);
    return data;
  } catch (err) {
    const fallback = { name: 'NeoLearn user', photo: null };
    profileCache.set(userId, fallback);
    return fallback;
  }
}

function renderComment(comment) {
  const item = element('div', 'nl-comment-item');
  const meta = element('div', 'nl-comment-meta');
  
  const avatarSpan = element('span', 'nl-social-avatar nl-social-avatar--small nl-comment-avatar', '');
  const authorSpan = element('span', 'nl-comment-author', 'Loading...');
  meta.append(avatarSpan, authorSpan);
  
  if (comment.createdAt) {
    const ts = element('time', 'nl-comment-time', formatDate(comment.createdAt));
    ts.dateTime = new Date(comment.createdAt).toISOString();
    meta.append(ts);
  }
  const text = element('p', 'nl-comment-text', '');
  text.textContent = comment.text;
  item.append(meta, text);
  
  resolveProfile(comment.userId).then(profile => {
    authorSpan.textContent = profile.name;
    const img = profileImage(profile.photo, profile.name, 'nl-social-avatar nl-social-avatar--small nl-comment-avatar');
    avatarSpan.replaceWith(img);
  });
  
  return item;
}`
);

fs.writeFileSync('js/neolearn-social-ui.js', uiCode);
