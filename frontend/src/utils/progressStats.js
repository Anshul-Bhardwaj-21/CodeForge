/**
 * Pure stat-computation functions for the local progress tracker.
 * No side effects — all functions take data and return derived values.
 */

/**
 * Compute summary counts from a Progress_Store.
 * @param {Object} progressData - Full Progress_Store: { lastUpdated, problems: { [id]: Problem_Progress } }
 * @returns {{ solved: number, attempted: number, totalSubmissions: number }}
 */
export function computeSummary(progressData) {
  const problems = Object.values(progressData?.problems ?? {});
  let solved = 0;
  let attempted = 0;
  let totalSubmissions = 0;

  for (const p of problems) {
    if (p.status === 'solved') solved++;
    else if (p.status === 'attempted') attempted++;
    totalSubmissions += (p.submissions ?? []).length;
  }

  return { solved, attempted, totalSubmissions };
}

/**
 * Format a Date object as a YYYY-MM-DD string (local date).
 * @param {Date} date
 * @returns {string}
 */
function toDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Add `days` calendar days to a Date, returning a new Date.
 * @param {Date} date
 * @param {number} days
 * @returns {Date}
 */
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Derive the sorted unique set of YYYY-MM-DD solve dates from accepted submissions.
 * @param {Object} progressData
 * @returns {string[]} sorted ascending
 */
function getSolveDates(progressData) {
  const dateSet = new Set();
  for (const p of Object.values(progressData?.problems ?? {})) {
    for (const sub of p.submissions ?? []) {
      if (sub.verdict === 'accepted' && sub.submittedAt) {
        dateSet.add(toDateStr(new Date(sub.submittedAt)));
      }
    }
  }
  return Array.from(dateSet).sort();
}

/**
 * Compute current and longest streaks.
 * @param {Object} progressData
 * @param {Date} [today] - defaults to new Date()
 * @returns {{ current: number, longest: number }}
 */
export function computeStreaks(progressData, today = new Date()) {
  const solveDates = getSolveDates(progressData);
  if (solveDates.length === 0) return { current: 0, longest: 0 };

  const solveSet = new Set(solveDates);

  // --- longest streak ---
  let longest = 1;
  let run = 1;
  for (let i = 1; i < solveDates.length; i++) {
    const prev = new Date(solveDates[i - 1]);
    const curr = new Date(solveDates[i]);
    const diffMs = curr - prev;
    const diffDays = Math.round(diffMs / 86400000);
    if (diffDays === 1) {
      run++;
      if (run > longest) longest = run;
    } else {
      run = 1;
    }
  }

  // --- current streak ---
  const todayStr = toDateStr(today);
  const yesterdayStr = toDateStr(addDays(today, -1));

  // Start from today if there's a solve today, otherwise from yesterday
  let cursor;
  if (solveSet.has(todayStr)) {
    cursor = today;
  } else if (solveSet.has(yesterdayStr)) {
    cursor = addDays(today, -1);
  } else {
    return { current: 0, longest };
  }

  let current = 0;
  while (solveSet.has(toDateStr(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  return { current, longest };
}

/**
 * Build a heatmap of accepted submission counts for the 52-week window ending on today.
 * @param {Object} progressData
 * @param {Date} today
 * @returns {Map<string, number>} exactly 364 entries
 */
export function buildHeatmapData(progressData, today) {
  // Build a count map from accepted submissions
  const counts = new Map();
  for (const p of Object.values(progressData?.problems ?? {})) {
    for (const sub of p.submissions ?? []) {
      if (sub.verdict === 'accepted' && sub.submittedAt) {
        const dateStr = toDateStr(new Date(sub.submittedAt));
        counts.set(dateStr, (counts.get(dateStr) ?? 0) + 1);
      }
    }
  }

  // Build the 364-entry map: day 363 days ago through today (inclusive = 364 days)
  const result = new Map();
  for (let i = 363; i >= 0; i--) {
    const dateStr = toDateStr(addDays(today, -i));
    result.set(dateStr, counts.get(dateStr) ?? 0);
  }

  return result;
}

/**
 * Map a daily accepted-submission count to an intensity level 0–4.
 * @param {number} count
 * @returns {0|1|2|3|4}
 */
export function getHeatmapIntensity(count) {
  if (count === 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

/**
 * Compute per-topic solved/total breakdown.
 * A problem with multiple tags contributes independently to each tag.
 * @param {Object} progressData
 * @param {Array<{ id: string, tags: string[] }>} problems
 * @returns {Array<{ topic: string, solved: number, total: number }>}
 */
export function computeTopicBreakdown(progressData, problems) {
  const totals = new Map();
  const solved = new Map();

  for (const problem of problems ?? []) {
    const status = progressData?.problems?.[problem.id]?.status ?? 'unseen';
    const uniqueTags = [...new Set(problem.tags ?? [])];
    for (const tag of uniqueTags) {
      totals.set(tag, (totals.get(tag) ?? 0) + 1);
      if (status === 'solved') {
        solved.set(tag, (solved.get(tag) ?? 0) + 1);
      }
    }
  }

  return Array.from(totals.keys()).map((topic) => ({
    topic,
    solved: solved.get(topic) ?? 0,
    total: totals.get(topic),
  }));
}

/**
 * Compute per-difficulty solved/total breakdown.
 * @param {Object} progressData
 * @param {Array<{ id: string, difficulty: string }>} problems
 * @returns {Array<{ difficulty: string, solved: number, total: number }>}
 */
export function computeDifficultyBreakdown(progressData, problems) {
  const difficulties = ['Easy', 'Medium', 'Hard'];
  const totals = { Easy: 0, Medium: 0, Hard: 0 };
  const solved = { Easy: 0, Medium: 0, Hard: 0 };

  for (const problem of problems ?? []) {
    const diff = problem.difficulty;
    if (!difficulties.includes(diff)) continue;
    totals[diff]++;
    const status = progressData?.problems?.[problem.id]?.status ?? 'unseen';
    if (status === 'solved') solved[diff]++;
  }

  return difficulties.map((difficulty) => ({
    difficulty,
    solved: solved[difficulty],
    total: totals[difficulty],
  }));
}

/**
 * Get the most recent n submissions, enriched with problem title.
 * @param {Object} progressData
 * @param {Array<{ id: string, title: string }>} problems
 * @param {number} n
 * @returns {Array<{ submittedAt: string, language: string, verdict: string, timeTaken: number|null, problemId: string, problemTitle: string }>}
 */
export function getRecentSubmissions(progressData, problems, n) {
  const titleMap = new Map((problems ?? []).map((p) => [p.id, p.title]));

  const all = [];
  for (const [problemId, progress] of Object.entries(progressData?.problems ?? {})) {
    for (const sub of progress.submissions ?? []) {
      all.push({ ...sub, problemId, problemTitle: titleMap.get(problemId) ?? problemId });
    }
  }

  all.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  return all.slice(0, n);
}
