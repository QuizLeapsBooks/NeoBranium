export function getQuizContextDateRange(now = new Date()) {
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const start = new Date(end);
    start.setUTCDate(start.getUTCDate() - 29);
    return {
        from: start.toISOString().slice(0, 10),
        to: end.toISOString().slice(0, 10)
    };
}
