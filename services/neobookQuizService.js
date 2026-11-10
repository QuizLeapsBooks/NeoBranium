/**
 * services/neobookQuizService.js
 *
 * Dedicated assessment engine for NeoBook:
 * - Content-grounded quiz generation via Gemini API
 * - Multi-source stratification (PDFs, YouTube, Web, Notes)
 * - Anti-hallucination source boundary enforcement
 * - Strict MCQ schema validation (4 options, 1 correct index, explanation, citation)
 * - Token budget accounting and cost estimation
 * - Firestore persistence for quizzes and attempts
 */

import crypto from 'crypto';
import { db, admin } from '../firebaseAdmin.js';
import { NEOBOOK_CONFIG } from './neobookConfig.js';
import { estimateCostUsd } from './neobookAiService.js';

const geminiApiKey = process.env.GEMINI_API_KEY;
const groqApiKey = process.env.GROQ_API_KEY;

/**
 * Sanitizes Firestore objects to prevent undefined property errors.
 */
function cleanForFirestore(obj) {
  if (obj === null || obj === undefined) return null;
  if (Array.isArray(obj)) return obj.map(cleanForFirestore);
  if (typeof obj !== 'object' || obj instanceof Date || (obj.constructor && obj.constructor.name === 'Timestamp')) {
    return obj;
  }
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      clean[key] = cleanForFirestore(val);
    }
  }
  return clean;
}

/**
 * Validates and normalizes quiz configuration parameters.
 * @param {object} params
 * @returns {{ difficulty: string, questionCount: number }}
 */
export function validateQuizConfig(params = {}) {
  let difficulty = typeof params.difficulty === 'string' ? params.difficulty.toLowerCase().trim() : 'medium';
  if (!NEOBOOK_CONFIG.ALLOWED_QUIZ_DIFFICULTIES.includes(difficulty)) {
    difficulty = 'medium';
  }

  let questionCount = Number(params.questionCount) || 5;
  if (!NEOBOOK_CONFIG.ALLOWED_QUIZ_COUNTS.includes(questionCount)) {
    questionCount = 5;
  }

  return { difficulty, questionCount };
}

/**
 * Selects representative, evenly distributed chunks across selected sources.
 * @param {Array<object>} allChunks
 * @param {Array<string>|null} sourceIds
 * @param {number} maxChunks
 * @returns {Array<object>}
 */
export function selectRepresentativeChunks(allChunks, sourceIds = null, maxChunks = NEOBOOK_CONFIG.MAX_QUIZ_CHUNKS) {
  if (!Array.isArray(allChunks) || allChunks.length === 0) return [];

  // Filter by sourceIds if specified
  let filtered = allChunks;
  if (Array.isArray(sourceIds) && sourceIds.length > 0) {
    const allowed = new Set(sourceIds);
    filtered = allChunks.filter(c => allowed.has(c.sourceId));
  }

  if (filtered.length <= maxChunks) return filtered;

  // Group by sourceId to ensure fair coverage across all selected sources
  const bySource = new Map();
  for (const chunk of filtered) {
    const sId = chunk.sourceId || 'default';
    if (!bySource.has(sId)) bySource.set(sId, []);
    bySource.get(sId).push(chunk);
  }

  const selected = [];
  const sources = Array.from(bySource.values());
  let index = 0;

  while (selected.length < maxChunks && sources.some(list => index < list.length)) {
    for (const list of sources) {
      if (index < list.length && selected.length < maxChunks) {
        selected.push(list[index]);
      }
    }
    index++;
  }

  return selected;
}

/**
 * Constructs prompt instructions for Gemini structured MCQ generation.
 */
function buildQuizPrompt({ chunks, difficulty, questionCount }) {
  const chunksText = chunks.map((c, i) => {
    const meta = [];
    if (c.metadata?.pageNum) meta.push(`Page ${c.metadata.pageNum}`);
    if (c.metadata?.timestamp) meta.push(`Timestamp ${c.metadata.timestamp}`);
    if (c.metadata?.url) meta.push(`URL: ${c.metadata.url}`);
    const metaStr = meta.length > 0 ? ` (${meta.join(', ')})` : '';

    return `<source_excerpt index="${i + 1}" source_id="${c.sourceId || ''}" title="${c.sourceTitle || 'Source'}"${metaStr}>
${c.text}
</source_excerpt>`;
  }).join('\n\n');

  const difficultyInstruction = {
    easy: 'Focus on direct factual recall, clear definitions, stated names, dates, or formulas directly stated in the text.',
    medium: 'Focus on understanding, comparing concepts, cause-and-effect relationships, and explaining why certain principles apply.',
    hard: 'Focus on multi-step reasoning, analytical deduction, distinguishing subtle differences, and evaluating complex statements.',
    mixed: `Provide a balanced mix: approximately 30% easy, 40% medium, and 30% challenging analytical questions.`
  }[difficulty] || 'Provide a balanced mix of conceptual and factual questions.';

  const systemInstruction = `You are an expert academic curriculum assessment author for NeoBranium's NeoBook.
Your task is to generate a rigorous, engaging, and 100% source-grounded multiple-choice quiz (MCQ) containing EXACTLY ${questionCount} questions based ONLY on the provided reference source excerpts.

TARGET DIFFICULTY: ${difficulty.toUpperCase()}
${difficultyInstruction}

CRITICAL RULES:
1. STRICT SOURCE GROUNDING: Every question, correct answer, and explanation must be fully justified by the provided source excerpts. Never use external knowledge or invent facts not found in the text.
2. QUESTION STRUCTURE:
   - Provide exactly 4 plausible, unambiguous options per question.
   - Exactly one option must be unambiguously correct.
   - Distractors (incorrect options) must be realistic and test common misconceptions without being trick questions or grammatically broken.
   - correctIndex must be an integer (0, 1, 2, or 3) indicating the exact position of the correct answer in the options array.
3. EXPLANATIONS:
   - Write a clear, pedagogical explanation for every question detailing WHY the correct answer is right and clarifying any misconceptions in the distractors.
   - Reference the exact source title, page number, or video timestamp where the answer is verified.
4. VARIETY:
   - Do NOT repeat questions or ask about the exact same phrase multiple times.
   - Randomize the placement of the correct answer index across 0, 1, 2, and 3.
5. CLEAN TEXT:
   - Write in clean, modern English.
   - Do NOT use unnecessary LaTeX math syntax ($...$) for standard numbers, mark weightages, or dates. Only use math delimiters for genuine algebraic or mathematical formulas.

RESPONSE FORMAT:
You must respond with a valid JSON object matching this exact schema:
{
  "title": "A concise, engaging title for this quiz based on the sources",
  "topicSummary": "A 1-sentence summary of the main topics tested",
  "questions": [
    {
      "id": "q1",
      "question": "Question text here?",
      "options": [
        "First option",
        "Second option",
        "Third option",
        "Fourth option"
      ],
      "correctIndex": 0,
      "explanation": "Detailed explanation citing the fact from the source.",
      "topic": "Concise topic or chapter name (e.g. History, Civics, Science)",
      "difficulty": "easy | medium | hard",
      "sourceCitation": {
        "title": "Title of the source",
        "pageNum": 5,
        "timestamp": "04:30"
      }
    }
  ]
}`;

  const userContent = `Here are the reference source excerpts to construct the quiz from:

${chunksText}

---
TASK: Generate an Interactive Knowledge Quiz with EXACTLY ${questionCount} questions matching the difficulty level "${difficulty}". Output ONLY the valid JSON object.`;

  return { systemInstruction, userContent };
}

/**
 * Generates an Interactive Knowledge Quiz from source chunks.
 * Uses Gemini API with JSON mode, validates questions, tracks tokens, and saves to Firestore.
 *
 * @param {object} params
 * @param {string} params.notebookId
 * @param {Array<string>} [params.sourceIds]
 * @param {string} [params.difficulty]
 * @param {number} [params.questionCount]
 * @param {Array<object>} params.allChunks
 * @param {object} params.identity
 * @returns {Promise<{ quiz: object, tokenUsage: object }>}
 */
export async function generateQuizFromSources({
  notebookId,
  sourceIds = null,
  difficulty = 'medium',
  questionCount = 5,
  allChunks = [],
  identity
}) {
  const config = validateQuizConfig({ difficulty, questionCount });
  const selectedChunks = selectRepresentativeChunks(allChunks, sourceIds, NEOBOOK_CONFIG.MAX_QUIZ_CHUNKS);

  if (selectedChunks.length === 0) {
    throw new Error('No readable content found in the selected sources. Please ensure your sources are processed and ready.');
  }

  const totalContentLength = selectedChunks.reduce((acc, c) => acc + (c.text?.length || 0), 0);
  if (totalContentLength < 250) {
    throw new Error('Selected source material is too brief to generate a comprehensive quiz. Please upload more content or select additional sources.');
  }

  const { systemInstruction, userContent } = buildQuizPrompt({
    chunks: selectedChunks,
    difficulty: config.difficulty,
    questionCount: config.questionCount
  });

  const modelName = NEOBOOK_CONFIG.AI_MODEL;
  let rawJsonText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let modelUsed = modelName;

  // Primary: Gemini API with JSON mode
  if (geminiApiKey) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiApiKey}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), NEOBOOK_CONFIG.QUIZ_AI_TIMEOUT_MS);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: [{ role: 'user', parts: [{ text: userContent }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2, // Low temperature for high adherence to facts
            maxOutputTokens: NEOBOOK_CONFIG.MAX_OUTPUT_TOKENS
          }
        }),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        console.error(`[NeoBook Quiz] Gemini error (${response.status}):`, errorBody.slice(0, 300));
        throw new Error(`Gemini API error status: ${response.status}`);
      }

      const data = await response.json();
      rawJsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      inputTokens = data.usageMetadata?.promptTokenCount || 0;
      outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
    } catch (apiErr) {
      console.warn('[NeoBook Quiz] Gemini call failed, trying Groq fallback:', apiErr.message);

      // Secondary Fallback: Groq API
      if (groqApiKey) {
        try {
          const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
              messages: [
                { role: 'system', content: systemInstruction + '\nRespond with raw JSON only.' },
                { role: 'user', content: userContent }
              ],
              response_format: { type: 'json_object' },
              temperature: 0.2,
              max_tokens: NEOBOOK_CONFIG.MAX_OUTPUT_TOKENS
            })
          });

          if (groqRes.ok) {
            const groqData = await groqRes.json();
            rawJsonText = groqData.choices?.[0]?.message?.content || '';
            inputTokens = groqData.usage?.prompt_tokens || 0;
            outputTokens = groqData.usage?.completion_tokens || 0;
            modelUsed = `groq/${process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'}`;
          } else {
            throw new Error(`Groq returned ${groqRes.status}`);
          }
        } catch (groqErr) {
          throw new Error('AI service is momentarily unavailable for quiz generation. Please retry in a few moments.');
        }
      } else {
        throw new Error('AI quiz generation failed. Please check your network and try again.');
      }
    } finally {
      clearTimeout(timeout);
    }
  } else {
    throw new Error('Gemini API key is not configured on the server.');
  }

  // Parse and validate the JSON output
  let parsed = null;
  try {
    let cleanJson = rawJsonText.trim();
    if (cleanJson.startsWith('```json')) cleanJson = cleanJson.replace(/^```json\s*/i, '');
    if (cleanJson.startsWith('```')) cleanJson = cleanJson.replace(/^```\s*/i, '');
    if (cleanJson.endsWith('```')) cleanJson = cleanJson.replace(/\s*```$/i, '');
    parsed = JSON.parse(cleanJson);
  } catch (parseErr) {
    console.error('[NeoBook Quiz] JSON parse error:', parseErr.message, rawJsonText.slice(0, 300));
    throw new Error('Failed to parse AI quiz response into valid format. Please try generating again.');
  }

  if (!parsed || !Array.isArray(parsed.questions) || parsed.questions.length === 0) {
    throw new Error('AI was unable to formulate questions from the provided source content.');
  }

  // Validate each question strictly
  const validatedQuestions = [];
  const seenQuestionTexts = new Set();

  for (let i = 0; i < parsed.questions.length; i++) {
    const q = parsed.questions[i];
    if (!q || typeof q.question !== 'string' || q.question.trim().length < 5) continue;
    if (!Array.isArray(q.options) || q.options.length !== 4) continue;

    // Check unique question
    const normQ = q.question.trim().toLowerCase();
    if (seenQuestionTexts.has(normQ)) continue;
    seenQuestionTexts.add(normQ);

    // Validate correctIndex
    let cIdx = Number(q.correctIndex);
    if (isNaN(cIdx) || cIdx < 0 || cIdx > 3) cIdx = 0;

    // Validate options
    const cleanOptions = q.options.map(opt => String(opt || '').trim()).filter(Boolean);
    if (cleanOptions.length !== 4) continue;

    // Citations
    const citation = {};
    if (q.sourceCitation && typeof q.sourceCitation === 'object') {
      if (q.sourceCitation.title) citation.title = String(q.sourceCitation.title).trim();
      if (q.sourceCitation.pageNum != null) citation.pageNum = q.sourceCitation.pageNum;
      if (q.sourceCitation.timestamp != null) citation.timestamp = q.sourceCitation.timestamp;
    }
    if (!citation.title && selectedChunks[0]?.sourceTitle) {
      citation.title = selectedChunks[0].sourceTitle;
    }

    validatedQuestions.push({
      id: `q_${i + 1}`,
      question: q.question.trim(),
      options: cleanOptions,
      correctIndex: cIdx,
      explanation: typeof q.explanation === 'string' && q.explanation.trim()
        ? q.explanation.trim()
        : 'Refer to source material for verification.',
      topic: typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General',
      difficulty: typeof q.difficulty === 'string' ? q.difficulty.toLowerCase() : config.difficulty,
      sourceCitation: citation
    });

    if (validatedQuestions.length >= config.questionCount) {
      break;
    }
  }

  if (validatedQuestions.length < 3) {
    throw new Error('Could not formulate sufficient distinct questions from this source material. Try uploading more detailed content.');
  }

  // Calculate tokens & costs fallback
  if (inputTokens === 0) {
    inputTokens = Math.ceil((systemInstruction.length + userContent.length) / 4);
  }
  if (outputTokens === 0) {
    outputTokens = Math.ceil(rawJsonText.length / 4);
  }

  const estimatedCostUsd = estimateCostUsd(inputTokens, outputTokens);
  const quizTitle = typeof parsed.title === 'string' && parsed.title.trim()
    ? parsed.title.trim().slice(0, 100)
    : `Knowledge Quiz (${config.difficulty.toUpperCase()})`;

  const sourceTitles = Array.from(new Set(selectedChunks.map(c => c.sourceTitle).filter(Boolean)));
  const quizId = `quiz_${crypto.randomBytes(8).toString('hex')}`;

  const quizDoc = {
    id: quizId,
    notebookId,
    ownerKey: identity.identityKey,
    uid: identity.uid,
    title: quizTitle,
    topicSummary: parsed.topicSummary || '',
    difficulty: config.difficulty,
    questionCount: validatedQuestions.length,
    sourceTitles,
    sourceIds: sourceIds || [],
    questions: validatedQuestions,
    tokenUsage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      modelUsed
    },
    attemptsCount: 0,
    bestScore: null,
    createdAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString(),
    updatedAt: admin?.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date().toISOString()
  };

  // Persist to Firestore
  if (db) {
    await db.collection('neobook_quizzes').doc(quizId).set(cleanForFirestore(quizDoc));
  }

  return {
    quiz: {
      ...quizDoc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    tokenUsage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd,
      modelUsed
    }
  };
}

/**
 * Records a completed quiz attempt in Firestore.
 * Calculates score, percentage, topic-wise breakdown, and persists attempt data.
 *
 * @param {object} params
 * @param {string} params.quizId
 * @param {string} params.notebookId
 * @param {object} params.identity
 * @param {object} params.userAnswers - Map of { [questionId]: selectedIndex }
 * @returns {Promise<object>}
 */
export async function recordQuizAttempt({ quizId, notebookId, identity, userAnswers = {} }) {
  if (!db) {
    throw new Error('Database connection is not available.');
  }

  const quizRef = db.collection('neobook_quizzes').doc(quizId);
  const quizSnap = await quizRef.get();

  if (!quizSnap.exists || quizSnap.data().ownerKey !== identity.identityKey) {
    throw new Error('Quiz not found or unauthorized.');
  }

  const quiz = quizSnap.data();
  const questions = quiz.questions || [];
  let correctCount = 0;
  const topicStats = {};

  const evaluatedQuestions = questions.map((q, idx) => {
    const selected = userAnswers[q.id] != null ? Number(userAnswers[q.id]) : null;
    const isCorrect = selected === q.correctIndex;
    if (isCorrect) correctCount++;

    const topic = q.topic || 'General';
    if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0 };
    topicStats[topic].total++;
    if (isCorrect) topicStats[topic].correct++;

    return {
      id: q.id,
      question: q.question,
      options: q.options,
      correctIndex: q.correctIndex,
      selectedIndex: selected,
      isCorrect,
      explanation: q.explanation,
      topic,
      sourceCitation: q.sourceCitation
    };
  });

  const totalQuestions = questions.length;
  const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  // Compute topic mastery
  const topicBreakdown = Object.entries(topicStats).map(([topic, data]) => ({
    topic,
    correct: data.correct,
    total: data.total,
    percentage: Math.round((data.correct / data.total) * 100)
  }));

  const attemptId = `atm_${crypto.randomBytes(8).toString('hex')}`;
  const attemptDoc = {
    id: attemptId,
    quizId,
    notebookId,
    ownerKey: identity.identityKey,
    uid: identity.uid,
    score: correctCount,
    totalQuestions,
    percentage,
    topicBreakdown,
    userAnswers,
    completedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(db.collection('neobook_quiz_attempts').doc(attemptId), cleanForFirestore(attemptDoc));

  // Update quiz metadata
  const currentBest = Number(quiz.bestScore) || 0;
  batch.set(quizRef, {
    attemptsCount: admin.firestore.FieldValue.increment(1),
    bestScore: Math.max(currentBest, correctCount),
    lastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();

  return {
    attemptId,
    quizId,
    title: quiz.title,
    score: correctCount,
    totalQuestions,
    percentage,
    topicBreakdown,
    evaluatedQuestions,
    completedAt: new Date().toISOString()
  };
}

/**
 * Retrieves all quizzes for a notebook.
 */
export async function getNotebookQuizzes({ notebookId, identity }) {
  if (!db) return [];

  const snap = await db.collection('neobook_quizzes')
    .where('notebookId', '==', notebookId)
    .where('ownerKey', '==', identity.identityKey)
    .get();

  const quizzes = [];
  snap.forEach(doc => {
    const data = doc.data();
    quizzes.push({
      id: doc.id,
      title: data.title,
      difficulty: data.difficulty,
      questionCount: data.questionCount || (data.questions ? data.questions.length : 0),
      sourceTitles: data.sourceTitles || [],
      attemptsCount: data.attemptsCount || 0,
      bestScore: data.bestScore ?? null,
      createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
    });
  });

  quizzes.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return quizzes;
}

/**
 * Retrieves a full quiz by ID.
 */
export async function getQuizById({ quizId, identity }) {
  if (!db) return null;

  const snap = await db.collection('neobook_quizzes').doc(quizId).get();
  if (!snap.exists || snap.data().ownerKey !== identity.identityKey) {
    return null;
  }

  const data = snap.data();

  // Load previous attempts for this quiz
  const attemptsSnap = await db.collection('neobook_quiz_attempts')
    .where('quizId', '==', quizId)
    .where('ownerKey', '==', identity.identityKey)
    .get();

  const attempts = [];
  attemptsSnap.forEach(d => {
    const a = d.data();
    attempts.push({
      id: d.id,
      score: a.score,
      totalQuestions: a.totalQuestions,
      percentage: a.percentage,
      completedAt: a.completedAt?.toDate ? a.completedAt.toDate().toISOString() : a.completedAt
    });
  });

  attempts.sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0));

  return {
    id: snap.id,
    notebookId: data.notebookId,
    title: data.title,
    difficulty: data.difficulty,
    questionCount: data.questionCount,
    sourceTitles: data.sourceTitles || [],
    questions: data.questions || [],
    attempts,
    createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt
  };
}

