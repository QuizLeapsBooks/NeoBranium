import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('./', import.meta.url);

test('profile, dashboard, and AI Usage expose the shared budget summary', async () => {
  for (const path of ['htmls/profile.html', 'htmls/dashboard.html', 'htmls/ai-usage.html']) {
    const html = await readFile(new URL(path, root), 'utf8');
    assert.match(html, /data-ai-quota-overview/);
    assert.match(html, /Shared AI usage budget/);
  }
});

test('shared warning UI includes the low-budget threshold, close control, and timed dismissal', async () => {
  const auth = await readFile(new URL('js/auth.js', root), 'utf8');
  assert.match(auth, /remaining\s*\/\s*limit\s*>\s*0\.25/);
  assert.match(auth, /Dismiss AI usage warning/);
  assert.match(auth, /setTimeout\(\(\)\s*=>\s*alert\.remove\(\),\s*7_000\)/);
});

test('NeoBot checks low quota for signed-in accounts and guest allowances', async () => {
  const html = await readFile(new URL('NeoBot/index.html', root), 'utf8');
  assert.match(html, /checkSignedInQuotaWarning\(user\)/);
  assert.match(html, /weeklyNeoBot/);
  assert.match(html, /dailyChat/);
  assert.match(html, /weeklyOtherAi/);
  assert.match(html, /aiQuotaWarningDismissed/);
});
