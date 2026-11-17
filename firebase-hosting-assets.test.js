import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

test('Firebase Hosting publishes browser utility modules required by auth startup', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const ignored = config.hosting.ignore;

  // `js/auth.js` imports profile-photo-cache, which imports these browser
  // modules before Firebase auth can initialize. They must never match a
  // blanket **/utils/** deployment exclusion.
  assert.ok(!ignored.includes('**/utils/**'));
  assert.ok(ignored.includes('utils/**'), 'server-only root utilities stay excluded');

  for (const file of [
    'js/profile-photo-cache.js',
    'js/utils/boundedObjectUrlCache.js',
    'js/utils/readBlobWithLimit.js'
  ]) {
    await stat(resolve(file));
  }
});

test('NB-SEC-06: sensitive infra / config files are excluded from Firebase Hosting', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const ignored = new Set(config.hosting.ignore);

  // These files must NEVER be deployed to public hosting
  const mustBeIgnored = [
    // Database / index config
    'database.rules.json',
    'firestore.indexes.json',
    'firebase.rtdb-emulator.json',
    // Backend handler scripts
    'ai-conversation-handler.js',
    'ai-upload-handler.js',
    'neolearn-social-data.js',
    'neolearn-social-handler.js',
    // Patch / diagnostic scripts
    'dump_msgs.js',
    'index.js',
    'patch_messages.js',
    'patch_settings.js',
    'fix_social.js',
    'fix_social.cjs',
    // Internal HTML
    'architecture-map.html',
    // Test / data files
    'pages.txt',
    'sample-prompt.txt',
    'transcript_outputs.txt',
    'security.test.js',
    'leaderboard.test.js',
    'paper-generator.test.js',
    'tests/**',
  ];

  for (const file of mustBeIgnored) {
    assert.ok(ignored.has(file), `"${file}" must be in firebase.json hosting.ignore`);
  }
});

test('NB-SEC-06: global security headers are present in Firebase Hosting config', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const headers = config.hosting.headers;

  // Find the catch-all /** header entry
  const globalEntry = headers.find((h) => h.source === '**');
  assert.ok(globalEntry, 'Missing global "**" header entry in firebase.json hosting.headers');

  const headerKeys = new Set(globalEntry.headers.map((h) => h.key));
  for (const required of [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy',
    'Strict-Transport-Security',
  ]) {
    assert.ok(headerKeys.has(required), `Missing global security header: ${required}`);
  }

  const hsts = globalEntry.headers.find((h) => h.key === 'Strict-Transport-Security');
  assert.ok(hsts.value.includes('max-age='), 'HSTS must include max-age');
  assert.ok(hsts.value.includes('includeSubDomains'), 'HSTS must include includeSubDomains');
});

test('NB-SEC-06: public frontend files are NOT excluded from Firebase Hosting', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const ignored = new Set(config.hosting.ignore);

  // These files must remain publicly accessible
  const mustNotBeIgnored = [
    'manifest.json',
    'ads.txt',
    'robots.txt',
    'sw.js',
  ];

  for (const file of mustNotBeIgnored) {
    assert.ok(!ignored.has(file), `"${file}" must NOT be in firebase.json hosting.ignore`);
  }
});

test('NB-SEC-06: deployment artifact inspection confirms complete absence of dotfiles, git, server scripts and private rules', async () => {
  const { listFiles } = await import('/usr/lib/node_modules/firebase-tools/lib/listFiles.js');
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  const deployedFiles = listFiles('.', config.hosting.ignore);

  // 1. Absolutely zero git files
  const gitFiles = deployedFiles.filter((f) => f.includes('.git'));
  assert.equal(gitFiles.length, 0, `Git files leaked in deploy: ${gitFiles.join(', ')}`);

  // 2. Absolutely zero hidden dotfiles or dotdirectories
  const dotFiles = deployedFiles.filter((f) => f.startsWith('.') || f.includes('/.'));
  assert.equal(dotFiles.length, 0, `Dotfiles leaked in deploy: ${dotFiles.join(', ')}`);

  // 3. Sensitive backend scripts & rules are excluded
  const forbiddenFiles = [
    'server.js',
    'firebaseAdmin.js',
    'database.rules.json',
    'firestore.indexes.json',
    'ai-conversation-handler.js',
    'dump_msgs.js',
    'package.json',
    'package-lock.json',
  ];
  for (const forbidden of forbiddenFiles) {
    assert.equal(deployedFiles.includes(forbidden), false, `"${forbidden}" must be excluded from deploy artifact`);
  }

  // 4. Critical frontend files are actually included
  const requiredFiles = [
    'index.html',
    'manifest.json',
    'sw.js',
    'robots.txt',
    'ads.txt',
    'js/profile-photo-cache.js',
  ];
  for (const req of requiredFiles) {
    assert.equal(deployedFiles.includes(req), true, `"${req}" must be present in deploy artifact`);
  }
});
