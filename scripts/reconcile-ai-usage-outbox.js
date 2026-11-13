import 'dotenv/config';
import { db } from '../firebaseAdmin.js';
import { createAiUsagePersistence } from '../services/aiUsagePersistence.js';

if (!db) {
  console.error('[AI Usage] Firebase Admin is not initialized; recovery did not run.');
  process.exitCode = 1;
} else {
  try {
    const result = await createAiUsagePersistence().reconcilePending();
    console.info('[AI Usage] Outbox recovery completed.', result);
  } catch (error) {
    console.error('[AI Usage] Outbox recovery failed.', {
      code: error?.code || 'unknown'
    });
    process.exitCode = 1;
  }
}
