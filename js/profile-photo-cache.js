import { retainBoundedObjectUrl } from '../utils/boundedObjectUrlCache.js';
import { readBlobWithLimit } from '../utils/readBlobWithLimit.js';

/**
 * Profile Photo Cache & Storage Manager
 * Uses IndexedDB to store image blobs locally for instant rendering on repeat visits.
 * Keeps server (Cloudinary/Firestore) as the single source of truth.
 */

const DB_NAME = 'neobranium_profile_cache';
const DB_VERSION = 1;
const STORE_NAME = 'photos';
const MAX_ACTIVE_PROFILE_OBJECT_URLS = 50;
const MAX_CACHED_PROFILE_PHOTOS = 50;
const MAX_PROFILE_PHOTO_CACHE_BYTES = 1024 * 1024;

// In-memory cache of created object URLs to revoke them when no longer needed
const activeObjectUrls = new Map();
let photoDbPromise = null;

function retainObjectUrl(userId, objectUrl) {
  retainBoundedObjectUrl(activeObjectUrls, userId, objectUrl, MAX_ACTIVE_PROFILE_OBJECT_URLS, URL.revokeObjectURL.bind(URL));
}

/**
 * Opens or initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>}
 */
function openPhotoDb() {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.reject(new Error('IndexedDB is not supported in this environment'));
  }
  if (photoDbPromise) return photoDbPromise;

  photoDbPromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        photoDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      photoDbPromise = null;
      reject(request.error);
    };
  });
  return photoDbPromise;
}
/**
 * Retrieves a cached profile photo blob and returns an object URL.
 * @param {string} userId
 * @returns {Promise<{ url: string, blob: Blob, objectUrl: string } | null>}
 */
export async function getCachedProfilePhoto(userId) {
  if (!userId) return null;
  try {
    const db = await openPhotoDb();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);

      req.onsuccess = () => {
        const record = req.result;
        if (!record || !record.blob) {
          return resolve(null);
        }
        const objectUrl = URL.createObjectURL(record.blob);
        retainObjectUrl(userId, objectUrl);

        resolve({
          url: record.url,
          blob: record.blob,
          objectUrl
        });
      };

      req.onerror = () => resolve(null);
    });
  } catch (err) {
    console.warn('Could not read from IndexedDB profile photo cache:', err);
    return null;
  }
}

/**
 * Saves an image blob to IndexedDB cache.
 * @param {string} userId
 * @param {string} url - Original server HTTPS URL
 * @param {Blob} blob - Binary image data
 */
export async function saveProfilePhotoToCache(userId, url, blob) {
  if (!userId || !blob) return;
  try {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const record = {
        userId,
        url,
        blob,
        cachedAt: Date.now()
      };
      const req = store.put(record);
      req.onsuccess = () => {
        const countRequest = store.count();
        countRequest.onsuccess = () => {
          let excess = countRequest.result - MAX_CACHED_PROFILE_PHOTOS;
          if (excess <= 0) return;
          const cursorRequest = store.openCursor();
          cursorRequest.onsuccess = () => {
            const cursor = cursorRequest.result;
            if (!cursor || excess <= 0) return;
            if (cursor.key !== userId) {
              cursor.delete();
              excess -= 1;
            }
            cursor.continue();
          };
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not save to IndexedDB profile photo cache:', err);
  }
}

/**
 * Clears the cached profile photo for a user from IndexedDB.
 * @param {string} userId
 */
export async function clearCachedProfilePhoto(userId) {
  if (!userId) return;
  if (activeObjectUrls.has(userId)) {
    try { URL.revokeObjectURL(activeObjectUrls.get(userId)); } catch (e) {}
    activeObjectUrls.delete(userId);
  }
  try {
    const db = await openPhotoDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(userId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('Could not clear IndexedDB profile photo cache:', err);
  }
}

/**
 * Fetches an image from a remote URL, caches its blob locally, and returns an object URL.
 * @param {string} userId
 * @param {string} url
 * @returns {Promise<string>}
 */
export async function fetchAndCacheProfilePhoto(userId, url) {
  if (!userId || !url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP status ${res.status}`);
    const blob = await readBlobWithLimit(res, MAX_PROFILE_PHOTO_CACHE_BYTES);
    await saveProfilePhotoToCache(userId, url, blob);

    const objectUrl = URL.createObjectURL(blob);
    retainObjectUrl(userId, objectUrl);
    return objectUrl;
  } catch (err) {
    console.warn('Could not fetch and cache remote profile photo:', err);
    return url; // Graceful fallback to remote URL directly
  }
}

/**
 * Synchronizes local profile photo cache with server data:
 * 1. Immediately renders locally cached image if available
 * 2. Checks remote server URL (Cloudinary/Firestore)
 * 3. Updates cache & display if changed, or clears cache if photo removed
 * @param {string} userId
 * @param {string|null} remoteUrl
 * @param {(displayUrl: string|null, meta: object) => void} onUpdate
 */
export async function syncProfilePhoto(userId, remoteUrl, onUpdate) {
  if (!userId || typeof onUpdate !== 'function') return;

  // 1. Immediately check local cache for instant UI rendering
  let cached = null;
  try {
    cached = await getCachedProfilePhoto(userId);
    if (cached && cached.objectUrl) {
      onUpdate(cached.objectUrl, { isCached: true, url: cached.url });
    }
  } catch (e) {
    console.warn('Error reading initial profile photo cache:', e);
  }

  // 2. Evaluate server version
  if (!remoteUrl) {
    if (cached) {
      await clearCachedProfilePhoto(userId);
    }
    onUpdate(null, { isRemoved: true });
    return;
  }

  // If remoteUrl matches cached URL, cache is fresh and already displayed
  if (cached && cached.url === remoteUrl) {
    return;
  }

  // Server URL is new or has changed: fetch, cache, and update visible display
  try {
    const freshObjectUrl = await fetchAndCacheProfilePhoto(userId, remoteUrl);
    if (freshObjectUrl) {
      onUpdate(freshObjectUrl, { isUpdated: true, url: remoteUrl });
    }
  } catch (err) {
    console.warn('Could not refresh profile photo from remote URL:', err);
    onUpdate(remoteUrl, { isFallback: true });
  }
}

/**
 * Helper to determine backend base URL.
 * @returns {string}
 */
export function getBackendBaseUrl() {
  const metaBackend = document.querySelector('meta[name="backend-url"]');
  if (metaBackend && metaBackend.getAttribute('content')) {
    return metaBackend.getAttribute('content');
  }
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal && window.location.port === '3001') return window.location.origin;
  return isLocal ? 'http://localhost:3000' : 'https://neobranium.onrender.com';
}

/**
 * Uploads a profile photo to Cloudinary via the authenticated backend endpoint.
 * @param {import("https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js").User} user
 * @param {File|Blob|string} imageFileOrDataUri
 * @param {string} [mimeType]
 * @returns {Promise<string>} secure Cloudinary URL
 */
export async function uploadProfilePhotoToServer(user, imageFileOrDataUri, mimeType) {
  if (!user) throw new Error('Authentication required');
  const token = await user.getIdToken();

  let base64Payload = imageFileOrDataUri;
  let type = mimeType || 'image/jpeg';

  if (typeof window !== 'undefined' && (imageFileOrDataUri instanceof File || imageFileOrDataUri instanceof Blob)) {
    type = imageFileOrDataUri.type || type;
    base64Payload = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(imageFileOrDataUri);
    });
  }

  const apiBase = getBackendBaseUrl();
  let response;
  try {
    response = await fetch(`${apiBase}/api/profile/upload-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        image: base64Payload,
        mimeType: type
      })
    });
  } catch (error) {
    throw new Error(`Profile photo backend is unreachable at ${apiBase}. Check that the backend is running and CORS allows this site.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Profile photo backend returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to upload profile photo');
  }

  // Update local cache with newly uploaded image
  if (imageFileOrDataUri instanceof Blob) {
    await saveProfilePhotoToCache(user.uid, data.profilePhotoUrl, imageFileOrDataUri);
  } else {
    await fetchAndCacheProfilePhoto(user.uid, data.profilePhotoUrl);
  }

  return data.profilePhotoUrl;
}

/**
 * Removes the profile photo reference on the server and destroys Cloudinary asset.
 * @param {import("https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js").User} user
 * @returns {Promise<boolean>}
 */
export async function removeProfilePhotoFromServer(user) {
  if (!user) throw new Error('Authentication required');
  const token = await user.getIdToken();

  const apiBase = getBackendBaseUrl();
  let response;
  try {
    response = await fetch(`${apiBase}/api/profile/remove-photo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    throw new Error(`Profile photo backend is unreachable at ${apiBase}. Check that the backend is running and CORS allows this site.`);
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new Error(`Profile photo backend returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to remove profile photo');
  }

  // Clear local cache
  await clearCachedProfilePhoto(user.uid);
  return true;
}

/**
 * Checks whether a Thought of the Day is currently active and within its 24-hour expiration window.
 * @param {string|null} thought
 * @param {any} expiresAt - Timestamp, Date, string, or number
 * @returns {boolean}
 */
export function isThoughtActive(thought, expiresAt) {
  if (!thought || typeof thought !== 'string' || !thought.trim()) {
    return false;
  }
  if (!expiresAt) {
    return false;
  }
  let expireTime = 0;
  if (typeof expiresAt.toMillis === 'function') {
    expireTime = expiresAt.toMillis();
  } else if (typeof expiresAt.toDate === 'function') {
    expireTime = expiresAt.toDate().getTime();
  } else if (expiresAt instanceof Date) {
    expireTime = expiresAt.getTime();
  } else if (typeof expiresAt === 'number') {
    expireTime = expiresAt;
  } else if (typeof expiresAt === 'string') {
    expireTime = new Date(expiresAt).getTime();
  } else if (expiresAt.seconds) {
    expireTime = expiresAt.seconds * 1000;
  }
  return Date.now() < expireTime;
}
