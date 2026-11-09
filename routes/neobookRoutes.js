/**
 * routes/neobookRoutes.js
 *
 * REST API routes for NeoBook:
 * - GET  /api/neobook/limits
 * - GET  /api/neobook/notebooks
 * - POST /api/neobook/notebooks
 * - GET  /api/neobook/notebooks/:notebookId/sources
 * - POST /api/neobook/notebooks/:notebookId/sources
 * - DELETE /api/neobook/notebooks/:notebookId/sources/:sourceId
 * - GET  /api/neobook/notebooks/:notebookId/chats
 * - POST /api/neobook/notebooks/:notebookId/chats
 * - GET  /api/neobook/notebooks/:notebookId/chats/:chatId
 * - POST /api/neobook/notebooks/:notebookId/chats/:chatId/messages
 * - DELETE /api/neobook/notebooks/:notebookId/chats/:chatId
 */

import express from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { db, admin, verifyAuthToken } from '../firebaseAdmin.js';
import { NEOBOOK_CONFIG } from '../services/neobookConfig.js';
import {
  getClientIdentity,
  getRemainingLimits,
  checkAndConsumeNewChatQuota,
  recordMessageTokenUsage
} from '../services/neobookLimitService.js';
import {
  fetchWebsiteContent,
  extractYouTubeTranscript,
  extractPdfText,
  processRawTextInput,
  chunkSourceContent
} from '../services/neobookSourceService.js';
import {
  retrieveRelevantChunks,
  generateGroundedAnswer
} from '../services/neobookAiService.js';

export const neobookRouter = express.Router();

// ── NeoBook-specific rate limiters ───────────────────────────────────────────
// Source processing (fetch/extract) — heavier operations
const sourceRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many source processing requests. Please wait and try again.' },
  keyGenerator: (req) => req.identity || req.ip,
});

// AI chat messages — most expensive operations
const chatRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests. Please wait and try again.' },
  keyGenerator: (req) => req.identity || req.ip,
});

/**
 * Middleware: Attaches verified user UID if Authorization header is present,
 * or safely falls back to server-observed IP identity.
 */
async function attachIdentity(req, res, next) {
  try {
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await verifyAuthToken(req);
        if (decoded?.uid) {
          req.uid = decoded.uid;
        }
      } catch (authErr) {
        // Log silently and proceed with IP-based identity for guest requests
      }
    }
  } finally {
    req.identity = getClientIdentity(req);
    next();
  }
}

neobookRouter.use(attachIdentity);

// ── GET /api/neobook/limits ──────────────────────────────────────────────────
neobookRouter.get('/limits', async (req, res) => {
  try {
    const limits = await getRemainingLimits(req.identity);
    return res.json({ success: true, ...limits });
  } catch (err) {
    console.error('[NeoBook] Error getting limits:', err);
    return res.status(500).json({ success: false, error: 'Could not load usage limits.' });
  }
});

// ── GET /api/neobook/notebooks ───────────────────────────────────────────────
neobookRouter.get('/notebooks', async (req, res) => {
  try {
    const identityKey = req.identity.identityKey;
    if (!db) {
      return res.json({
        success: true,
        notebooks: [{ id: 'default_nb', title: 'My Study Notebook', sourceCount: 0, updatedAt: new Date().toISOString() }]
      });
    }

    const snap = await db.collection('neobook_notebooks')
      .where('ownerKey', '==', identityKey)
      .where('isDeleted', '==', false)
      .limit(20)
      .get()
      .catch(async () => {
        // Fallback: drop isDeleted filter if composite index not yet deployed
        return await db.collection('neobook_notebooks')
          .where('ownerKey', '==', identityKey)
          .limit(20)
          .get();
      });

    const notebooks = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (!data.isDeleted) {
        notebooks.push({
          id: doc.id,
          title: data.title || 'Untitled Notebook',
          sourceCount: data.sourceCount || 0,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
        });
      }
    });

    // Sort by updatedAt descending in JS (avoids needing a composite index)
    notebooks.sort((a, b) => {
      const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return tb - ta;
    });

    // Auto-create default notebook if none exists
    if (notebooks.length === 0) {
      const defaultId = `nb_${crypto.randomBytes(8).toString('hex')}`;
      const newNb = {
        ownerKey: identityKey,
        uid: req.identity.uid,
        ipHash: req.identity.ipHash,
        title: 'My Study Notebook',
        sourceCount: 0,
        isDeleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      await db.collection('neobook_notebooks').doc(defaultId).set(newNb);
      notebooks.push({
        id: defaultId,
        title: newNb.title,
        sourceCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    return res.json({ success: true, notebooks });
  } catch (err) {
    console.error('[NeoBook] Error listing notebooks:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve notebooks.' });
  }
});

// ── POST /api/neobook/notebooks ──────────────────────────────────────────────
neobookRouter.post('/notebooks', async (req, res) => {
  try {
    const title = typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 100)
      : 'Untitled Notebook';

    const notebookId = `nb_${crypto.randomBytes(8).toString('hex')}`;
    const nbData = {
      ownerKey: req.identity.identityKey,
      uid: req.identity.uid,
      ipHash: req.identity.ipHash,
      title,
      sourceCount: 0,
      isDeleted: false,
      createdAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      updatedAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      await db.collection('neobook_notebooks').doc(notebookId).set(nbData);
    }

    return res.json({
      success: true,
      notebook: {
        id: notebookId,
        title,
        sourceCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    console.error('[NeoBook] Error creating notebook:', err);
    return res.status(500).json({ success: false, error: 'Could not create notebook.' });
  }
});

// ── GET /api/neobook/notebooks/:notebookId/sources ───────────────────────────
neobookRouter.get('/notebooks/:notebookId/sources', async (req, res) => {
  try {
    const { notebookId } = req.params;
    if (!db) {
      return res.json({ success: true, sources: [] });
    }

    const snap = await db.collection('neobook_sources')
      .where('notebookId', '==', notebookId)
      .where('ownerKey', '==', req.identity.identityKey)
      .where('isDeleted', '==', false)
      .get()
      .catch(() =>
        db.collection('neobook_sources')
          .where('notebookId', '==', notebookId)
          .where('ownerKey', '==', req.identity.identityKey)
          .get()
      );

    const sources = [];
    snap.forEach(doc => {
      const data = doc.data();
      sources.push({
        id: doc.id,
        notebookId: data.notebookId,
        title: data.title,
        type: data.type,
        status: data.status,
        errorMessage: data.errorMessage || null,
        originalUrl: data.originalUrl || null,
        charCount: data.charCount || 0,
        chunksCount: data.chunksCount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
      });
    });

    return res.json({ success: true, sources });
  } catch (err) {
    console.error('[NeoBook] Error listing sources:', err);
    return res.status(500).json({ success: false, error: 'Could not load notebook sources.' });
  }
});

// ── POST /api/neobook/notebooks/:notebookId/sources ──────────────────────────
neobookRouter.post('/notebooks/:notebookId/sources', sourceRateLimiter, async (req, res) => {
  try {
    const { notebookId } = req.params;
    const { type, url, text, title: userTitle, pdfBase64 } = req.body || {};

    if (!['url', 'youtube', 'text', 'pdf'].includes(type)) {
      return res.status(400).json({ success: false, error: 'Unsupported source type. Valid types are: url, youtube, text, pdf.' });
    }

    // Check existing source count
    if (db) {
      const existingSourcesSnap = await db.collection('neobook_sources')
        .where('notebookId', '==', notebookId)
        .where('ownerKey', '==', req.identity.identityKey)
        .where('isDeleted', '==', false)
        .get();

      if (existingSourcesSnap.size >= NEOBOOK_CONFIG.MAX_SOURCES_PER_NOTEBOOK) {
        return res.status(400).json({
          success: false,
          error: `Maximum source limit reached (${NEOBOOK_CONFIG.MAX_SOURCES_PER_NOTEBOOK} sources per notebook).`
        });
      }
    }

    const sourceId = `src_${crypto.randomBytes(8).toString('hex')}`;
    let processedResult = null;
    let extractionError = null;

    try {
      if (type === 'url') {
        if (!url || typeof url !== 'string') throw new Error('A valid website URL is required.');
        processedResult = await fetchWebsiteContent(url);
      } else if (type === 'youtube') {
        if (!url || typeof url !== 'string') throw new Error('A valid YouTube video link is required.');
        processedResult = await extractYouTubeTranscript(url);
      } else if (type === 'text') {
        if (!text || typeof text !== 'string') throw new Error('Source text content is required.');
        processedResult = processRawTextInput(text, userTitle);
      } else if (type === 'pdf') {
        if (!pdfBase64 || typeof pdfBase64 !== 'string') throw new Error('PDF file data is missing or empty.');
        const cleanBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/i, '').trim();
        const buffer = Buffer.from(cleanBase64, 'base64');
        processedResult = await extractPdfText(buffer);
        if (userTitle && typeof userTitle === 'string' && userTitle.trim()) {
          processedResult.title = userTitle.trim().slice(0, 120);
        }
      }
    } catch (processErr) {
      extractionError = processErr.message;
    }

    const status = extractionError ? 'error' : 'ready';
    const finalTitle = userTitle || processedResult?.title || (type === 'youtube' ? 'YouTube Video' : 'Source Document');
    const fullText = processedResult?.text || '';

    // Generate chunks if processing succeeded
    let chunks = [];
    if (status === 'ready' && processedResult) {
      chunks = chunkSourceContent({
        sourceId,
        title: finalTitle,
        type,
        text: fullText,
        pages: processedResult.pages,
        segments: processedResult.segments,
        url: processedResult.url || url || undefined
      });
    }

    const sourceDoc = {
      id: sourceId,
      notebookId,
      ownerKey: req.identity.identityKey,
      uid: req.identity.uid,
      ipHash: req.identity.ipHash,
      title: finalTitle,
      type,
      originalUrl: url || null,
      status,
      errorMessage: extractionError || null,
      charCount: fullText.length,
      chunksCount: chunks.length,
      isDeleted: false,
      createdAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      updatedAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      // Save source record
      await db.collection('neobook_sources').doc(sourceId).set(sourceDoc);

      // Save chunks in a batch if ready
      if (chunks.length > 0) {
        const batch = db.batch();
        for (const chunk of chunks) {
          const chunkRef = db.collection('neobook_chunks').doc(chunk.chunkId);
          batch.set(chunkRef, {
            ...chunk,
            notebookId,
            ownerKey: req.identity.identityKey,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        await batch.commit();
      }

      // Increment sourceCount on notebook
      if (status === 'ready') {
        await db.collection('neobook_notebooks').doc(notebookId).set({
          sourceCount: admin.firestore.FieldValue.increment(1),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }
    }

    if (status === 'error') {
      return res.status(422).json({
        success: false,
        error: extractionError,
        source: {
          id: sourceId,
          title: finalTitle,
          type,
          status: 'error',
          errorMessage: extractionError
        }
      });
    }

    return res.json({
      success: true,
      source: {
        id: sourceId,
        title: finalTitle,
        type,
        status: 'ready',
        charCount: fullText.length,
        chunksCount: chunks.length
      }
    });
  } catch (err) {
    console.error('[NeoBook] Error adding source:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to process source.' });
  }
});

// ── DELETE /api/neobook/notebooks/:notebookId/sources/:sourceId ──────────────
neobookRouter.delete('/notebooks/:notebookId/sources/:sourceId', async (req, res) => {
  try {
    const { notebookId, sourceId } = req.params;
    if (db) {
      const sourceRef = db.collection('neobook_sources').doc(sourceId);
      const sourceSnap = await sourceRef.get();

      if (!sourceSnap.exists || sourceSnap.data().ownerKey !== req.identity.identityKey) {
        return res.status(404).json({ success: false, error: 'Source not found.' });
      }

      // Mark source as deleted
      await sourceRef.update({
        isDeleted: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Decrement sourceCount
      await db.collection('neobook_notebooks').doc(notebookId).set({
        sourceCount: admin.firestore.FieldValue.increment(-1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Clean up chunks
      const chunksSnap = await db.collection('neobook_chunks')
        .where('sourceId', '==', sourceId)
        .get();

      if (!chunksSnap.empty) {
        const batch = db.batch();
        chunksSnap.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      }
    }

    return res.json({ success: true, message: 'Source deleted.' });
  } catch (err) {
    console.error('[NeoBook] Error deleting source:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete source.' });
  }
});

// ── GET /api/neobook/notebooks/:notebookId/chats ─────────────────────────────
neobookRouter.get('/notebooks/:notebookId/chats', async (req, res) => {
  try {
    const { notebookId } = req.params;
    if (!db) {
      return res.json({ success: true, chats: [] });
    }

    const snap = await db.collection('neobook_chats')
      .where('notebookId', '==', notebookId)
      .where('ownerKey', '==', req.identity.identityKey)
      .where('isDeleted', '==', false)
      .get()
      .catch(() =>
        db.collection('neobook_chats')
          .where('notebookId', '==', notebookId)
          .where('ownerKey', '==', req.identity.identityKey)
          .get()
      );

    const chats = [];
    snap.forEach(doc => {
      const data = doc.data();
      chats.push({
        id: doc.id,
        notebookId: data.notebookId,
        title: data.title || 'Chat',
        messageCount: data.messageCount || 0,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt
      });
    });

    // Sort in memory by updatedAt descending
    chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return res.json({ success: true, chats });
  } catch (err) {
    console.error('[NeoBook] Error listing chats:', err);
    return res.status(500).json({ success: false, error: 'Could not load chat sessions.' });
  }
});

// ── POST /api/neobook/notebooks/:notebookId/chats (START NEW CHAT) ───────────
neobookRouter.post('/notebooks/:notebookId/chats', async (req, res) => {
  try {
    const { notebookId } = req.params;
    const title = typeof req.body?.title === 'string' && req.body.title.trim()
      ? req.body.title.trim().slice(0, 100)
      : 'New Chat';

    // ── Enforce 5 New Chats Per Day Limit ──
    const quotaResult = await checkAndConsumeNewChatQuota(req.identity);
    if (!quotaResult.allowed) {
      return res.status(429).json({
        success: false,
        error: quotaResult.error,
        code: 'DAILY_NEW_CHATS_LIMIT_REACHED',
        newChatsRemaining: 0,
        resetAt: quotaResult.resetAt
      });
    }

    const chatId = `chat_${crypto.randomBytes(8).toString('hex')}`;
    const chatDoc = {
      id: chatId,
      notebookId,
      ownerKey: req.identity.identityKey,
      uid: req.identity.uid,
      ipHash: req.identity.ipHash,
      title,
      messageCount: 0,
      isDeleted: false,
      createdAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
      updatedAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
    };

    if (db) {
      await db.collection('neobook_chats').doc(chatId).set(chatDoc);
    }

    return res.json({
      success: true,
      chat: {
        id: chatId,
        notebookId,
        title,
        messageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      quota: {
        newChatsUsed: quotaResult.newChatsUsed,
        newChatsRemaining: quotaResult.newChatsRemaining,
        resetAt: quotaResult.resetAt
      }
    });
  } catch (err) {
    console.error('[NeoBook] Error starting new chat:', err);
    return res.status(500).json({ success: false, error: 'Could not create new chat session.' });
  }
});

// ── GET /api/neobook/notebooks/:notebookId/chats/:chatId (REOPEN CHAT) ───────
// Reopening an existing chat does NOT consume a new-chat allowance!
neobookRouter.get('/notebooks/:notebookId/chats/:chatId', async (req, res) => {
  try {
    const { notebookId, chatId } = req.params;

    if (!db) {
      return res.json({
        success: true,
        chat: { id: chatId, notebookId, title: 'Chat' },
        messages: []
      });
    }

    const chatSnap = await db.collection('neobook_chats').doc(chatId).get();
    if (!chatSnap.exists || chatSnap.data().ownerKey !== req.identity.identityKey || chatSnap.data().isDeleted) {
      return res.status(404).json({ success: false, error: 'Chat session not found.' });
    }

    const chatData = chatSnap.data();

    // Fetch messages for this chat
    const msgSnap = await db.collection('neobook_messages')
      .where('chatId', '==', chatId)
      .get();

    const messages = [];
    msgSnap.forEach(doc => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        chatId: data.chatId,
        role: data.role,
        content: data.content,
        citations: data.citations || [],
        tokenUsage: data.tokenUsage || null,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp
      });
    });

    // Sort messages chronologically
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    return res.json({
      success: true,
      chat: {
        id: chatId,
        notebookId: chatData.notebookId,
        title: chatData.title,
        messageCount: chatData.messageCount || messages.length
      },
      messages
    });
  } catch (err) {
    console.error('[NeoBook] Error retrieving chat:', err);
    return res.status(500).json({ success: false, error: 'Could not reopen chat session.' });
  }
});

// ── POST /api/neobook/notebooks/:notebookId/chats/:chatId/messages ────────────
// Follow-up messages do NOT count as new chats!
neobookRouter.post('/notebooks/:notebookId/chats/:chatId/messages', chatRateLimiter, async (req, res) => {
  try {
    const { notebookId, chatId } = req.params;
    const { message } = req.body || {};

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Please provide a non-empty message.' });
    }

    const cleanQuery = message.trim().slice(0, 4_000);

    // Verify chat existence and ownership
    let chatData = null;
    if (db) {
      const chatSnap = await db.collection('neobook_chats').doc(chatId).get();
      if (!chatSnap.exists || chatSnap.data().ownerKey !== req.identity.identityKey || chatSnap.data().isDeleted) {
        return res.status(404).json({ success: false, error: 'Chat session not found.' });
      }
      chatData = chatSnap.data();
    }

    // Load available source chunks for this notebook
    let allChunks = [];
    if (db) {
      const chunksSnap = await db.collection('neobook_chunks')
        .where('notebookId', '==', notebookId)
        .where('ownerKey', '==', req.identity.identityKey)
        .get();

      chunksSnap.forEach(doc => allChunks.push(doc.data()));
    }

    // Step 1: Retrieve top relevant chunks
    const retrievedChunks = retrieveRelevantChunks(allChunks, cleanQuery, NEOBOOK_CONFIG.TOP_K_CHUNKS);

    // Step 2: Load recent conversation context
    const conversationHistory = [];
    if (db) {
      const historySnap = await db.collection('neobook_messages')
        .where('chatId', '==', chatId)
        .get();

      const msgs = [];
      historySnap.forEach(doc => msgs.push(doc.data()));
      msgs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      for (const m of msgs.slice(-6)) {
        conversationHistory.push({ role: m.role, content: m.content });
      }
    }

    // Step 3: Call NeoBook AI Service
    const aiResult = await generateGroundedAnswer({
      query: cleanQuery,
      retrievedChunks,
      conversationHistory
    });

    // Step 4: Record Token Usage
    const usageResult = await recordMessageTokenUsage(req.identity, {
      inputTokens: aiResult.inputTokens,
      outputTokens: aiResult.outputTokens,
      estimatedCostUsd: aiResult.estimatedCostUsd
    });

    // Step 5: Save user and assistant messages
    const userMsgId = `msg_${crypto.randomBytes(8).toString('hex')}`;
    const assistantMsgId = `msg_${crypto.randomBytes(8).toString('hex')}`;
    const now = new Date();

    if (db) {
      const batch = db.batch();

      // User message
      const userMsgRef = db.collection('neobook_messages').doc(userMsgId);
      batch.set(userMsgRef, {
        id: userMsgId,
        chatId,
        notebookId,
        ownerKey: req.identity.identityKey,
        uid: req.identity.uid,
        role: 'user',
        content: cleanQuery,
        timestamp: admin.firestore.Timestamp.fromDate(now)
      });

      // Assistant message
      const assistantMsgRef = db.collection('neobook_messages').doc(assistantMsgId);
      batch.set(assistantMsgRef, {
        id: assistantMsgId,
        chatId,
        notebookId,
        ownerKey: req.identity.identityKey,
        uid: req.identity.uid,
        role: 'assistant',
        content: aiResult.answer,
        citations: aiResult.citations,
        tokenUsage: {
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          estimatedCostUsd: aiResult.estimatedCostUsd,
          modelUsed: aiResult.modelUsed
        },
        timestamp: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 100))
      });

      // Update chat messageCount and title if it was first message
      const updateChat = {
        messageCount: admin.firestore.FieldValue.increment(2),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      if (!chatData?.title || chatData.title === 'New Chat') {
        updateChat.title = cleanQuery.slice(0, 45).replace(/\n/g, ' ');
      }
      batch.set(db.collection('neobook_chats').doc(chatId), updateChat, { merge: true });

      await batch.commit();
    }

    return res.json({
      success: true,
      message: {
        id: assistantMsgId,
        role: 'assistant',
        content: aiResult.answer,
        citations: aiResult.citations,
        retrievedCount: aiResult.retrievedCount,
        tokenUsage: {
          inputTokens: aiResult.inputTokens,
          outputTokens: aiResult.outputTokens,
          estimatedCostUsd: aiResult.estimatedCostUsd,
          modelUsed: aiResult.modelUsed
        },
        timestamp: new Date().toISOString()
      },
      quota: {
        tokensUsed: usageResult.tokensUsed,
        tokensRemaining: usageResult.tokensRemaining,
        resetAt: usageResult.resetAt
      }
    });
  } catch (err) {
    console.error('[NeoBook] Error processing chat message:', err);
    return res.status(500).json({ success: false, error: err.message || 'Error processing response.' });
  }
});

// ── DELETE /api/neobook/notebooks/:notebookId/chats/:chatId ──────────────────
neobookRouter.delete('/notebooks/:notebookId/chats/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    if (db) {
      const chatRef = db.collection('neobook_chats').doc(chatId);
      const chatSnap = await chatRef.get();
      if (!chatSnap.exists || chatSnap.data().ownerKey !== req.identity.identityKey) {
        return res.status(404).json({ success: false, error: 'Chat not found.' });
      }

      await chatRef.update({
        isDeleted: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.json({ success: true, message: 'Chat deleted.' });
  } catch (err) {
    console.error('[NeoBook] Error deleting chat:', err);
    return res.status(500).json({ success: false, error: 'Could not delete chat.' });
  }
});
