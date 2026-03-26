import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  computeSummary,
  buildHeatmapData,
  getHeatmapIntensity,
  computeTopicBreakdown,
  computeDifficultyBreakdown,
  computeStreaks,
  getRecentSubmissions,
} from './progressStats';

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const verdictArb = fc.constantFrom('accepted', 'wrong_answer', 'runtime_error', 'time_limit_exceeded');
const languageArb = fc.constantFrom('javascript', 'python', 'cpp', 'java');
const statusArb = fc.constantFrom('solved', 'attempted', 'unseen');

// Safe date arbitrary: integer offset from a fixed epoch avoids NaN dates
const epochMs = new Date('2020-01-01T12:00:00.000Z').getTime();
const msPerDay = 86400000;
const safeDateArb = fc.integer({ min: 0, max: 3650 }).map((n) => new Date(epochMs + n * msPerDay));

/** Generate a single Submission_Record with an ISO submittedAt string. */
const submissionArb = () =>
  fc.record({
    submittedAt: safeDateArb.map((d) => d.toISOString()),
    language: languageArb,
    verdict: verdictArb,
    timeTaken: fc.option(fc.integer({ min: 1, max: 10000 }), { nil: null }),
  });

/** Generate a Problem_Progress entry. */
const problemProgressArb = fc.record({
  status: statusArb,
  submissions: fc.array(submissionArb(), { minLength: 0, maxLength: 10 }),
});

/** Generate a full Progress_Store with 0–10 problems. */
const progressDataArb = fc
  .array(fc.tuple(fc.uuid(), problemProgressArb), { minLength: 0, maxLength: 10 })
  .map((entries) => ({ problems: Object.fromEntries(entries) }));

// ---------------------------------------------------------------------------
// Property 5: Summary computation correctness
// ---------------------------------------------------------------------------

describe('Property 5: Summary computation correctness', () => {
  it('computeSummary counts match manual counts', () => {
    // Feature: local-progress-tracker, Property 5: Summary computation correctness
    fc.assert(
      fc.property(progressDataArb, (progressData) => {
        const problems = Object.values(progressData.problems);

        const expectedSolved = problems.filter((p) => p.status === 'solved').length;
        const expectedAttempted = problems.filter((p) => p.status === 'attempted').length;
        const expectedTotalSubmissions = problems.reduce((sum, p) => sum + p.submissions.length, 0);

        const result = computeSummary(progressData);

        expect(result.solved).toBe(expectedSolved);
        expect(result.attempted).toBe(expectedAttempted);
        expect(result.totalSubmissions).toBe(expectedTotalSubmissions);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Heatmap size invariant
// ---------------------------------------------------------------------------

describe('Property 6: Heatmap size invariant', () => {
  it('buildHeatmapData always returns exactly 364 entries', () => {
    // Feature: local-progress-tracker, Property 6: Heatmap size invariant
    fc.assert(
      fc.property(progressDataArb, safeDateArb, (progressData, today) => {
        const result = buildHeatmapData(progressData, today);
        expect(result.size).toBe(364);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Heatmap count correctness
// ---------------------------------------------------------------------------

describe('Property 7: Heatmap count correctness', () => {
  it('heatmap count for each date matches accepted submissions on that date', () => {
    // Feature: local-progress-tracker, Property 7: Heatmap count correctness
    fc.assert(
      fc.property(
        safeDateArb,
        fc.array(
          fc.record({
            // Generate dates within the 52-week window (0–363 days before today)
            daysAgo: fc.integer({ min: 0, max: 363 }),
            verdict: verdictArb,
          }),
          { minLength: 0, maxLength: 20 }
        ),
        (today, submissions) => {
          // Build progressData from the generated submissions
          const subRecords = submissions.map(({ daysAgo, verdict }) => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            // Use noon UTC to avoid timezone edge cases
            d.setUTCHours(12, 0, 0, 0);
            return { submittedAt: d.toISOString(), language: 'javascript', verdict, timeTaken: null };
          });

          const progressData = {
            problems: {
              'test-problem': { status: 'solved', submissions: subRecords },
            },
          };

          const heatmap = buildHeatmapData(progressData, today);

          // For each date in the heatmap, verify the count
          for (const [dateStr, count] of heatmap.entries()) {
            const expectedCount = subRecords.filter((s) => {
              const d = new Date(s.submittedAt);
              const y = d.getFullYear();
              const m = String(d.getMonth() + 1).padStart(2, '0');
              const day = String(d.getDate()).padStart(2, '0');
              return `${y}-${m}-${day}` === dateStr && s.verdict === 'accepted';
            }).length;
            expect(count).toBe(expectedCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 8: Heatmap intensity mapping
// ---------------------------------------------------------------------------

describe('Property 8: Heatmap intensity mapping', () => {
  it('getHeatmapIntensity returns correct bucket for any non-negative integer', () => {
    // Feature: local-progress-tracker, Property 8: Heatmap intensity mapping
    fc.assert(
      fc.property(fc.nat({ max: 1000 }), (count) => {
        const intensity = getHeatmapIntensity(count);
        if (count === 0) expect(intensity).toBe(0);
        else if (count === 1) expect(intensity).toBe(1);
        else if (count <= 3) expect(intensity).toBe(2);
        else if (count <= 6) expect(intensity).toBe(3);
        else expect(intensity).toBe(4);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Topic breakdown correctness including multi-tag problems
// ---------------------------------------------------------------------------

const tagArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0);

const problemWithTagsArb = fc.record({
  id: fc.uuid(),
  tags: fc.array(tagArb, { minLength: 0, maxLength: 4 }),
  difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
});

describe('Property 9: Topic breakdown correctness including multi-tag problems', () => {
  it('computeTopicBreakdown totals and solved counts are correct for all tags', () => {
    // Feature: local-progress-tracker, Property 9: Topic breakdown correctness including multi-tag problems
    fc.assert(
      fc.property(
        fc.array(problemWithTagsArb, { minLength: 0, maxLength: 15 }),
        (problems) => {
          // Build progressData: assign random statuses
          const progressProblems = {};
          for (const p of problems) {
            // Use a deterministic but varied status based on id hash
            const statuses = ['solved', 'attempted', 'unseen'];
            const status = statuses[p.id.charCodeAt(0) % 3];
            progressProblems[p.id] = { status, submissions: [] };
          }
          const progressData = { problems: progressProblems };

          const result = computeTopicBreakdown(progressData, problems);

          // Collect all unique tags
          const allTags = new Set(problems.flatMap((p) => p.tags));

          // Every unique tag must appear in the result
          for (const tag of allTags) {
            const entry = result.find((r) => r.topic === tag);
            expect(entry).toBeDefined();

            // total = count of problems with this tag
            const expectedTotal = problems.filter((p) => p.tags.includes(tag)).length;
            expect(entry.total).toBe(expectedTotal);

            // solved = count of solved problems with this tag
            const expectedSolved = problems.filter(
              (p) => p.tags.includes(tag) && progressProblems[p.id]?.status === 'solved'
            ).length;
            expect(entry.solved).toBe(expectedSolved);
          }

          // A problem with N tags contributes to all N topic entries
          for (const p of problems) {
            for (const tag of p.tags) {
              const entry = result.find((r) => r.topic === tag);
              expect(entry).toBeDefined();
              expect(entry.total).toBeGreaterThanOrEqual(1);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Difficulty breakdown correctness
// ---------------------------------------------------------------------------

const problemWithDifficultyArb = fc.record({
  id: fc.uuid(),
  difficulty: fc.constantFrom('Easy', 'Medium', 'Hard'),
  tags: fc.constant([]),
});

describe('Property 10: Difficulty breakdown correctness', () => {
  it('computeDifficultyBreakdown totals and solved counts are correct', () => {
    // Feature: local-progress-tracker, Property 10: Difficulty breakdown correctness
    fc.assert(
      fc.property(
        fc.array(problemWithDifficultyArb, { minLength: 0, maxLength: 20 }),
        (problems) => {
          const progressProblems = {};
          for (const p of problems) {
            const statuses = ['solved', 'attempted', 'unseen'];
            const status = statuses[p.id.charCodeAt(0) % 3];
            progressProblems[p.id] = { status, submissions: [] };
          }
          const progressData = { problems: progressProblems };

          const result = computeDifficultyBreakdown(progressData, problems);

          // Must have entries for Easy, Medium, Hard
          const difficulties = ['Easy', 'Medium', 'Hard'];
          expect(result.map((r) => r.difficulty)).toEqual(difficulties);

          for (const diff of difficulties) {
            const entry = result.find((r) => r.difficulty === diff);
            expect(entry).toBeDefined();

            const expectedTotal = problems.filter((p) => p.difficulty === diff).length;
            expect(entry.total).toBe(expectedTotal);

            const expectedSolved = problems.filter(
              (p) => p.difficulty === diff && progressProblems[p.id]?.status === 'solved'
            ).length;
            expect(entry.solved).toBe(expectedSolved);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 11: Current streak correctness
// ---------------------------------------------------------------------------

describe('Property 11: Current streak correctness', () => {
  it('current streak equals consecutive-day run ending on today or yesterday', () => {
    // Feature: local-progress-tracker, Property 11: Current streak correctness
    fc.assert(
      fc.property(
        safeDateArb,
        fc.array(fc.integer({ min: 0, max: 60 }), { minLength: 0, maxLength: 30 }),
        (today, daysAgoList) => {
          // Build accepted submissions on specific days-ago offsets
          const submissions = daysAgoList.map((daysAgo) => {
            const d = new Date(today);
            d.setDate(d.getDate() - daysAgo);
            d.setUTCHours(12, 0, 0, 0);
            return { submittedAt: d.toISOString(), language: 'javascript', verdict: 'accepted', timeTaken: null };
          });

          const progressData = {
            problems: { 'p1': { status: 'solved', submissions } },
          };

          const { current } = computeStreaks(progressData, today);

          // Manually compute expected current streak
          const toDateStr = (d) => {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
          };
          const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };

          const solveSet = new Set(
            submissions
              .filter((s) => s.verdict === 'accepted')
              .map((s) => toDateStr(new Date(s.submittedAt)))
          );

          const todayStr = toDateStr(today);
          const yesterdayStr = toDateStr(addDays(today, -1));

          let expectedCurrent = 0;
          let cursor;
          if (solveSet.has(todayStr)) {
            cursor = today;
          } else if (solveSet.has(yesterdayStr)) {
            cursor = addDays(today, -1);
          } else {
            cursor = null;
          }

          if (cursor) {
            while (solveSet.has(toDateStr(cursor))) {
              expectedCurrent++;
              cursor = addDays(cursor, -1);
            }
          }

          expect(current).toBe(expectedCurrent);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 12: Longest streak >= current streak
// ---------------------------------------------------------------------------

describe('Property 12: Longest streak is at least as large as current streak', () => {
  it('longest >= current for any progressData', () => {
    // Feature: local-progress-tracker, Property 12: Longest streak is at least as large as current streak
    fc.assert(
      fc.property(progressDataArb, (progressData) => {
        const { current, longest } = computeStreaks(progressData);
        expect(longest).toBeGreaterThanOrEqual(current);
      }),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 13: Recent submissions ordering and cap
// ---------------------------------------------------------------------------

describe('Property 13: Recent submissions ordering and cap', () => {
  it('getRecentSubmissions returns <= 10 results, ordered descending, with correct titles', () => {
    // Feature: local-progress-tracker, Property 13: Recent submissions ordering and cap
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            id: fc.uuid(),
            title: fc.string({ minLength: 1, maxLength: 20 }),
          }),
          { minLength: 0, maxLength: 10 }
        ),
        fc.array(
          fc.record({
            problemIndex: fc.nat({ max: 9 }),
            // Use integer offset from a fixed epoch to avoid invalid Date edge cases
            daysOffset: fc.integer({ min: 0, max: 3650 }),
            verdict: verdictArb,
            language: languageArb,
            timeTaken: fc.option(fc.integer({ min: 1, max: 5000 }), { nil: null }),
          }),
          { minLength: 0, maxLength: 30 }
        ),
        (problems, rawSubmissions) => {
          if (problems.length === 0) {
            const result = getRecentSubmissions({ problems: {} }, [], 10);
            expect(result.length).toBe(0);
            return;
          }

          // Build progressData mapping submissions to actual problem ids
          const progressProblems = {};
          for (const sub of rawSubmissions) {
            const problem = problems[sub.problemIndex % problems.length];
            const submittedAt = new Date(epochMs + sub.daysOffset * msPerDay).toISOString();
            if (!progressProblems[problem.id]) {
              progressProblems[problem.id] = { status: 'attempted', submissions: [] };
            }
            progressProblems[problem.id].submissions.push({
              submittedAt,
              verdict: sub.verdict,
              language: sub.language,
              timeTaken: sub.timeTaken,
            });
          }

          const progressData = { problems: progressProblems };
          const result = getRecentSubmissions(progressData, problems, 10);

          // Cap: at most 10
          expect(result.length).toBeLessThanOrEqual(10);

          // Ordering: descending by submittedAt
          for (let i = 1; i < result.length; i++) {
            expect(new Date(result[i - 1].submittedAt).getTime()).toBeGreaterThanOrEqual(
              new Date(result[i].submittedAt).getTime()
            );
          }

          // Enrichment: each result has the correct problemTitle
          const titleMap = new Map(problems.map((p) => [p.id, p.title]));
          for (const sub of result) {
            const expectedTitle = titleMap.get(sub.problemId) ?? sub.problemId;
            expect(sub.problemTitle).toBe(expectedTitle);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
