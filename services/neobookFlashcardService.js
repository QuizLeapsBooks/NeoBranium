import crypto from 'crypto';
import { db, admin } from '../firebaseAdmin.js';
import { NEOBOOK_CONFIG } from './neobookConfig.js';
import { estimateCostUsd } from './neobookAiService.js';

const geminiApiKey = process.env.GEMINI_API_KEY;

export async function generateFlashcards({ notebookId, chatId, identity, chunks, count = 10 }) {
  if (!geminiApiKey) throw new Error('Gemini API key is not configured on the server.');
  const usable = (chunks || []).filter(chunk => chunk?.text).slice(0, 20);
  if (usable.length === 0) throw new Error('No readable source content is available for flashcards.');
  const requested = [5, 10, 15, 20].includes(Number(count)) ? Number(count) : 10;
  const excerpts = usable.map((chunk, index) => `[${index + 1}] ${chunk.sourceTitle || 'Source'}${chunk.metadata?.pageNum ? `, page ${chunk.metadata.pageNum}` : ''}${chunk.metadata?.timestamp ? `, ${chunk.metadata.timestamp}` : ''}\n${chunk.text}`).join('\n\n');
  const prompt = `Create exactly ${requested} concise active-recall flashcards from ONLY these excerpts. Each card must test a definition, formula, vocabulary term, relationship, or key concept explicitly supported by the excerpts. Never use outside knowledge. Return JSON only: {"title":"...","cards":[{"front":"question or term","back":"concise answer","explanation":"brief source-grounded explanation","sourceCitation":{"title":"source title","pageNum":1,"timestamp":"00:00"}}]}.\n\n${excerpts}`;
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${NEOBOOK_CONFIG.AI_MODEL}:generateContent?key=${geminiApiKey}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: NEOBOOK_CONFIG.MAX_OUTPUT_TOKENS } }) });
  if (!response.ok) throw new Error('Gemini is momentarily unavailable for flashcard generation.');
  const data = await response.json();
  let parsed; try { parsed = JSON.parse(data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'); } catch { throw new Error('Gemini returned an invalid flashcard response.'); }
  const cards = (parsed.cards || []).filter(card => card && typeof card.front === 'string' && typeof card.back === 'string' && card.front.trim() && card.back.trim()).slice(0, requested).map((card, index) => ({ id: `card_${index + 1}`, front: card.front.trim(), back: card.back.trim(), explanation: String(card.explanation || '').trim(), sourceCitation: card.sourceCitation || {}, repetitions: 0, intervalDays: 0, dueAt: new Date().toISOString() }));
  if (cards.length < requested) throw new Error(`Only ${cards.length} distinct source-supported flashcards could be created. Add more source material or choose fewer cards.`);
  const id = `fcs_${crypto.randomBytes(8).toString('hex')}`;
  const inputTokens = data.usageMetadata?.promptTokenCount || Math.ceil(prompt.length / 4);
  const outputTokens = data.usageMetadata?.candidatesTokenCount || Math.ceil(JSON.stringify(parsed).length / 4);
  const set = { id, notebookId, chatId, ownerKey: identity.identityKey, uid: identity.uid, title: String(parsed.title || 'Smart Flashcards').slice(0, 100), cards, cardCount: cards.length, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (db) await db.collection('neobook_flashcard_sets').doc(id).set(set);
  return { set: { ...set, createdAt: new Date().toISOString() }, tokenUsage: { inputTokens, outputTokens, estimatedCostUsd: estimateCostUsd(inputTokens, outputTokens) } };
}

export async function reviewFlashcard({ setId, cardId, rating, identity }) {
  if (!db) throw new Error('Database connection is not available.');
  const ref = db.collection('neobook_flashcard_sets').doc(setId); const snap = await ref.get();
  if (!snap.exists || snap.data().ownerKey !== identity.identityKey) throw new Error('Flashcard set not found.');
  const multipliers = { again: 0, hard: 1, good: 2, easy: 3 }; if (!(rating in multipliers)) throw new Error('Invalid review rating.');
  const cards = snap.data().cards || []; const index = cards.findIndex(card => card.id === cardId); if (index < 0) throw new Error('Flashcard not found.');
  const card = cards[index]; const intervalDays = rating === 'again' ? 0 : Math.max(1, (card.intervalDays || 1) * multipliers[rating]);
  cards[index] = { ...card, repetitions: (card.repetitions || 0) + 1, intervalDays, dueAt: new Date(Date.now() + intervalDays * 86400000).toISOString(), lastRating: rating };
  await ref.update({ cards, updatedAt: admin.firestore.FieldValue.serverTimestamp() }); return { card: cards[index] };
}
