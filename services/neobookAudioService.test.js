import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import test from 'node:test';
import { uploadAudio } from './neobookAudioService.js';

test('audio upload destroys an in-flight Cloudinary stream on cancellation', async () => {
  const controller = new AbortController();
  const stream = new EventEmitter();
  stream.end = () => {};
  let destroyedWith;
  stream.destroy = error => { destroyedWith = error; };

  const pending = uploadAudio(Buffer.from('audio'), 'episode/segment', controller.signal, () => stream);
  const cancellation = Object.assign(new Error('client disconnected'), { code: 'REQUEST_ABORTED' });
  controller.abort(cancellation);

  await assert.rejects(pending, error => error === cancellation);
  assert.equal(destroyedWith, cancellation);
});

test('audio upload removes its abort listener once Cloudinary completes', async () => {
  const controller = new AbortController();
  const stream = { end: () => {}, destroy: () => assert.fail('should not destroy a completed upload') };
  const result = await uploadAudio(Buffer.from('audio'), 'episode/segment', controller.signal, (_options, done) => {
    queueMicrotask(() => done(null, { public_id: 'episode/segment' }));
    return stream;
  });

  assert.equal(result.public_id, 'episode/segment');
  controller.abort(new Error('late cancellation'));
});
