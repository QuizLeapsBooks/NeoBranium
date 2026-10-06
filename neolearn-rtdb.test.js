
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
