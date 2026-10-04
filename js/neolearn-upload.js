import { auth } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40000000;
const OUTPUT_EDGE = 1600;
const DESCRIPTION_LIMIT = 500;
const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const dialog = document.getElementById('neolearnUploadDialog');
const canvas = document.getElementById('neolearnImageCanvas');
const context = canvas.getContext('2d');
const stage = document.getElementById('neolearnUploadStage');
const emptyState = document.getElementById('neolearnUploadEmpty');
const fileInput = document.getElementById('neolearnImageInput');
const fileName = document.getElementById('neolearnFileName');
const errorMessage = document.getElementById('neolearnUploadError');
const chooseButton = document.getElementById('chooseNeoLearnImage');
const closeButton = document.getElementById('closeNeoLearnUpload');
const cancelButton = document.getElementById('cancelNeoLearnUpload');
const resetButton = document.getElementById('resetNeoLearnEditor');
const shareButton = document.getElementById('shareNeoLearnImage');
const descriptionInput = document.getElementById('neolearnDescription');
const descriptionCount = document.getElementById('neolearnDescriptionCount');
const editorControls = document.getElementById('neolearnEditorControls');
const uploadStatus = document.getElementById('neolearnUploadStatus');

const controls = {
  cropRatio: document.getElementById('neolearnCropRatio'),
  zoom: document.getElementById('neolearnZoom'),
  zoomValue: document.getElementById('neolearnZoomValue'),
  filter: document.getElementById('neolearnFilter'),
  brightness: document.getElementById('neolearnBrightness'),
  brightnessValue: document.getElementById('neolearnBrightnessValue'),
  contrast: document.getElementById('neolearnContrast'),
  contrastValue: document.getElementById('neolearnContrastValue'),
  saturation: document.getElementById('neolearnSaturation'),
  saturationValue: document.getElementById('neolearnSaturationValue'),
  rotateLeft: document.getElementById('rotateNeoLearnLeft'),
  rotateRight: document.getElementById('rotateNeoLearnRight')
};

const state = {
  file: null,
  image: null,
  objectUrl: null,
  uploadId: null,
  rotation: 0,
  zoom: 1,
  panX: 0,
  panY: 0,
  ratio: '4:3',
  filter: 'none',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  pointer: null,
  busy: false
};

function setError(message) {
  errorMessage.textContent = message;
  errorMessage.hidden = !message;
}

function setUploadStatus(message) {
  uploadStatus.textContent = message;
  uploadStatus.classList.toggle('is-visible', Boolean(message));
  uploadStatus.classList.toggle('is-success', Boolean(message));
}

function setBusy(busy) {
  state.busy = busy;
  closeButton.disabled = busy;
  cancelButton.disabled = busy;
  chooseButton.disabled = busy || !auth.currentUser;
  resetButton.disabled = busy || !state.image;
  shareButton.disabled = busy || !state.image || !auth.currentUser;
  editorControls.querySelectorAll('select, input, textarea, button').forEach((control) => {
    control.disabled = busy || !state.image;
  });
  shareButton.querySelector('span').textContent = busy ? 'Uploading…' : 'Share';
  shareButton.querySelector('i').className = busy ? 'bi bi-arrow-repeat me-1' : 'bi bi-send me-1';
}

function currentAspectRatio() {
  const [width, height] = state.ratio.split(':').map(Number);
  return width / height;
}

function outputDimensions() {
  const ratio = currentAspectRatio();
  return ratio >= 1
    ? { width: OUTPUT_EDGE, height: Math.round(OUTPUT_EDGE / ratio) }
    : { width: Math.round(OUTPUT_EDGE * ratio), height: OUTPUT_EDGE };
}

function getFilterString() {
  const effects = {
    none: '',
    mono: ' grayscale(1)',
    warm: ' sepia(.28)',
    soft: ' saturate(1.18)'
  };
  return `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)${effects[state.filter] || ''}`;
}

function drawPreview() {
  if (!state.image) return;
  const { width, height } = outputDimensions();
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  stage.style.setProperty('--crop-ratio', `${width} / ${height}`);

  const quarterTurn = Math.abs(state.rotation % 180) === 90;
  const rotatedWidth = quarterTurn ? state.image.naturalHeight : state.image.naturalWidth;
  const rotatedHeight = quarterTurn ? state.image.naturalWidth : state.image.naturalHeight;
  const scale = Math.max(width / rotatedWidth, height / rotatedHeight) * state.zoom;
  const renderedWidth = rotatedWidth * scale;
  const renderedHeight = rotatedHeight * scale;
  const maxPanX = Math.max(0, (renderedWidth - width) / 2);
  const maxPanY = Math.max(0, (renderedHeight - height) / 2);
  state.panX = Math.max(-maxPanX, Math.min(maxPanX, state.panX));
  state.panY = Math.max(-maxPanY, Math.min(maxPanY, state.panY));

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#111827';
  context.fillRect(0, 0, width, height);
  context.save();
  context.beginPath();
  context.rect(0, 0, width, height);
  context.clip();
  context.translate(width / 2 + state.panX, height / 2 + state.panY);
  context.rotate(state.rotation * Math.PI / 180);
  context.filter = getFilterString();
  context.drawImage(
    state.image,
    -state.image.naturalWidth * scale / 2,
    -state.image.naturalHeight * scale / 2,
    state.image.naturalWidth * scale,
    state.image.naturalHeight * scale
  );
  context.restore();
}

function syncControlValues() {
  controls.zoom.value = String(state.zoom);
  controls.zoomValue.value = `${state.zoom.toFixed(1)}×`;
  controls.cropRatio.value = state.ratio;
  controls.filter.value = state.filter;
  controls.brightness.value = String(state.brightness);
  controls.brightnessValue.value = `${state.brightness}%`;
  controls.contrast.value = String(state.contrast);
  controls.contrastValue.value = `${state.contrast}%`;
  controls.saturation.value = String(state.saturation);
  controls.saturationValue.value = `${state.saturation}%`;
  descriptionCount.textContent = `${descriptionInput.value.length}/${DESCRIPTION_LIMIT}`;
  stage.style.setProperty('--crop-ratio', state.ratio.replace(':', ' / '));
  drawPreview();
}

function resetEditor() {
  state.rotation = 0;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.ratio = '4:3';
  state.filter = 'none';
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  syncControlValues();
  setError('');
}

function clearSelectedImage() {
  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.file = null;
  state.image = null;
  state.objectUrl = null;
  state.uploadId = null;
  state.pointer = null;
  state.rotation = 0;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.ratio = '4:3';
  state.filter = 'none';
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  descriptionInput.value = '';
  fileInput.value = '';
  fileName.textContent = 'JPG, PNG or WebP · up to 5 MiB';
  canvas.hidden = true;
  emptyState.hidden = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  syncControlValues();
  setBusy(false);
}

function sniffImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return 'image/png';
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  ) return 'image/webp';
  return null;
}

function normalizeDeclaredType(type) {
  return type.toLowerCase() === 'image/jpg' ? 'image/jpeg' : type.toLowerCase();
}

async function loadSelectedImage(file) {
  if (!file) return;
  setError('');
  if (file.size > MAX_IMAGE_BYTES) {
    setError('This image is larger than 5 MiB. Choose a smaller image.');
    fileInput.value = '';
    return;
  }
  if (file.size === 0) {
    setError('This image file is empty. Choose another image.');
    fileInput.value = '';
    return;
  }

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  const actualType = sniffImageType(bytes);
  const declaredType = normalizeDeclaredType(file.type || '');
  if (!actualType || !ALLOWED_IMAGE_TYPES.has(actualType) || (declaredType && declaredType !== actualType)) {
    setError('Unsupported or invalid image. Choose a genuine JPG, PNG, or WebP image.');
    fileInput.value = '';
    return;
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('This image could not be decoded. Try another image.'));
      image.src = objectUrl;
    });
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > MAX_IMAGE_PIXELS) {
      throw new Error('This image has dimensions that are too large to edit safely.');
    }
  } catch (error) {
    URL.revokeObjectURL(objectUrl);
    setError(error.message);
    fileInput.value = '';
    return;
  }

  if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
  state.file = file;
  state.image = image;
  state.objectUrl = objectUrl;
  state.uploadId = crypto.randomUUID();
  state.rotation = 0;
  state.zoom = 1;
  state.panX = 0;
  state.panY = 0;
  state.ratio = '4:3';
  state.filter = 'none';
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  fileName.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MiB`;
  canvas.hidden = false;
  emptyState.hidden = true;
  setBusy(false);
  syncControlValues();
}

function openDialog() {
  setError('');
  setUploadStatus('');
  if (!dialog.open) dialog.showModal();
  if (!auth.currentUser) {
    setError('Please sign in before choosing or sharing an image.');
  }
  setBusy(false);
}

function closeDialog() {
  if (state.busy) return;
  dialog.close();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The edited image could not be prepared. Please try again.'));
    reader.readAsDataURL(blob);
  });
}

async function shareImage() {
  const user = auth.currentUser;
  if (!user) {
    setError('Please sign in before sharing an image.');
    return;
  }
  if (!state.image || !state.uploadId || state.busy) return;

  setError('');
  setBusy(true);
  try {
    const imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', 0.88));
    if (!imageBlob) throw new Error('The edited image could not be rendered. Please try again.');
    if (imageBlob.size > MAX_IMAGE_BYTES) throw new Error('The edited image exceeds 5 MiB. Reduce the crop or choose a smaller source image.');

    const image = await blobToDataUrl(imageBlob);
    const token = await user.getIdToken();
    let response;
    try {
      response = await fetch(`${getBackendBaseUrl()}/api/neolearn/upload-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          image,
          mimeType: 'image/webp',
          description: descriptionInput.value.trim(),
          uploadId: state.uploadId
        })
      });
    } catch {
      throw new Error('The upload service could not be reached. Your image is still here; retry Share when the service is available.');
    }

    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(`The upload service returned an invalid response (HTTP ${response.status}). Your image is still here; retry Share.`);
    }
    if (!response.ok || !result.success) {
      if (result.stage === 'firestore') {
        throw new Error(result.cleanupSucceeded
          ? 'The image upload completed, but the post could not be saved. Your edits are still here; retry Share to continue.'
          : 'The post could not be saved after image upload. Your edits are still here; retry Share to reuse the same storage location.');
      }
      throw new Error(result.error || 'The image could not be shared. Please try again.');
    }

    dialog.close();
    clearSelectedImage();
    setUploadStatus('Your learning moment was shared successfully.');
    document.dispatchEvent(new CustomEvent('neolearnPostCreated', { detail: { postId: result.postId } }));
    window.setTimeout(() => setUploadStatus(''), 6000);
  } catch (error) {
    setError(error.message || 'The image could not be shared. Please try again.');
  } finally {
    if (dialog.open) setBusy(false);
  }
}

document.querySelectorAll('[data-neolearn-upload]').forEach((button) => {
  button.addEventListener('click', openDialog);
});

chooseButton.addEventListener('click', () => {
  if (!auth.currentUser || state.busy) return;
  fileInput.click();
});
fileInput.addEventListener('change', () => {
  if (fileInput.files?.length > 1) {
    setError('Choose one image at a time.');
    fileInput.value = '';
    return;
  }
  loadSelectedImage(fileInput.files?.[0]);
});

controls.cropRatio.addEventListener('change', () => {
  state.ratio = controls.cropRatio.value;
  state.panX = 0;
  state.panY = 0;
  drawPreview();
});
controls.rotateLeft.addEventListener('click', () => {
  state.rotation = (state.rotation + 270) % 360;
  state.panX = 0;
  state.panY = 0;
  drawPreview();
});
controls.rotateRight.addEventListener('click', () => {
  state.rotation = (state.rotation + 90) % 360;
  state.panX = 0;
  state.panY = 0;
  drawPreview();
});
controls.zoom.addEventListener('input', () => {
  state.zoom = Number(controls.zoom.value);
  controls.zoomValue.value = `${state.zoom.toFixed(1)}×`;
  drawPreview();
});
controls.filter.addEventListener('change', () => {
  state.filter = controls.filter.value;
  drawPreview();
});
controls.brightness.addEventListener('input', () => {
  state.brightness = Number(controls.brightness.value);
  controls.brightnessValue.value = `${state.brightness}%`;
  drawPreview();
});
controls.contrast.addEventListener('input', () => {
  state.contrast = Number(controls.contrast.value);
  controls.contrastValue.value = `${state.contrast}%`;
  drawPreview();
});
controls.saturation.addEventListener('input', () => {
  state.saturation = Number(controls.saturation.value);
  controls.saturationValue.value = `${state.saturation}%`;
  drawPreview();
});
descriptionInput.addEventListener('input', () => {
  descriptionCount.textContent = `${descriptionInput.value.length}/${DESCRIPTION_LIMIT}`;
});

canvas.addEventListener('pointerdown', (event) => {
  if (!state.image || state.busy) return;
  canvas.setPointerCapture(event.pointerId);
  state.pointer = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: state.panX,
    panY: state.panY
  };
});
canvas.addEventListener('pointermove', (event) => {
  if (!state.pointer || state.pointer.id !== event.pointerId) return;
  const bounds = canvas.getBoundingClientRect();
  state.panX = state.pointer.panX + (event.clientX - state.pointer.x) * canvas.width / bounds.width;
  state.panY = state.pointer.panY + (event.clientY - state.pointer.y) * canvas.height / bounds.height;
  drawPreview();
});
canvas.addEventListener('pointerup', () => { state.pointer = null; });
canvas.addEventListener('pointercancel', () => { state.pointer = null; });

chooseButton.disabled = !auth.currentUser;
resetButton.addEventListener('click', resetEditor);
shareButton.addEventListener('click', shareImage);
closeButton.addEventListener('click', closeDialog);
cancelButton.addEventListener('click', closeDialog);
dialog.addEventListener('cancel', (event) => {
  if (state.busy) event.preventDefault();
});
dialog.addEventListener('close', () => {
  if (!state.busy) {
    clearSelectedImage();
    setError('');
  }
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) closeDialog();
});
document.addEventListener('userLoaded', (event) => {
  if (event.detail?.user) {
    chooseButton.disabled = state.busy;
    if (dialog.open && errorMessage.textContent === 'Please sign in before choosing or sharing an image.') setError('');
    if (new URLSearchParams(window.location.search).get('openUpload') === '1') dialog.showModal();
  }
});

syncControlValues();