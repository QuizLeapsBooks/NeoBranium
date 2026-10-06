/**
 * neolearn-impression-service.js
 *
 * Client-side service for recording NeoLearn feed impressions.
 *
 * Record a single impression atomically when a rendered feed card is surfaced.
 * The surface ID makes retries for that one card idempotent without suppressing
 * later appearances in this or another browser session.
 *
 * IMPORTANT:
 *   - The viewer's UID is ALWAYS taken from the Firebase Auth token verified
 *     server-side.  The client never sends its own UID in the request body.
 *   - Impression recording failures are non-fatal.  The feed continues to
 *     show eligible posts using local state.
 */

import { auth } from './auth.js';
import { getBackendBaseUrl } from './profile-photo-cache.js';

// ─── Backend helpers ──────────────────────────────────────────────────────────

async function getAuthToken() {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated.');
  return user.getIdToken();
}

async function impressionRequest(path, { method = 'GET', body } = {}) {
  const token = await getAuthToken();
  let response;
  try {
    response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch {
    throw new Error('Impression service is unreachable.');
  }

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Impression service returned an invalid response (HTTP ${response.status}).`);
  }
  if (!response.ok || !result.success) {
    throw new Error(result.error || 'Impression operation failed.');
  }
  return result;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Record one impression for a specific rendered-card surface event.
 *
 * @param {string} postId       ID of the post that was actually surfaced.
 * @param {string} surfaceId    Unique ID assigned to the rendered feed card.
 * @returns {Promise<void>}
 */
export async function recordRemoteImpression(postId, surfaceId) {
  if (!postId || !surfaceId) return;

  try {
    await impressionRequest('/api/neolearn/impressions', {
      method: 'POST',
      body: { postId, surfaceId }
    });
  } catch (error) {
    // Retry once with the same idempotency key; local filtering remains available.
    console.warn('[NeoLearn] Remote impression record failed:', error?.message);
    setTimeout(() => {
      impressionRequest('/api/neolearn/impressions', {
        method: 'POST',
        body: { postId, surfaceId }
      }).catch((retryError) => {
        console.warn('[NeoLearn] Impression retry failed:', retryError?.message);
      });
    }, 5000);
  }
}
