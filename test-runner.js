import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const sourceRtdb = fs.readFileSync('js/neolearn-rtdb.js', 'utf-8');
const modifiedRtdb = sourceRtdb
    .replace(/import \{ app, auth \} from '.\/auth.js';/, 'export const app = {}; export const auth = { currentUser: { uid: "test-user-uid" } };')
    .replace(/from 'https:\/\/www.gstatic.com\/firebasejs\/11.9.1\/firebase-database.js';/, "from '../mock-firebase.js';");

fs.writeFileSync('js/neolearn-rtdb.mocked.js', modifiedRtdb);

const mockFirebase = `
export function getDatabase() { return {}; }
export function ref(db, path) { return { path }; }
export function set(ref, data) {
    if (ref.path.includes('fail')) throw new Error('Permission denied');
    return Promise.resolve();
}
export function remove(ref) { return Promise.resolve(); }
export function push(ref) { return { key: 'push-id', path: ref.path + '/push-id' }; }
let activeCallbacks = {};
export function onValue(ref, cb, errCb) {
    activeCallbacks[ref.path] = cb;
    if (ref.path.includes('post_likes/test-post')) {
        cb({ exists: () => true, val: () => ({ 'test-user-uid': true }) });
    } else if (ref.path.includes('post_comments/test-post')) {
        cb({ exists: () => true, val: () => ({ 'c1': { userId: 'u1', text: 'comment 1', createdAt: 100 } }) });
    } else {
        cb({ exists: () => false, val: () => null });
    }
    return () => { delete activeCallbacks[ref.path]; };
}
export function getActiveCallbacks() { return activeCallbacks; }
export function off(ref) {
    delete activeCallbacks[ref.path];
}
export function get(ref) {
    if (ref.path.includes('post_likes/test-post')) {
        return Promise.resolve({
            exists: () => true,
            val: () => ({ 'test-user-uid': true, 'other-uid': true })
        });
    }
    return Promise.resolve({ exists: () => false, val: () => null });
}
export const serverTimestamp = () => Date.now();
`;
fs.writeFileSync('mock-firebase.js', mockFirebase);

const testContent = `
import assert from 'node:assert/strict';
import test from 'node:test';
import { getActiveCallbacks } from './mock-firebase.js';
import { subscribeToPostLikes, subscribeToPostComments, togglePostLike, addComment, getPostLikeState, getPostComments, cleanupPostListeners, cleanupAllNeoLearnListeners } from './js/neolearn-rtdb.mocked.js';

test('getPostLikeState returns correct state for liked post', async () => {
    const state = await getPostLikeState('test-post');
    assert.equal(state.isLiked, true);
    assert.equal(state.likeCount, 2);
});

test('togglePostLike removes like if already liked', async () => {
    const state = await togglePostLike('test-post');
    assert.equal(state.isLiked, false);
});

test('addComment creates a new comment', async () => {
    const commentId = await addComment('test-post', 'This is a test comment');
    assert.ok(commentId);
});

test('addComment validates empty string', async () => {
    await assert.rejects(addComment('test-post', '   '), /Comment text must not be empty/);
});

test('addComment validates max length', async () => {
    await assert.rejects(addComment('test-post', 'a'.repeat(501)), /Comment must be 500 characters or fewer/);
});

test('addComment validates XSS attempt', async () => {
    await assert.rejects(addComment('test-post', 'test <script>alert(1)</script>'), /Comment contains invalid content/);
});

test('subscribeToPostLikes gets initial state', (t) => {
    return new Promise((resolve) => {
        let cleanup;
        cleanup = subscribeToPostLikes('test-post', (state) => {
            assert.equal(state.isLiked, true);
            assert.equal(state.likeCount, 1);
            if (cleanup) cleanup();
            resolve();
        });
    });
});

test('subscribeToPostComments gets initial state', (t) => {
    return new Promise((resolve) => {
        let cleanup;
        cleanup = subscribeToPostComments('test-post', (comments) => {
            assert.equal(comments.length, 1);
            assert.equal(comments[0].text, 'comment 1');
            if (cleanup) cleanup();
            resolve();
        });
    });
});

test('cleanupPostListeners detaches correctly', () => {
    subscribeToPostLikes('test-post-2', () => {});
    subscribeToPostComments('test-post-2', () => {});
    
    assert.ok(getActiveCallbacks()['neolearn_realtime/post_likes/test-post-2']);
    assert.ok(getActiveCallbacks()['neolearn_realtime/post_comments/test-post-2']);
    
    cleanupPostListeners('test-post-2');
    
    assert.equal(getActiveCallbacks()['neolearn_realtime/post_likes/test-post-2'], undefined);
    assert.equal(getActiveCallbacks()['neolearn_realtime/post_comments/test-post-2'], undefined);
});
`;

fs.writeFileSync('neolearn-rtdb.test.js', testContent);

try {
    execSync('node --test neolearn-rtdb.test.js', { stdio: 'inherit' });
} finally {
    fs.unlinkSync('js/neolearn-rtdb.mocked.js');
    fs.unlinkSync('mock-firebase.js');
}
