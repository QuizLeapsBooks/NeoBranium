import crypto from 'crypto';
import { db, admin } from '../firebaseAdmin.js';
import { NEOBOOK_CONFIG } from './neobookConfig.js';
import { estimateCostUsd } from './neobookAiService.js';
import { fetchWithRetry } from '../utils/backendRequestProtection.js';

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function generateStudyGuide({ notebookId, chatId, identity, chunks, signal }) {
  if (!geminiApiKey) throw new Error('Gemini API key is not configured on the server.');
  const usable = chunks.filter(chunk => chunk?.text).slice(0, 25);
  if (!usable.length) throw new Error('No readable source content is available for a study guide.');
  const excerpts = usable.map((chunk, i) => `[${i + 1}] ${chunk.sourceTitle || 'Source'}${chunk.metadata?.pageNum ? ` | page ${chunk.metadata.pageNum}` : ''}${chunk.metadata?.timestamp ? ` | ${chunk.metadata.timestamp}` : ''}\n${chunk.text}`).join('\n\n');
  const prompt = `Create a structured study guide using ONLY these excerpts. Return JSON only: {"title":"...","summary":"...","chapters":[{"title":"...","summary":"...","keyPoints":["..."],"sourceCitation":{"title":"...","pageNum":1,"timestamp":"00:00"}}],"timeline":[{"event":"...","dateOrOrder":"...","sourceCitation":{"title":"..."}}],"formulas":[{"name":"...","formula":"...","meaning":"...","sourceCitation":{"title":"..."}}],"comparisons":[{"title":"...","columns":["Aspect","A","B"],"rows":[["...","...","..."]],"sourceCitation":{"title":"..."}}]}. Omit sections not supported by the excerpts; never invent facts.\n\n${excerpts}`;
  const response = await fetchWithRetry(`https://generativelanguage.googleapis.com/v1beta/models/${NEOBOOK_CONFIG.AI_MODEL}:generateContent?key=${geminiApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.15, maxOutputTokens: NEOBOOK_CONFIG.MAX_OUTPUT_TOKENS } }), signal }, { maxRetries: 1, timeoutMs: NEOBOOK_CONFIG.QUIZ_AI_TIMEOUT_MS });
  if (!response.ok) throw new Error('Gemini is momentarily unavailable for study-guide generation.');
  const data = await response.json(); let guide;
  try { guide = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'); } catch { throw new Error('Gemini returned an invalid study guide response.'); }
  if (!guide.summary && !Array.isArray(guide.chapters)) throw new Error('The selected sources do not contain enough structured information for a study guide.');
  const id = `sg_${crypto.randomBytes(8).toString('hex')}`; const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4); const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(JSON.stringify(guide).length / 4);
  const doc = { id, notebookId, chatId, ownerKey: identity.identityKey, uid: identity.uid, title: String(guide.title || 'Study Guide').slice(0, 100), guide, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (db) await db.collection('neobook_study_guides').doc(id).set(doc);
  return { guide: { ...doc, createdAt: new Date().toISOString() }, tokenUsage: { inputTokens, outputTokens, estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens) } };
}
