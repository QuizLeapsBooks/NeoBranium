export function getDatabase() { return {}; }
export function ref(db, path) { return { path }; }
export function set(ref, data) {
    if (ref.path.includes('fail')) throw new Error('Permission denied');
    return Promise.resolve();
}
export function remove(ref) { return Promise.resolve(); }
export function push(ref) { return { key: 'push-id', path: ref.path + '/push-id' }; }
let activeCallbacks = {};
let activeErrors = {};
export function onValue(ref, cb, errCb) {
    activeCallbacks[ref.path] = cb;
    activeErrors[ref.path] = errCb;
    if (ref.path.includes('post_likes/test-post')) {
        cb({ exists: () => true, val: () => ({ 'test-user-uid': true }) });
    } else if (ref.path.includes('post_comments/test-post')) {
        cb({ exists: () => true, val: () => ({ 'c1': { userId: 'u1', text: 'comment 1', createdAt: 100 } }) });
    } else {
        cb({ exists: () => false, val: () => null });
    }
    return () => { delete activeCallbacks[ref.path]; delete activeErrors[ref.path]; };
}
export function getActiveCallbacks() { return activeCallbacks; }
export function triggerListenerError(path, error = new Error('Permission denied')) { activeErrors[path]?.(error); }
export function off(ref) {
    delete activeCallbacks[ref.path];
    delete activeErrors[ref.path];
}
export function get(ref) {
    if (ref.path.endsWith('/test-user-uid')) {
        return Promise.resolve({ exists: () => true, val: () => true });
    }
    if (ref.path.includes('post_likes/test-post')) {
        return Promise.resolve({
            exists: () => true,
            val: () => ({ 'test-user-uid': true, 'other-uid': true })
        });
    }
    return Promise.resolve({ exists: () => false, val: () => null });
}
export async function runTransaction(ref, update) {
    const before = await get(ref);
    const current = before.val();
    const next = update(current);
    const snapshot = {
        exists: () => next !== null && next !== undefined,
        val: () => next
    };
    return { committed: true, snapshot };
}
export const serverTimestamp = () => Date.now();
