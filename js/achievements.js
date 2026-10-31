/**
 * achievements.js
 * Meaningful achievement system for NeoBranium.
 *
 * All achievements are based on VERIFIABLE real activity from:
 *   - mentor_calendar (quiz completions, visit streaks)
 *   - mentor_goals (task completions)
 *   - localStorage bookmarks
 *
 * Achievements are evaluated client-side using already-loaded data.
 * No server writes needed — the badge state is computed on demand.
 *
 * Security: Reads only the signed-in user's own collections (via auth.currentUser).
 */

export const ACHIEVEMENTS = [
  {
    id: "first_quiz",
    icon: "bi-play-circle-fill",
    color: "#6d28d9",
    title: "First Steps",
    description: "Completed your very first quiz.",
    check: ({ quizCount }) => quizCount >= 1
  },
  {
    id: "five_quizzes",
    icon: "bi-patch-check-fill",
    color: "#2563eb",
    title: "Quiz Apprentice",
    description: "Completed 5 quizzes.",
    check: ({ quizCount }) => quizCount >= 5
  },
  {
    id: "twenty_five_quizzes",
    icon: "bi-trophy-fill",
    color: "#d97706",
    title: "Quiz Veteran",
    description: "Completed 25 quizzes.",
    check: ({ quizCount }) => quizCount >= 25
  },
  {
    id: "first_bookmark",
    icon: "bi-bookmark-star-fill",
    color: "#f59e0b",
    title: "Note Taker",
    description: "Saved your first quiz question for revision.",
    check: ({ bookmarkCount }) => bookmarkCount >= 1
  },
  {
    id: "ten_bookmarks",
    icon: "bi-bookmark-heart-fill",
    color: "#ec4899",
    title: "Revision Builder",
    description: "Saved 10 questions for revision.",
    check: ({ bookmarkCount }) => bookmarkCount >= 10
  },
  {
    id: "streak_3",
    icon: "bi-fire",
    color: "#f97316",
    title: "On Fire",
    description: "Maintained a 3-day study streak.",
    check: ({ streak }) => streak >= 3
  },
  {
    id: "streak_7",
    icon: "bi-lightning-charge-fill",
    color: "#eab308",
    title: "Dedicated Learner",
    description: "Maintained a 7-day study streak.",
    check: ({ streak }) => streak >= 7
  },
  {
    id: "streak_30",
    icon: "bi-stars",
    color: "#a855f7",
    title: "Month Strong",
    description: "30-day study streak — exceptional dedication!",
    check: ({ streak }) => streak >= 30
  },
  {
    id: "high_score_80",
    icon: "bi-award-fill",
    color: "#059669",
    title: "High Achiever",
    description: "Scored 80% or above on a quiz.",
    check: ({ bestScore }) => bestScore >= 80
  },
  {
    id: "high_score_100",
    icon: "bi-star-fill",
    color: "#d97706",
    title: "Perfect Score",
    description: "Scored 100% on a quiz!",
    check: ({ bestScore }) => bestScore >= 100
  },
  {
    id: "active_days_10",
    icon: "bi-calendar-check-fill",
    color: "#0891b2",
    title: "Consistent Learner",
    description: "Visited and studied on 10 different days.",
    check: ({ activeDays }) => activeDays >= 10
  },
  {
    id: "active_days_30",
    icon: "bi-calendar4-range",
    color: "#7c3aed",
    title: "Study Habit",
    description: "Visited and studied on 30 different days.",
    check: ({ activeDays }) => activeDays >= 30
  },
  {
    id: "first_task",
    icon: "bi-check2-circle",
    color: "#16a34a",
    title: "Goal Setter",
    description: "Added your first study task.",
    check: ({ taskCount }) => taskCount >= 1
  },
  {
    id: "multi_subject",
    icon: "bi-grid-3x3-gap-fill",
    color: "#0ea5e9",
    title: "Well Rounded",
    description: "Practiced quizzes in 3 or more subjects.",
    check: ({ subjectCount }) => subjectCount >= 3
  }
];

/**
 * Evaluate which achievements have been earned from activity data.
 * @param {Object} stats - Computed from quiz records, bookmarks, streak, etc.
 * @returns {Array} earned - Subset of ACHIEVEMENTS that have been earned
 */
export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.map(achievement => ({
    ...achievement,
    earned: achievement.check(stats)
  }));
}

/**
 * Build the stats object from pre-loaded data.
 */
export function buildAchievementStats({ quizRecords = [], streak = 0, activeDays = 0, taskCount = 0 }) {
  const BOOKMARKS_KEY = "neobranium_quiz_bookmarks";
  let bookmarkCount = 0;
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    bookmarkCount = Array.isArray(list) ? list.length : 0;
  } catch (e) { /* ignore */ }

  let bestScore = 0;
  const subjects = new Set();

  quizRecords.forEach(rec => {
    if (rec.scoreParsed) {
      bestScore = Math.max(bestScore, rec.scoreParsed.pct);
    }
    if (rec.subject) subjects.add(rec.subject);
  });

  return {
    quizCount: quizRecords.length,
    bookmarkCount,
    streak,
    bestScore,
    activeDays,
    taskCount,
    subjectCount: subjects.size
  };
}
