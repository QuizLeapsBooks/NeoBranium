import { auth } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';

const rail = document.getElementById('nlMomentsRail');
const loading = document.getElementById('nlMomentsLoading');
const status = document.getElementById('nlMomentsStatus');
const createDialog = document.getElementById('nlMomentCreateDialog');
const createForm = document.getElementById('nlMomentCreateForm');
const imageInput = document.getElementById('nlMomentImageInput');
const imageLabel = document.getElementById('nlMomentImageLabel');
const preview = document.getElementById('nlMomentPreview');
const captionInput = document.getElementById('nlMomentCaption');
const audienceInput = document.getElementById('nlMomentAudience');
const createError = document.getElementById('nlMomentCreateError');
const shareButton = document.getElementById('shareNeoLearnMoment');
const viewer = document.getElementById('nlMomentViewer');
const viewerImage = document.getElementById('nlMomentViewerImage');
const viewerAuthor = document.getElementById('nlMomentViewerAuthor');
const viewerCaption = document.getElementById('nlMomentViewerCaption');
const viewerProgress = document.getElementById('nlMomentProgress');
const likeButton = document.getElementById('likeNeoLearnMoment');
let moments = [];
let activeIndex = -1;
let viewerTimer = null;
let selectedFile = null;
let busy = false;

async function request(path, { method = 'GET', body } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in to use Moments.');
  const token = await user.getIdToken();
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.success) throw new Error(result.error || 'Moments could not be loaded.');
  return result;
}

function makeAvatar(moment, className = '') {
  const avatar = document.createElement('span');
  avatar.className = `nl-moment-avatar ${className}`.trim();
  if (moment.author?.profilePhotoUrl) {
    const image = document.createElement('img');
    image.src = moment.author.profilePhotoUrl;
    image.alt = '';
    image.loading = 'lazy';
    avatar.append(image);
  } else {
    avatar.textContent = (moment.author?.name || 'N').trim().charAt(0).toUpperCase();
  }
  return avatar;
}

function renderRail() {
  const addButton = document.getElementById('addNeoLearnMoment');
  rail.replaceChildren(addButton);
  const grouped = new Map();
  for (const moment of moments) {
    const group = grouped.get(moment.userId) || [];
    group.push(moment);
    grouped.set(moment.userId, group);
  }
  for (const group of grouped.values()) {
    const moment = group[0];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nl-moment-person';
    button.setAttribute('aria-label', `View ${moment.author?.name || 'learner'}’s Moment`);
    const avatar = makeAvatar(moment, 'nl-moment-avatar--ring');
    const name = document.createElement('span');
    name.textContent = moment.userId === auth.currentUser?.uid ? 'You' : moment.author?.name || 'Learner';
    button.append(avatar, name);
    button.addEventListener('click', () => openMoment(moments.indexOf(moment)));
    rail.append(button);
  }
}

async function loadMoments() {
  loading.hidden = false;
  status.textContent = '';
  try {
    const result = await request('/api/neolearn/moments');
    moments = Array.isArray(result.moments) ? result.moments : [];
    renderRail();
    loading.hidden = true;
    if (window.location.hash.startsWith('#moment-')) {
      const targetId = decodeURIComponent(window.location.hash.slice('#moment-'.length));
      const index = moments.findIndex((moment) => moment.momentId === targetId);
      if (index >= 0) openMoment(index);
    }
  } catch (error) {
    loading.hidden = true;
    status.textContent = error.message || 'Moments could not be loaded.';
  }
}

function openMoment(index) {
  if (index < 0 || index >= moments.length) return;
  activeIndex = index;
  renderMoment();
  if (!viewer.open) viewer.showModal();
}

function renderMoment() {
  const moment = moments[activeIndex];
  if (!moment) return closeViewer();
  window.clearTimeout(viewerTimer);
  viewerImage.src = moment.imageUrl;
  viewerImage.alt = `Moment shared by ${moment.author?.name || 'NeoLearn learner'}`;
  viewerCaption.textContent = moment.caption || '';
  viewerCaption.hidden = !moment.caption;
  viewerAuthor.replaceChildren(makeAvatar(moment, 'nl-moment-avatar--tiny'));
  const authorName = document.createElement('strong');
  authorName.textContent = moment.author?.name || 'NeoLearn learner';
  const time = document.createElement('span');
  time.textContent = '24h Moment';
  viewerAuthor.append(authorName, time);
  const likeIcon = likeButton.querySelector('i');
  likeIcon.className = moment.isLiked ? 'bi bi-heart-fill' : 'bi bi-heart';
  likeButton.classList.toggle('is-liked', moment.isLiked);
  likeButton.querySelector('span').textContent = moment.isLiked ? 'Liked' : 'Like';
  likeButton.querySelector('.nl-moment-like-count').textContent = String(moment.likeCount || 0);
  document.getElementById('previousNeoLearnMoment').disabled = activeIndex === 0;
  document.getElementById('nextNeoLearnMoment').disabled = activeIndex === moments.length - 1;
  viewerProgress.style.setProperty('--moment-duration', '6500ms');
  viewerProgress.classList.remove('is-running');
  void viewerProgress.offsetWidth;
  viewerProgress.classList.add('is-running');
  viewerTimer = window.setTimeout(() => {
    if (activeIndex < moments.length - 1) {
      activeIndex += 1;
      renderMoment();
    } else closeViewer();
  }, 6500);
}

function closeViewer() {
  window.clearTimeout(viewerTimer);
  viewerTimer = null;
  if (viewer.open) viewer.close();
  if (window.location.hash.startsWith('#moment-')) history.replaceState(null, '', `${location.pathname}${location.search}`);
}

function openCreateDialog() {
  createError.hidden = true;
  createError.textContent = '';
  if (!createDialog.open) createDialog.showModal();
}

function resetCreateDialog() {
  selectedFile = null;
  imageInput.value = '';
  preview.removeAttribute('src');
  preview.hidden = true;
  imageLabel.textContent = 'Choose a photo';
  captionInput.value = '';
  audienceInput.value = 'everyone';
  shareButton.disabled = true;
  shareButton.querySelector('span').textContent = 'Share Moment';
  busy = false;
}

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
    createError.textContent = 'Choose a JPG, PNG, or WebP photo under 5 MiB.';
    createError.hidden = false;
    imageInput.value = '';
    return;
  }
  selectedFile = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  imageLabel.textContent = file.name;
  shareButton.disabled = false;
  createError.hidden = true;
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedFile || busy) return;
  busy = true;
  shareButton.disabled = true;
  shareButton.querySelector('span').textContent = 'Sharing…';
  createError.hidden = true;
  try {
    const image = await new Promise((resolve, reject) => {
      const imageElement = new Image();
      imageElement.onload = () => {
        const scale = Math.min(1, 1080 / imageElement.naturalWidth, 1920 / imageElement.naturalHeight);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(imageElement.naturalWidth * scale);
        canvas.height = Math.round(imageElement.naturalHeight * scale);
        canvas.getContext('2d').drawImage(imageElement, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (!blob || blob.size > 5 * 1024 * 1024) return reject(new Error('This photo could not be prepared under 5 MiB.'));
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('This photo could not be prepared.'));
          reader.readAsDataURL(blob);
        }, 'image/webp', 0.86);
      };
      imageElement.onerror = () => reject(new Error('This photo could not be opened.'));
      imageElement.src = URL.createObjectURL(selectedFile);
    });
    const result = await request('/api/neolearn/moments', {
      method: 'POST',
      body: { image, mimeType: 'image/webp', caption: captionInput.value.trim(), audience: audienceInput.value, uploadId: crypto.randomUUID() }
    });
    createDialog.close();
    resetCreateDialog();
    status.textContent = 'Your Moment is live for 24 hours.';
    await loadMoments();
    const createdIndex = moments.findIndex((moment) => moment.momentId === result.momentId);
    if (createdIndex >= 0) openMoment(createdIndex);
  } catch (error) {
    createError.textContent = error.message || 'Your Moment could not be shared.';
    createError.hidden = false;
    shareButton.disabled = false;
    shareButton.querySelector('span').textContent = 'Share Moment';
    busy = false;
  }
});

likeButton.addEventListener('click', async () => {
  const moment = moments[activeIndex];
  if (!moment) return;
  likeButton.disabled = true;
  try {
    const result = await request('/api/neolearn/moments/like', { method: 'POST', body: { momentId: moment.momentId } });
    moment.isLiked = result.isLiked;
    moment.likeCount = result.likeCount;
    renderMoment();
  } catch (error) {
    status.textContent = error.message || 'Like could not be saved.';
  } finally {
    likeButton.disabled = false;
  }
});

document.getElementById('addNeoLearnMoment').addEventListener('click', openCreateDialog);
document.getElementById('closeMomentCreate').addEventListener('click', () => createDialog.close());
document.getElementById('closeMomentViewer').addEventListener('click', closeViewer);
document.getElementById('previousNeoLearnMoment').addEventListener('click', () => openMoment(activeIndex - 1));
document.getElementById('nextNeoLearnMoment').addEventListener('click', () => openMoment(activeIndex + 1));
createDialog.addEventListener('close', resetCreateDialog);
viewer.addEventListener('close', () => window.clearTimeout(viewerTimer));
viewer.addEventListener('click', (event) => { if (event.target === viewer) closeViewer(); });
document.addEventListener('keydown', (event) => {
  if (!viewer.open) return;
  if (event.key === 'ArrowRight' && activeIndex < moments.length - 1) openMoment(activeIndex + 1);
  if (event.key === 'ArrowLeft' && activeIndex > 0) openMoment(activeIndex - 1);
});

const authObserver = await import('https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js');
authObserver.onAuthStateChanged(auth, (user) => {
  if (user) loadMoments();
  else {
    moments = [];
    renderRail();
    loading.hidden = true;
  }
});
