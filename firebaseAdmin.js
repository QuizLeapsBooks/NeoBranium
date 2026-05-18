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
      });
      console.log('✅ Firebase initialized successfully');
    } catch (error) {
      console.error('❌ Firebase Admin initialization error:', error.message);
    }
  } else {
    console.warn('⚠️ Firebase Private Key is missing. Skipping Firebase initialization.');
  }
}

const db = admin.apps.length ? admin.firestore() : null;

/**
 * Checks if the user is allowed to use the AI board and tracks usage.
 * @param {string} userId - The session ID of the user (req.session.id).
 * @returns {Promise<{allowed: boolean, minutesUsed: number, remainingMinutes: number, resetAt: Date|null}>}
 */
export async function checkAndTrackUsage(userId) {
  const fallback = { allowed: true, minutesUsed: 0, remainingMinutes: 20, resetAt: null };
  
  if (!db) {
    console.warn('Firebase DB not initialized. Returning fallback.');
    return fallback;
  }

  try {
    const docRef = db.collection('aiboard_sessions').doc(userId);
    const doc = await docRef.get();
    const now = new Date();
    
    // If not exists → create with defaults
    if (!doc.exists) {
      const defaults = {
        minutesUsed: 0,
        periodStart: now,
        sessionStart: now,
        isActive: true,
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      };
      await docRef.set(defaults);
      
      const resetAt = new Date(now.getTime() + 6 * 60 * 60 * 1000);
      return {
        allowed: true,
        minutesUsed: 0,
        remainingMinutes: 20,
        resetAt
      };
    }

    const data = doc.data();
    let minutesUsed = data.minutesUsed || 0;
    let periodStart = data.periodStart ? data.periodStart.toDate() : now;
    let sessionStart = data.sessionStart ? data.sessionStart.toDate() : null;
    let isActive = data.isActive;

    // 6-HOUR WINDOW CHECK
    const sixHours = 6 * 60 * 60 * 1000;
    let periodReset = false;
    if (now - periodStart > sixHours) {
      minutesUsed = 0;
      periodStart = now;
      periodReset = true;
    }

    // LIMIT CHECK (do this AFTER window check)
    if (minutesUsed >= 20) {
      const resetAt = new Date(periodStart.getTime() + sixHours);
      return {
        allowed: false,
        minutesUsed,
        remainingMinutes: 0,
        resetAt
      };
    }

    // SESSION TRACKING
    let newMinutesUsed = minutesUsed;
    if (sessionStart && isActive === true) {
      const elapsed = (now - sessionStart) / (1000 * 60); // in minutes
      newMinutesUsed = minutesUsed + elapsed;
    }

    // Update Firestore
    const updateData = {
      minutesUsed: newMinutesUsed,
      sessionStart: now,
      isActive: true,
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (periodReset) {
      updateData.periodStart = now;
    }

    await docRef.set(updateData, { merge: true });

    const resetAt = new Date(periodStart.getTime() + sixHours);
    return {
      allowed: true,
      minutesUsed: newMinutesUsed,
      remainingMinutes: Math.max(0, 20 - newMinutesUsed),
      resetAt
    };

  } catch (error) {
    console.error('Firebase error in checkAndTrackUsage:', error);
    return fallback;
  }
}

/**
 * Ends the user's session and updates usage.
 * @param {string} userId - The session ID of the user (req.session.id).
 * @returns {Promise<number>} Updated minutes used.
 */
export async function endSession(userId) {
  if (!db) {
    console.warn('Firebase DB not initialized in endSession.');
    return 0;
  }

  try {
    const docRef = db.collection('aiboard_sessions').doc(userId);
    const doc = await docRef.get();
    
    if (!doc.exists) return 0;
    
    const data = doc.data();
    let minutesUsed = data.minutesUsed || 0;
    const sessionStart = data.sessionStart ? data.sessionStart.toDate() : null;
    const isActive = data.isActive;
    const now = new Date();
    
    if (isActive && sessionStart) {
      const elapsed = (now - sessionStart) / (1000 * 60);
      minutesUsed += elapsed;
      if (minutesUsed > 20) minutesUsed = 20; // clamp to max 20
    }
    
    await docRef.update({
      isActive: false,
      minutesUsed: minutesUsed,
      lastActive: admin.firestore.FieldValue.serverTimestamp(),
      sessionStart: null
    });
    
    return minutesUsed;
  } catch (error) {
    console.error('Error in endSession:', error);
    return 0;
  }
}

/**
 * Gets the raw session status.
 * @param {string} userId - The session ID of the user (req.session.id).
 * @returns {Promise<object|null>} Raw data or null.
 */
export async function getSessionStatus(userId) {
  if (!db) {
    console.warn('Firebase DB not initialized in getSessionStatus.');
    return null;
  }

  try {
    const docRef = db.collection('aiboard_sessions').doc(userId);
    const doc = await docRef.get();
    return doc.exists ? doc.data() : null;
  } catch (error) {
    console.error('Error in getSessionStatus:', error);
    return null;
  }
}
