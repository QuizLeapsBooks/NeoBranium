import express from 'express';
import { admin, db } from '../firebaseAdmin.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { combineAiUsageDailySummaries } from '../services/aiUsagePersistence.js';

const MAX_RANGE_DAYS = 90;

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

export function parseAiUsageDateRange(query, now = new Date()) {
  const hasFrom = query.from !== undefined;
  const hasTo = query.to !== undefined;
  if (hasFrom !== hasTo) return null;

  const fromValue = hasFrom ? query.from : now.toISOString().slice(0, 10);
  const toValue = hasTo ? query.to : fromValue;
  const fromDate = parseDate(fromValue);
  const toDate = parseDate(toValue);
  if (!fromDate || !toDate || fromDate > toDate) return null;
  const dayCount = Math.floor((toDate - fromDate) / 86400000) + 1;
  if (dayCount > MAX_RANGE_DAYS) return null;
  return { from: fromValue, to: toValue, dayCount };
}

export function createAiUsageRouter({
  getDb = () => db,
  authenticate = requireAuth,
  documentIdField = () => admin.firestore.FieldPath.documentId(),
  now = () => new Date(),
  logger = console
} = {}) {
  const router = express.Router();

  async function loadDaily(req) {
    const range = parseAiUsageDateRange(req.query, now());
    if (!range) return { status: 400, error: 'Invalid date range. Use valid UTC dates with a maximum span of 90 days.' };

    if (typeof req.uid !== 'string' || req.uid.length === 0) {
      return { status: 401, error: 'Authentication required.' };
    }
    const firestore = getDb();
    if (!firestore) {
      return { status: 503, error: 'Usage history is temporarily unavailable.' };
    }

    try {
      const dailyCollection = firestore.collection('users').doc(req.uid).collection('ai_usage_daily');
      const documentId = documentIdField();
      const snapshot = await dailyCollection
        .where(documentId, '>=', range.from)
        .where(documentId, '<=', range.to)
        .orderBy(documentId)
        .limit(MAX_RANGE_DAYS)
        .get();
      const daily = snapshot.docs.map(document => document.data());
      return { range, daily };
    } catch (error) {
      logger.error('[AI Usage API] Could not load daily usage.', {
        code: error?.code || 'unknown'
      });
      return { status: 500, error: 'Could not load usage history.' };
    }
  }

  router.get('/summary', authenticate, async (req, res) => {
    const result = await loadDaily(req);
    if (result.error) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    const combined = combineAiUsageDailySummaries(result.daily);
    return res.json({
      success: true,
      timezone: 'UTC',
      ...combined,
      from: result.range.from,
      to: result.range.to
    });
  });

  router.get('/daily', authenticate, async (req, res) => {
    const result = await loadDaily(req);
    if (result.error) {
      return res.status(result.status).json({ success: false, error: result.error });
    }
    return res.json({
      success: true,
      timezone: 'UTC',
      from: result.range.from,
      to: result.range.to,
      daily: result.daily
    });
  });
  return router;
}
