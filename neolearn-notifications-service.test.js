import assert from 'node:assert/strict';
import test from 'node:test';
import { createNotificationReadMarker } from './js/neolearn-notification-read.js';

function parseAndSortNotifications(raw) {
    if (!raw || typeof raw !== 'object') return [];
    const items = Object.entries(raw).map(([key, data]) => ({
        id: key,
        type: data.type || 'like',
        actorUserId: typeof data.actorUserId === 'string' ? data.actorUserId : '',
        postId: typeof data.postId === 'string' ? data.postId : '',
        commentId: typeof data.commentId === 'string' ? data.commentId : null,
        commentPreview: typeof data.commentPreview === 'string' ? data.commentPreview : '',
        createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
        read: Boolean(data.read)
    })).filter((item) => item.actorUserId && item.postId);

    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
}

function calculateUnreadCount(raw) {
    if (!raw || typeof raw !== 'object') return 0;
    let count = 0;
    for (const key of Object.keys(raw)) {
        const item = raw[key];
        if (item && !item.read) count++;
    }
    return count;
}

function formatRelativeTime(timestamp, now = 1700000000000) {
    if (!timestamp || !Number.isFinite(timestamp)) return '';
    const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin} minute${diffMin === 1 ? '' : 's'} ago`;
    }
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(timestamp));
}

test('parseAndSortNotifications orders newest first by actual server timestamp', () => {
    const raw = {
        notif_old: { type: 'like', actorUserId: 'user-1', postId: 'post-1', createdAt: 1000, read: true },
        notif_new: { type: 'comment', actorUserId: 'user-2', postId: 'post-2', createdAt: 5000, read: false },
        notif_mid: { type: 'like', actorUserId: 'user-3', postId: 'post-3', createdAt: 3000, read: false }
    };

    const sorted = parseAndSortNotifications(raw);
    assert.equal(sorted.length, 3);
    assert.equal(sorted[0].id, 'notif_new');
    assert.equal(sorted[1].id, 'notif_mid');
    assert.equal(sorted[2].id, 'notif_old');
    assert.equal(sorted[0].createdAt, 5000);
});

test('parseAndSortNotifications discards corrupted records without actor or postId', () => {
    const raw = {
        valid: { type: 'like', actorUserId: 'user-1', postId: 'post-1', createdAt: 1000 },
        missing_actor: { type: 'like', postId: 'post-2', createdAt: 2000 },
        missing_post: { type: 'comment', actorUserId: 'user-3', createdAt: 3000 }
    };

    const result = parseAndSortNotifications(raw);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, 'valid');
});

test('calculateUnreadCount counts only unread items', () => {
    const raw = {
        n1: { read: false },
        n2: { read: true },
        n3: { read: false },
        n4: { read: false }
    };
    assert.equal(calculateUnreadCount(raw), 3);
    assert.equal(calculateUnreadCount({}), 0);
    assert.equal(calculateUnreadCount(null), 0);
});

test('formatRelativeTime formats correctly according to elapsed duration', () => {
    const now = 1700000000000;
    assert.equal(formatRelativeTime(now - 30 * 1000, now), 'Just now');
    assert.equal(formatRelativeTime(now - 5 * 60 * 1000, now), '5 minutes ago');
    assert.equal(formatRelativeTime(now - 1 * 60 * 1000, now), '1 minute ago');
    assert.equal(formatRelativeTime(now - 2 * 3600 * 1000, now), '2 hours ago');
    assert.equal(formatRelativeTime(now - 3 * 86400 * 1000, now), '3 days ago');
});

test('notification read uses RTDB as the primary write', async () => {
    const calls = [];
    const markRead = createNotificationReadMarker({
        async writeReadState(userId, notificationId) { calls.push(['rtdb', userId, notificationId]); },
        async markReadOnServer() { calls.push(['api']); }
    });

    await markRead('user-1', 'notification-1');

    assert.deepEqual(calls, [['rtdb', 'user-1', 'notification-1']]);
});

test('notification read falls back to the API when the RTDB write fails', async () => {
    const calls = [];
    const markRead = createNotificationReadMarker({
        async writeReadState() { calls.push('rtdb'); throw new Error('permission denied'); },
        async markReadOnServer(userId, notificationId) { calls.push(['api', userId, notificationId]); }
    });

    await markRead('user-1', 'notification-1');

    assert.deepEqual(calls, ['rtdb', ['api', 'user-1', 'notification-1']]);
});

test('notification read reports failure when RTDB and API writes both fail', async () => {
    const markRead = createNotificationReadMarker({
        async writeReadState() { throw new Error('permission denied'); },
        async markReadOnServer() { throw new Error('service unavailable'); }
    });

    await assert.rejects(markRead('user-1', 'notification-1'), /could not be marked as read/i);
});
