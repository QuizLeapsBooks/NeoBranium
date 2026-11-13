import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const read = file => fs.readFileSync(path.resolve(file), 'utf8');

test('AI usage dashboard is private, authenticated, and reads only persisted usage API data', () => {
  const html = read('htmls/ai-usage.html');
  const script = read('js/ai-usage-dashboard.js');
  const model = read('js/ai-usage-dashboard-model.js');
  assert.match(html, /id="signInNotice"/);
  assert.match(html, /Sign in to view your AI usage/);
  assert.match(html, /name="robots" content="noindex, nofollow"/);
  assert.match(html, /id="usageError" hidden role="alert"/);
  assert.match(html, /id="activityEmpty" hidden/);
  assert.match(script, /onAuthStateChanged\(auth/);
  assert.match(script, /catch \(error\)/);
  assert.match(script, /api\.fetchDaily\(activeRange\.from, activeRange\.to, authenticatedUser\)/);
  assert.match(model, /\/api\/ai-usage\/daily/);
  assert.match(model, /Authorization: `Bearer \$\{token\}`/);
  assert.doesNotMatch(model, /searchParams\.set\(['"]uid['"]/);
  assert.doesNotMatch(script + model, /getFirestore|firebase-firestore/);
});

test('chatbot quiz context retains recent results without a composite index query', () => {
  const server = read('server.js');
  const queryStart = server.indexOf("const calSnap = await db");
  const queryEnd = server.indexOf('const recentQuizzes = [];', queryStart);
  const query = server.slice(queryStart, queryEnd);
  assert.match(query, /\.where\('date', '>=', sinceStr\)[\s\S]*\.orderBy\('date', 'desc'\)[\s\S]*\.limit\(32\)/);
  assert.match(query, /\.where\('date', '<=', throughStr\)/);
  assert.doesNotMatch(query, /\.where\('quizCompleted'/);
  assert.match(server, /getQuizContextDateRange\(\)/);
  assert.match(server, /if \(day\.quizCompleted !== true\) return;/);
  const profileStart = server.indexOf('// ── Fetch student learning profile');
  const profileEnd = server.indexOf('// Build system prompt based on task', profileStart);
  const profileContext = server.slice(profileStart, profileEnd);
  assert.match(profileContext, /catch \(profileErr\)/);
  assert.match(profileContext, /profile fetch failure must never break the chat/);
});

test('dashboard quiz history queries avoid the quizCompleted/date composite index', () => {
  const dashboard = read('js/dashboard-smart.js');
  assert.equal((dashboard.match(/collection\(db, "mentor_calendar", user\.uid, "days"\)/g) || []).length, 3);
  assert.equal((dashboard.match(/where\("date", ">=", since(?:30)?Key\)/g) || []).length, 3);
  assert.equal((dashboard.match(/where\("quizCompleted"/g) || []).length, 0);
  assert.match(dashboard, /if \(day\.quizCompleted !== true\) return;/);
  assert.match(dashboard, /snap\.docs\.filter\(dayDoc => dayDoc\.data\(\)\.quizCompleted === true\)/);
  assert.match(dashboard, /orderBy\("date", "desc"\)[\s\S]*?limit\(32\)/);
  assert.match(dashboard, /orderBy\("date", "desc"\)[\s\S]*?limit\(16\)/);
});

test('NeoLens only sends authenticated requests and recovers its controls after failure', () => {
  const client = read('htmls/doubt/neolens-api.js');
  const script = read('htmls/doubt/script.js');
  const server = read('server.js');
  assert.match(client, /AUTH_REQUIRED/);
  assert.match(client, /Authorization/);
  assert.match(client, /response\.status === 401/);
  assert.equal((script.match(/authenticatedFetch\(/g) || []).length, 4);
  assert.match(script, /finally \{\s*solveBtn\.disabled = false;/);
  assert.match(script, /finally \{\s*isFollowUpLoading = false;\s*sendFollowUpBtn\.disabled = false;/);
  assert.match(script, /finally \{\s*isQuizLoading = false;\s*createQuizBtn\.disabled = false;/);
  const solveRoute = server.slice(server.indexOf("app.post('/api/gemini-solve'"), server.indexOf("app.post('/api/tutor/create-quiz'"));
  assert.match(solveRoute, /fallbackApiKey: groqApiKey/);
  assert.match(solveRoute, /fallbackModel: process\.env\.GROQ_VISION_MODEL \|\| 'qwen\/qwen3\.8-27b'/);
  assert.match(solveRoute, /onProviderAttempt: attempt => recordAiProviderAttempt/);
});

test('AI Board app and endpoints are removed while NeoBoard routes and UI remain', () => {
  const server = read('server.js');
  const dashboard = read('htmls/dashboard.html');
  const tracker = read('services/aiUsageTracker.js');
  assert.equal(fs.existsSync(path.resolve('ai-board/ai-board.html')), false);
  assert.doesNotMatch(server, /\/api\/(?:chat-stream|analyze-board|rephrase-board|board-queue-status|board-session-end|board-heartbeat)/);
  assert.doesNotMatch(server, /AI_FEATURES\.AI_BOARD|boardQuota|boardRateLimit/);
  assert.doesNotMatch(dashboard, /ai-board|AI Board/i);
  assert.doesNotMatch(tracker, /AI_BOARD:/);

  assert.equal(fs.existsSync(path.resolve('NeoBoard/board.html')), true);
  assert.equal(fs.existsSync(path.resolve('NeoBoard/handwriting-recognition.js')), true);
  assert.equal(fs.existsSync(path.resolve('NeoBoard/handwriting-recognition.test.js')), true);
  assert.match(server, /\/api\/blackboard\/recognize-handwriting/);
  assert.match(server, /\/api\/blackboard\/analyze-selection/);
});

test('usage dashboard labels retries and model/provider switches as additional attempts', () => {
  const html = read('htmls/ai-usage.html');
  assert.match(html, /Additional provider attempts/);
  assert.match(html, /Retries and provider\/model switches; not separate requests/);
  assert.doesNotMatch(html, />Fallback attempts</);
});

test('Firestore client rules no longer mention retired sessions and remain default-deny outside matches', () => {
  const rules = read('firestore.rules');
  assert.doesNotMatch(rules, /aiboard_sessions/);
  assert.match(rules, /match \/ai_quotas\/\{uid\}[\s\S]*?allow read, write: if false/);
});

test('dashboard stays listed as a non-indexable personal route', () => {
  assert.match(read('robots.txt'), /Disallow: \/htmls\/ai-usage\.html/);
  assert.match(read('scripts/seo-audit.py'), /"htmls\/ai-usage\.html"/);
});
