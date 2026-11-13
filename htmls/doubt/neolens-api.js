export function createAuthenticatedFetch({
    getCurrentUser,
    waitForUser = async () => null,
    fetchImpl = fetch
} = {}) {
    if (typeof getCurrentUser !== 'function' || typeof fetchImpl !== 'function') {
        throw new TypeError('Authenticated fetch requires a current-user accessor and fetch implementation.');
    }

    return async (url, options = {}) => {
        const user = getCurrentUser() || await waitForUser();
        if (!user || typeof user.getIdToken !== 'function') {
            throw Object.assign(new Error('Sign in to use NeoLens.'), { code: 'AUTH_REQUIRED' });
        }

        const send = async forceRefresh => {
            const token = await user.getIdToken(forceRefresh);
            if (!token) {
                throw Object.assign(new Error('Your sign-in has expired. Sign in again to use NeoLens.'), {
                    code: 'AUTH_EXPIRED'
                });
            }
            const headers = new Headers(options.headers || {});
            headers.set('Authorization', `Bearer ${token}`);
            return fetchImpl(url, { ...options, headers });
        };

        let response = await send(false);
        if (response.status === 401) response = await send(true);
        return response;
    };
}
