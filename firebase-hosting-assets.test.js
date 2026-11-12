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
