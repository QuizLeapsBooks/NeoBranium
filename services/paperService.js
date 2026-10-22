/**
 * services/paperService.js
 *
 * Paper lifecycle management, structured record storage, and ownership enforcement.
 * Integrates with Firestore when initialized, with an active in-memory cache/fallback.
 */

import crypto from 'crypto';
import { db } from '../firebaseAdmin.js';

// In-memory paper registry (keyed by paperId)
const memoryPaperStore = new Map();
const memoryModelAnswerStore = new Map();
const memoryEvaluationStore = new Map();

// Active generation/evaluation job locks to prevent duplicate submissions
const activeUserJobs = new Set();

/**
 * Creates an acquisition lock for expensive AI operations (generation/evaluation).
 * Returns release function, or throws 429 if already in flight.
 */
export function acquireUserJobLock(uid, jobType = 'job') {
  const lockKey = `${uid}:${jobType}`;
  if (activeUserJobs.has(lockKey)) {
    const error = new Error('Another request is already in progress. Please wait for it to complete.');
    error.status = 429;
    error.code = 'CONCURRENT_REQUEST_LIMIT';
    throw error;
  }
  activeUserJobs.add(lockKey);
  return () => {
    activeUserJobs.delete(lockKey);
  };
}

/**
 * Generates a cryptographically secure paper ID.
 */
export function generatePaperId() {
  return 'nb_p_' + crypto.randomBytes(12).toString('hex');
}

/**
 * Saves a structured paper record.
 * @param {Object} paper
 */
export async function savePaperRecord(paper) {
  if (!paper || !paper.paperId || !paper.ownerUid) {
    throw new Error('Invalid paper record: paperId and ownerUid are required.');
  }

  const record = {
    ...paper,
    clientSessionId: paper.clientSessionId || null,
    ipHash: paper.ipHash || null,
    savedAt: new Date().toISOString()
  };

  memoryPaperStore.set(paper.paperId, record);

  // Clean memory store if it grows too large (keep last 500)
  if (memoryPaperStore.size > 500) {
    const oldestKey = memoryPaperStore.keys().next().value;
    memoryPaperStore.delete(oldestKey);
  }

  // Persist to Firestore if available
  if (db) {
    try {
      await db.collection('exam_papers').doc(paper.paperId).set({
        ...record,
        serverTimestamp: new Date()
      });
    } catch (err) {
      console.warn('[PaperService] Firestore save error (falling back to memory):', err.message);
    }
  }

  return record;
}

/**
 * Retrieves a paper record while strictly enforcing owner authorization.
 * @param {string} paperId
 * @param {string} requesterUid
 * @param {string|null} [clientSessionId]
 * @param {string|null} [ipHash]
 */
export async function getPaperRecord(paperId, requesterUid, clientSessionId = null, ipHash = null) {
  if (!paperId) throw new Error('paperId is required.');

  let record = memoryPaperStore.get(paperId);

  if (!record && db) {
    try {
      const snap = await db.collection('exam_papers').doc(paperId).get();
      if (snap.exists) {
        record = snap.data();
        memoryPaperStore.set(paperId, record);
      }
    } catch (err) {
      console.warn('[PaperService] Firestore fetch error:', err.message);
    }
  }

  if (!record) {
    const notFoundErr = new Error('Question paper not found. It may have expired or been generated in a different session.');
    notFoundErr.status = 404;
    notFoundErr.code = 'PAPER_NOT_FOUND';
    throw notFoundErr;
  }

  // Multi-tier ownership check:
  // 1. Exact UID match (Firebase UID or matching guest identifier)
  const isDirectOwner = record.ownerUid === requesterUid;
  // 2. Client session header match (same browser client across cross-origin ports / tabs)
  // Guest requesterUid is derived from a verified signed token by paperAuth.
  // Client session headers and IP equality alone are not ownership proof.
  const isMatchingSession = Boolean(clientSessionId && record.clientSessionId && record.clientSessionId === clientSessionId && record.ownerUid === requesterUid);
  const isMatchingGuestIp = false;

  if (!isDirectOwner && !isMatchingSession && !isMatchingGuestIp) {
    const authErr = new Error('Access denied: You do not have permission to view or evaluate this paper.');
    authErr.status = 403;
    authErr.code = 'FORBIDDEN';
    throw authErr;
  }

  // Gracefully upgrade paper ownership to authenticated user if created as a guest on same session/device
  return record;
}

/**
 * Stores model answers for a paper after explicit user generation.
 */
export async function saveModelAnswersRecord(paperId, ownerUid, modelAnswers) {
  const record = {
    paperId,
    ownerUid,
    modelAnswers,
    generatedAt: new Date().toISOString()
  };

  memoryModelAnswerStore.set(paperId, record);

  if (db) {
    try {
      await db.collection('paper_model_answers').doc(paperId).set(record);
    } catch (err) {
      console.warn('[PaperService] Firestore model answers save error:', err.message);
    }
  }

  return record;
}

/**
 * Retrieves cached model answers if previously generated.
 */
export async function getModelAnswersRecord(paperId, requesterUid, clientSessionId = null, ipHash = null) {
  // Paper must be owned by requester
  await getPaperRecord(paperId, requesterUid, clientSessionId, ipHash);

  let record = memoryModelAnswerStore.get(paperId);
  if (!record && db) {
    try {
      const snap = await db.collection('paper_model_answers').doc(paperId).get();
      if (snap.exists) {
        record = snap.data();
        memoryModelAnswerStore.set(paperId, record);
      }
    } catch (err) {
      console.warn('[PaperService] Firestore model answers fetch error:', err.message);
    }
  }

  return record;
}

/**
 * Saves evaluation results for a paper.
 */
export async function saveEvaluationRecord(paperId, ownerUid, evaluationData) {
  const record = {
    paperId,
    ownerUid,
    ...evaluationData,
    evaluatedAt: new Date().toISOString()
  };

  memoryEvaluationStore.set(paperId, record);

  if (db) {
    try {
      await db.collection('paper_evaluations').doc(paperId).set(record);
    } catch (err) {
      console.warn('[PaperService] Firestore evaluation save error:', err.message);
    }
  }

  return record;
}

/**
 * Retrieves evaluation results with ownership verification.
 */
export async function getEvaluationRecord(paperId, requesterUid, clientSessionId = null, ipHash = null) {
  await getPaperRecord(paperId, requesterUid, clientSessionId, ipHash);

  let record = memoryEvaluationStore.get(paperId);
  if (!record && db) {
    try {
      const snap = await db.collection('paper_evaluations').doc(paperId).get();
      if (snap.exists) {
        record = snap.data();
        memoryEvaluationStore.set(paperId, record);
      }
    } catch (err) {
      console.warn('[PaperService] Firestore evaluation fetch error:', err.message);
    }
  }

  return record;
}
