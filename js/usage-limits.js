const DAILY_LIMIT = 10;
const PAPER_COUNT_KEY = 'neobranium_paper_count';
const CHAT_COUNT_KEY = 'neobranium_chat_count';

function getCount(key) {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || '{}');
    const today = new Date().toISOString().slice(0, 10);
    return stored.date === today ? Number(stored.count) || 0 : 0;
  } catch {
    return 0;
  }
}

function incrementCount(key) {
  const today = new Date().toISOString().slice(0, 10);
  localStorage.setItem(key, JSON.stringify({ date: today, count: getCount(key) + 1 }));
}

export function canGeneratePaper() {
  if (getCount(PAPER_COUNT_KEY) < DAILY_LIMIT) return true;
  window.alert('Daily question paper generation limit reached. Please try again tomorrow.');
  return false;
}

export function incrementPaperCount() {
  incrementCount(PAPER_COUNT_KEY);
}

export function canSendMessage() {
  if (getCount(CHAT_COUNT_KEY) < DAILY_LIMIT) return true;
  window.alert('Daily chat limit reached. Please try again tomorrow.');
  return false;
}

export function incrementChatCount() {
  incrementCount(CHAT_COUNT_KEY);
}
