const activeUsers = new Map();
const waitingQueue = [];
const MAX_CONCURRENT = 5;

const queueManager = {
  /**
   * Tries to join the active session or adds to the waiting queue.
   * @param {string} userId 
   * @returns {{status: string, position: number}}
   */
  tryJoin(userId) {
    const now = new Date();
    
    if (activeUsers.has(userId)) {
      return { status: 'active', position: 0 };
    }
    
    // Remove userId from waitingQueue if present (re-joining)
    const waitIndex = waitingQueue.findIndex(u => u.userId === userId);
    if (waitIndex !== -1) {
      waitingQueue.splice(waitIndex, 1);
    }
    
    if (activeUsers.size < MAX_CONCURRENT) {
      activeUsers.set(userId, { joinedAt: now, lastHeartbeat: now });
      return { status: 'active', position: 0 };
    } else {
      waitingQueue.push({ userId, joinedAt: now });
      const position = waitingQueue.length; // 1-based index
      return { status: 'waiting', position };
    }
  },

  /**
   * Removes user from queue or active list and promotes next user.
   * @param {string} userId 
   * @returns {string|null} Promoted userId or null
   */
  leave(userId) {
    let removedFromActive = false;
    
    if (activeUsers.has(userId)) {
      activeUsers.delete(userId);
      removedFromActive = true;
    }
    
    const waitIndex = waitingQueue.findIndex(u => u.userId === userId);
    if (waitIndex !== -1) {
      waitingQueue.splice(waitIndex, 1);
    }
    
    if (removedFromActive && waitingQueue.length > 0) {
      const nextUser = waitingQueue.shift();
      const now = new Date();
      // Promote to active
      activeUsers.set(nextUser.userId, { joinedAt: now, lastHeartbeat: now });
      return nextUser.userId;
    }
    
    return null;
  },

  /**
   * Updates heartbeat for active or waiting users.
   * @param {string} userId 
   */
  heartbeat(userId) {
    const now = new Date();
    if (activeUsers.has(userId)) {
      const userData = activeUsers.get(userId);
      userData.lastHeartbeat = now;
    } else {
      const waitIndex = waitingQueue.findIndex(u => u.userId === userId);
      if (waitIndex !== -1) {
        waitingQueue[waitIndex].joinedAt = now;
      }
    }
  },

  /**
   * Gets the position of a user.
   * @param {string} userId 
   * @returns {{status: string, position: number}}
   */
  getPosition(userId) {
    if (activeUsers.has(userId)) {
      return { status: 'active', position: 0 };
    }
    
    const waitIndex = waitingQueue.findIndex(u => u.userId === userId);
    if (waitIndex !== -1) {
      return { status: 'waiting', position: waitIndex + 1 };
    }
    
    return { status: 'not_found' };
  },

  /**
   * Gets current queue stats.
   * @returns {{activeCount: number, waitingCount: number, maxActive: number}}
   */
  getStats() {
    return {
      activeCount: activeUsers.size,
      waitingCount: waitingQueue.length,
      maxActive: MAX_CONCURRENT
    };
  }
};

// CLEANUP INTERVAL
setInterval(() => {
  const now = new Date();
  const threeMinutes = 3 * 60 * 1000;
  
  const usersToRemove = [];
  for (const [userId, data] of activeUsers.entries()) {
    if (now - data.lastHeartbeat > threeMinutes) {
      usersToRemove.push(userId);
    }
  }
  
  usersToRemove.forEach(userId => {
    queueManager.leave(userId);
    console.log(`[Queue] Auto-removed inactive user: ${userId}`);
  });
}, 60000);

export default queueManager;
