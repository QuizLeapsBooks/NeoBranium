export function learningRelationshipId(learnerUserId, targetUserId) {
    const encodeUid = (uid) => Buffer.from(uid, 'utf8').toString('base64url');
    return `${encodeUid(learnerUserId)}.${encodeUid(targetUserId)}`;
}

export function safeSocialCount(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

export async function getNeoLearnBlockedUserIds(db, userId) {
    const blocks = db.collection('neolearn_blocks');
    const [blockingSnapshot, blockedBySnapshot] = await Promise.all([
        blocks.where('blockerId', '==', userId).get(),
        blocks.where('blockedUserId', '==', userId).get()
    ]);
    return new Set([
        ...blockingSnapshot.docs.map((block) => block.data()?.blockedUserId),
        ...blockedBySnapshot.docs.map((block) => block.data()?.blockerId)
    ].filter((blockedUserId) => typeof blockedUserId === 'string'));
}