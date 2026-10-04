import assert from 'node:assert/strict';
import test from 'node:test';
import { filterPostsBelowViewLimit, MAX_POST_VIEWS, recordPostView } from './js/neolearn-feed-history.js';

test('a post remains eligible until its third qualified view', () => {
    let viewCounts = {};
    const posts = [{ postId: 'post-a' }, { postId: 'post-b' }];

    for (let view = 1; view < MAX_POST_VIEWS; view++) {
        viewCounts = recordPostView(viewCounts, 'post-a');
        assert.deepEqual(filterPostsBelowViewLimit(posts, viewCounts).map((post) => post.postId), ['post-a', 'post-b']);
    }

    viewCounts = recordPostView(viewCounts, 'post-a');
    assert.deepEqual(filterPostsBelowViewLimit(posts, viewCounts).map((post) => post.postId), ['post-b']);
});

test('view counts are capped and invalid post IDs do not mutate history', () => {
    const viewCounts = { 'post-a': MAX_POST_VIEWS };

    assert.equal(recordPostView(viewCounts, 'post-a')['post-a'], MAX_POST_VIEWS);
    assert.equal(recordPostView(viewCounts, '') , viewCounts);
});