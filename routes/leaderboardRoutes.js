/**
 * leaderboardRoutes.js
 * API routes for NeoBranium Public Leaderboard & Public Student Profiles.
 */

import express from 'express';
import { requireAuth } from '../middleware/requireAuth.js';
import {
  getLeaderboardData,
  getPublicProfile,
  syncStudentPublicProfile
} from '../services/leaderboardService.js';
import { submitVerifiedQuiz } from '../services/quizVerificationService.js';

export function createLeaderboardRouter({ db }) {
  const router = express.Router();

  /**
   * GET /api/leaderboard
   * Public: Query overall and class-filtered rankings.
   */
  router.get('/leaderboard', async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Leaderboard database is temporarily unavailable.'
        });
      }

      const classFilter = String(req.query.class || 'all').toLowerCase();
      const sort = String(req.query.sort || 'rank').toLowerCase();
      const search = String(req.query.search || '').slice(0, 50);
      const page = parseInt(req.query.page, 10) || 1;
      const limit = parseInt(req.query.limit, 10) || 20;

      const data = await getLeaderboardData(db, {
        classFilter,
        sort,
        search,
        page,
        limit
      });

      return res.json(data);
    } catch (err) {
      console.error('[Leaderboard] Failed to fetch leaderboard:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Unable to load leaderboard data right now.'
      });
    }
  });

  /**
   * GET /api/leaderboard/profile/:userId
   * Public: Retrieve public student performance profile.
   */
  router.get('/leaderboard/profile/:userId', async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({
          success: false,
          error: 'Leaderboard database is temporarily unavailable.'
        });
      }

      const targetUserId = req.params.userId;
      if (!targetUserId || typeof targetUserId !== 'string' || targetUserId.length > 128 || targetUserId.includes('/')) {
        return res.status(400).json({
          success: false,
          error: 'Invalid student identifier.'
        });
      }

      const profile = await getPublicProfile(db, targetUserId);
      if (!profile) {
        return res.status(404).json({
          success: false,
          error: 'Student profile is private or does not exist.'
        });
      }

      return res.json({
        success: true,
        profile
      });
    } catch (err) {
      console.error('[Leaderboard] Failed to fetch public profile:', err.message);
      return res.status(500).json({
        success: false,
        error: 'Unable to load student profile right now.'
      });
    }
  });

  /**
   * GET /api/leaderboard/status
   * Authenticated: Fetch user's current leaderboard visibility and profile.
   */
  router.get('/leaderboard/status', requireAuth, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ success: false, error: 'Database unavailable' });
      }

      const userSnap = await db.collection('users').doc(req.uid).get();
      const userData = userSnap.exists ? userSnap.data() : {};

      const isPublic = (userData.showOnLeaderboard !== false && userData.leaderboardPrivacy !== 'private');
      let publicProfileData = null;

      if (isPublic) {
        const pubSnap = await db.collection('public_profiles').doc(req.uid).get();
        if (pubSnap.exists) {
          publicProfileData = pubSnap.data();
        }
      }

      return res.json({
        success: true,
        isPublic,
        targetClass: userData.targetClass || '10',
        publicDisplayName: userData.publicDisplayName || userData.username || '',
        publicProfile: publicProfileData
      });
    } catch (err) {
      console.error('[Leaderboard] Failed to load status:', err.message);
      return res.status(500).json({ success: false, error: 'Could not fetch status' });
    }
  });

  /**
   * POST /api/leaderboard/privacy
   * Authenticated: Set public / private visibility and update profile projection.
   */
  router.post('/leaderboard/privacy', requireAuth, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ success: false, error: 'Database unavailable' });
      }

      const { privacy, targetClass, publicDisplayName } = req.body || {};
      const isPublic = privacy === 'public';
      const validClass = targetClass === '9' ? '9' : '10';
      const sanitizedName = typeof publicDisplayName === 'string'
        ? publicDisplayName.trim().slice(0, 50)
        : null;

      // Update users collection
      const updatePayload = {
        showOnLeaderboard: isPublic,
        leaderboardPrivacy: isPublic ? 'public' : 'private',
        targetClass: validClass
      };
      if (sanitizedName) {
        updatePayload.publicDisplayName = sanitizedName;
      }

      await db.collection('users').doc(req.uid).set(updatePayload, { merge: true });

      // Synchronize public profile
      const syncResult = await syncStudentPublicProfile(db, req.uid);

      return res.json({
        success: true,
        isPublic,
        syncResult
      });
    } catch (err) {
      console.error('[Leaderboard] Privacy update failed:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to update leaderboard privacy' });
    }
  });

  /**
   * POST /api/leaderboard/sync
   * Authenticated: Recalculate verified points and update public profile.
   */
  router.post('/leaderboard/sync', requireAuth, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ success: false, error: 'Database unavailable' });
      }

      const result = await syncStudentPublicProfile(db, req.uid);
      return res.json(result);
    } catch (err) {
      console.error('[Leaderboard] Profile sync failed:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to sync leaderboard profile' });
    }
  });

  /**
   * POST /api/leaderboard/submit-quiz
   * Authenticated: Authoritative server-side quiz submission & scoring.
   * Calculates score against canonical chapter keys, prevents duplicate replays,
   * stores verified completion to mentor_calendar using Admin SDK, and syncs leaderboard.
   */
  router.post('/leaderboard/submit-quiz', requireAuth, async (req, res) => {
    try {
      if (!db) {
        return res.status(503).json({ success: false, error: 'Database unavailable' });
      }

      // Anonymous guests cannot submit to public leaderboard
      if (req.isGuest) {
        return res.status(403).json({
          success: false,
          code: 'GUEST_SUBMISSION_BLOCKED',
          error: 'Guest accounts cannot submit to the public leaderboard. Please sign in to save verified progress.'
        });
      }

      const { quizId, level, answers, timeTakenSeconds, title } = req.body || {};
      if (!quizId || typeof quizId !== 'string') {
        return res.status(400).json({
          success: false,
          code: 'INVALID_QUIZ_ID',
          error: 'Valid quiz identifier is required.'
        });
      }

      const outcome = await submitVerifiedQuiz(db, req.uid, {
        quizId,
        level: level || 'level1',
        answers: answers || {},
        timeTakenSeconds: typeof timeTakenSeconds === 'number' ? timeTakenSeconds : 0,
        title
      });

      if (!outcome.success) {
        const statusCode = outcome.code === 'RATE_LIMITED' ? 429 : 400;
        return res.status(statusCode).json(outcome);
      }

      return res.json(outcome);
    } catch (err) {
      console.error('[Leaderboard] Quiz submission error:', err.message);
      return res.status(500).json({ success: false, error: 'Failed to record verified quiz submission.' });
    }
  });

  return router;
}
