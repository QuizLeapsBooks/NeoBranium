import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const serviceWorkerSource = await readFile(new URL('./sw.js', import.meta.url), 'utf8');

function createServiceWorkerContext() {
  const listeners = new Map();
  const deletedCaches = [];
  let skipWaitingCalled = false;
  let claimCalled = false;
  let unregisterCalled = false;
  const context = {
    self: {
      addEventListener(type, listener) {
        listeners.set(type, listener);
      },
      skipWaiting() {
        skipWaitingCalled = true;
        return Promise.resolve();
      },
      clients: {
        claim() {
          claimCalled = true;
          return Promise.resolve();
        }
      },
      registration: {
        unregister() {
          unregisterCalled = true;
          return Promise.resolve(true);
        }
      }
    },
    caches: {
      delete(cacheName) {
        deletedCaches.push(cacheName);
        return Promise.resolve(true);
      }
    }
  };

  runInNewContext(serviceWorkerSource, context);
  return {
    listeners,
    deletedCaches,
    wasSkipWaitingCalled: () => skipWaitingCalled,
    wasClaimCalled: () => claimCalled,
    wasUnregisterCalled: () => unregisterCalled
  };
}

test('retired service worker does not intercept requests', () => {
  const worker = createServiceWorkerContext();

  assert.equal(worker.listeners.has('fetch'), false);
  assert.equal(worker.listeners.has('install'), true);
  assert.equal(worker.listeners.has('activate'), true);
});

test('activation removes its stale cache, claims clients, and unregisters', async () => {
  const worker = createServiceWorkerContext();
  let activation;

  worker.listeners.get('install')({ waitUntil(promise) { activation = promise; } });
  await activation;
  assert.equal(worker.wasSkipWaitingCalled(), true);

  worker.listeners.get('activate')({ waitUntil(promise) { activation = promise; } });
  await activation;

  assert.deepEqual(worker.deletedCaches, ['neobranium-v1']);
  assert.equal(worker.wasClaimCalled(), true);
  assert.equal(worker.wasUnregisterCalled(), true);
});
