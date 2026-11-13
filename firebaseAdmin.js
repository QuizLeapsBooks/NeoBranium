import admin from 'firebase-admin';

// Initialize Firebase Admin SDK
const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;
const privateKey = rawPrivateKey 
  ? rawPrivateKey.replace(/\\n/g, '\n') 
  : undefined;

const isPlaceholderKey = privateKey && privateKey.includes('XXX');

if (!admin.apps.length) {
  if (isPlaceholderKey) {
    console.warn('⚠️ Firebase Private Key is a placeholder (contains XXX). Skipping Firebase initialization. Usage tracking will be disabled.');
  } else if (privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: privateKey,
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://neobranium-default-rtdb.firebaseio.com'
      });
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase Admin initialization error:', error.message);
    }
  } else {
    console.warn('⚠️ Firebase Private Key is missing. Skipping Firebase initialization.');
  }
}

let db = null;
if (admin.apps.length) {
  try {
    const fsInstance = admin.firestore();
    fsInstance.settings({ ignoreUndefinedProperties: true });
    db = fsInstance;
  } catch (err) {
    db = admin.firestore();
  }
}
let rtdb = admin.apps.length ? admin.database() : null;

/**
 * Allows tests to supply a mock/in-memory Firestore instance.
 */
export function setDb(customDb) {
  db = customDb;
}

/**
 * Checks and tracks daily AI quota by verified Firebase UID.
 * Cross-device safe, bypass-proof via Firestore transactions.
 * @param {string} uid - Verified Firebase UID
 * @param {string} category - AI category (e.g. 'chat', 'solver', 'tts', 'live_session')
 * @param {number} dailyLimit - Daily quota limit
 * @returns {Promise<{allowed: boolean, count: number, limit: number, remaining: number, resetAt: string}>}
 */
export async function checkAndTrackUsageByUID(uid, category = 'chat', dailyLimit = 50) {
  const today = new Date().toISOString().slice(0, 10);
  const resetAt = `${today}T23:59:59Z`;

  if (!db) {
    console.warn(`[Quota] Firebase DB not initialized for checkAndTrackUsageByUID(uid=${uid}). Failing open.`);
    return { allowed: category.startsWith('paper') ? false : true, unavailable: true, count: 0, limit: dailyLimit, remaining: dailyLimit, resetAt };
  }

  const docRef = db.collection('ai_quotas').doc(uid);

  return await db.runTransaction(async (txn) => {
    const snap = await txn.get(docRef);
    const data = snap.exists ? snap.data() : {};

    const categoryData = data[category] || {};
    const storedDate = categoryData.date || '';
    const count = storedDate === today ? (categoryData.count || 0) : 0;

    if (count >= dailyLimit) {
      return { allowed: false, count, limit: dailyLimit, remaining: 0, resetAt };
    }

    const update = {
      [`${category}.date`]: today,
      [`${category}.count`]: count + 1,
      [`${category}.lastUsed`]: admin.firestore.FieldValue.serverTimestamp()
    };
    txn.set(docRef, update, { merge: true });

    return { allowed: true, count: count + 1, limit: dailyLimit, remaining: dailyLimit - (count + 1), resetAt };
  });
}

/**
 * Verifies the Firebase ID token from the request Authorization header.
 * Derives authenticated user identity on the server without trusting client parameters.
 * @param {import('express').Request} req
 * @returns {Promise<admin.auth.DecodedIdToken>}
 */
export async function verifyAuthToken(req) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid Authorization header');
  }
  const token = authHeader.split('Bearer ')[1].trim();
  if (!token) {
    throw new Error('Unauthorized: Token is empty');
  }
  if (!admin.apps.length) {
    throw new Error('Service Unavailable: Firebase Admin is not initialized');
  }
  return await admin.auth().verifyIdToken(token);
}

/**
 * Logs a structured security event.
 * Records to console and, when Firestore is available, to the security_events collection.
 * Writes go through Admin SDK only — no client can write to this collection.
 *
 * @param {string} eventType - e.g. 'auth_failure', 'quota_exhausted', 'rate_limited'
 * @param {object} details   - Sanitized details (never include full tokens or passwords)
 */
export async function logSecurityEvent(eventType, details = {}) {
  const entry = {
    eventType,
    timestamp: new Date().toISOString(),
    ...details
  };

  // Always log to console for Render log drain
  console.warn(`[SECURITY] ${eventType}`, JSON.stringify(entry));

  // Persist to Firestore when available (best-effort — don't throw)
  if (db) {
    try {
      await db.collection('security_events').add({
        ...entry,
        serverTimestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (err) {
      // Don't let logging failure crash the application
      console.error('[SECURITY] Failed to persist security event:', err.message);
    }
  }
}

export { admin, db, rtdb };
