import { checkAndTrackUsage } from './firebaseAdmin.js';
import queueManager from './queueManager.js';

/**
 * Express middleware for AI Board rate limiting and queue management.
 */
export const boardRateLimit = async (req, res, next) => {
  // 1. Get userId
  const userId = req.session?.id;
  if (!userId) return res.status(403).json({ error: 'No session' });

  // 2. QUEUE CHECK
  const queueResult = queueManager.tryJoin(userId);
  
  if (queueResult.status === 'waiting') {
    return res.status(202).json({
      status: 'queued',
      position: queueResult.position,
      message: `Aapki baari aa rahi hai! ${queueResult.position} log aage hain. Thoda wait karo 🙏`,
      retryAfter: 20
    });
  }

  // Wrap steps 3-6 in try/catch
  try {
    // 3. FIREBASE RATE LIMIT CHECK
    const usage = await checkAndTrackUsage(userId);
    
    if (!usage.allowed) {
      queueManager.leave(userId);
      
      const resetAt = usage.resetAt ? new Date(usage.resetAt) : null;
      const now = new Date();
      const minsLeft = resetAt ? Math.ceil((resetAt - now) / 60000) : 360;
      
      return res.status(429).json({
        status: 'limit_reached',
        message: `Aapka 20 minute ka AI Board quota khatam ho gaya! ${minsLeft} minute mein reset hoga. ⏰`,
        resetAt: usage.resetAt,
        minutesUsed: usage.minutesUsed
      });
    }

    // 4. Attach to request object
    req.boardUserId = userId;
    req.boardUsage = usage;

    // 5. On response finish → heartbeat
    res.on('finish', () => {
      queueManager.heartbeat(userId);
    });

    // 6. Call next()
    next();
  } catch (error) {
    console.error('Error in boardRateLimit middleware:', error);
    
    // Fail closed — protect quota on error
    return res.status(503).json({
      status: 'error',
      message: 'Server error during usage check. Please try again.',
    });
  }
};
