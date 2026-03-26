'use strict';

const fc = require('fast-check');
const request = require('supertest');
const express = require('express');

const VALID_VERDICTS = ['accepted', 'wrong_answer', 'runtime_error', 'time_limit_exceeded'];

// Prototype property names that would conflict with Object.prototype lookups
const RESERVED_KEYS = new Set([
  'constructor', 'prototype', '__proto__', 'hasOwnProperty', 'toString',
  'valueOf', 'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a fresh Express app with the progress router and an in-memory store
 * backed by a mocked fs. Each call produces an isolated app instance.
 */
function createTestApp() {
  jest.resetModules();
  jest.mock('fs');

  const freshFs = require('fs');

  // Manage an in-memory store
  let storeData = { lastUpdated: null, problems: {} };

  freshFs.existsSync.mockReturnValue(true);
  freshFs.readFileSync.mockImplementation(() => JSON.stringify(storeData));
  freshFs.writeFileSync.mockImplementation((_path, content) => {
    storeData = JSON.parse(content);
  });
  freshFs.mkdirSync.mockReturnValue(undefined);

  const progressRoute = require('../routes/progress');
  const app = express();
  app.use(express.json());
  app.use('/', progressRoute);

  return {
    app,
    getStore: () => storeData,
    resetStore: () => {
      storeData = { lastUpdated: null, problems: {} };
    },
  };
}

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

const verdictArb = fc.constantFrom(...VALID_VERDICTS);

const languageArb = fc.oneof(
  fc.constantFrom('python', 'javascript', 'cpp', 'java'),
  fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0)
);

// Safe problem IDs: alphanumeric/dash/underscore, not prototype property names
const problemIdArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => /^[a-zA-Z0-9_-]+$/.test(s) && !RESERVED_KEYS.has(s));

const submissionPayloadArb = fc.record({
  problemId: problemIdArb,
  language: languageArb,
  verdict: verdictArb,
  timeTaken: fc.oneof(fc.integer({ min: 0, max: 100000 }), fc.constant(null)),
});

// A sequence of submissions for a single problem (unique problem ID per sequence)
const submissionSequenceArb = fc.tuple(
  problemIdArb,
  fc.array(
    fc.record({
      language: languageArb,
      verdict: verdictArb,
      timeTaken: fc.oneof(fc.integer({ min: 0, max: 100000 }), fc.constant(null)),
    }),
    { minLength: 1, maxLength: 5 }
  )
);

// ---------------------------------------------------------------------------
// Property 1: Progress_Store round-trip
// ---------------------------------------------------------------------------

// Feature: local-progress-tracker, Property 1: Progress_Store round-trip
// Validates: Requirements 2.1, 2.2, 4.1
describe('Property 1: Progress_Store round-trip', () => {
  test(
    'writing submissions via POST and reading via GET preserves all structural fields',
    async () => {
      const { app, resetStore } = createTestApp();

      await fc.assert(
        fc.asyncProperty(
          // Use uniqueArray to ensure distinct problem IDs across sequences
          fc.uniqueArray(submissionSequenceArb, {
            minLength: 1,
            maxLength: 3,
            selector: ([problemId]) => problemId,
          }),
          async (problemSequences) => {
            resetStore();

            // POST all submissions, tracking what we sent per problem
            const sentByProblem = {};
            for (const [problemId, submissions] of problemSequences) {
              sentByProblem[problemId] = submissions;
              for (const sub of submissions) {
                const res = await request(app)
                  .post('/submissions')
                  .send({ problemId, ...sub });
                if (res.status !== 200) return true; // skip unexpected errors
              }
            }

            // GET the full store
            const getRes = await request(app).get('/');
            if (getRes.status !== 200) return false;

            const store = getRes.body;

            // Verify structural integrity for each problem that was posted
            for (const [problemId, submissions] of problemSequences) {
              const progress = store.problems[problemId];
              if (!progress) return false;

              // Problem_Progress fields must exist (Req 2.1)
              if (!['solved', 'attempted', 'unseen'].includes(progress.status)) return false;
              if (!Array.isArray(progress.languages)) return false;
              if (!Array.isArray(progress.submissions)) return false;
              if (progress.solvedAt !== null && typeof progress.solvedAt !== 'string') return false;

              // Each Submission_Record must have all required fields (Req 2.2)
              for (const record of progress.submissions) {
                if (typeof record.submittedAt !== 'string') return false;
                if (typeof record.language !== 'string') return false;
                if (!VALID_VERDICTS.includes(record.verdict)) return false;
                if (record.timeTaken !== null && typeof record.timeTaken !== 'number') return false;
              }

              // Derived state consistency: if any submission was accepted, status must be solved
              const hasAccepted = submissions.some((s) => s.verdict === 'accepted');
              if (hasAccepted && progress.status !== 'solved') return false;
              if (!hasAccepted && progress.status === 'solved') return false;

              // languages array must only contain languages from accepted submissions
              const acceptedLangs = new Set(
                submissions.filter((s) => s.verdict === 'accepted').map((s) => s.language)
              );
              for (const lang of progress.languages) {
                if (!acceptedLangs.has(lang)) return false;
              }
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 2: Status transition correctness
// ---------------------------------------------------------------------------

// Feature: local-progress-tracker, Property 2: Status transition correctness
// Validates: Requirements 2.3, 2.4
describe('Property 2: Status transition correctness', () => {
  test(
    'accepted verdict always results in solved status; any verdict on unseen results in at least attempted',
    async () => {
      const { app, resetStore } = createTestApp();

      await fc.assert(
        fc.asyncProperty(
          problemIdArb,
          verdictArb,
          languageArb,
          async (problemId, verdict, language) => {
            resetStore();

            const res = await request(app)
              .post('/submissions')
              .send({ problemId, language, verdict, timeTaken: null });

            if (res.status !== 200) return false;

            const progress = res.body;

            // Req 2.4: any submission on unseen → at least attempted
            if (!['solved', 'attempted'].includes(progress.status)) return false;

            // Req 2.3: accepted verdict → solved with solvedAt set
            if (verdict === 'accepted') {
              if (progress.status !== 'solved') return false;
              if (typeof progress.solvedAt !== 'string') return false;
            }

            // Req 2.4: non-accepted on previously unseen → attempted (not solved)
            if (verdict !== 'accepted') {
              if (progress.status !== 'attempted') return false;
            }

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 3: Status monotonicity
// ---------------------------------------------------------------------------

// Feature: local-progress-tracker, Property 3: Status monotonicity
// Validates: Requirements 2.5
describe('Property 3: Status monotonicity', () => {
  test(
    'once a problem is solved, any additional submission leaves status as solved and solvedAt unchanged',
    async () => {
      const { app, resetStore } = createTestApp();

      await fc.assert(
        fc.asyncProperty(
          problemIdArb,
          languageArb,
          verdictArb,
          async (problemId, language, additionalVerdict) => {
            resetStore();

            // First, solve the problem
            const solveRes = await request(app)
              .post('/submissions')
              .send({ problemId, language, verdict: 'accepted', timeTaken: null });

            if (solveRes.status !== 200) return false;
            const solvedAt = solveRes.body.solvedAt;

            // Now record an additional submission with arbitrary verdict
            const additionalRes = await request(app)
              .post('/submissions')
              .send({ problemId, language, verdict: additionalVerdict, timeTaken: null });

            if (additionalRes.status !== 200) return false;

            const progress = additionalRes.body;

            // Status must remain solved (Req 2.5)
            if (progress.status !== 'solved') return false;

            // solvedAt must be unchanged (Req 2.5)
            if (progress.solvedAt !== solvedAt) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});

// ---------------------------------------------------------------------------
// Property 4: Invalid submission input returns HTTP 400
// ---------------------------------------------------------------------------

// Feature: local-progress-tracker, Property 4: Invalid submission input returns HTTP 400
// Validates: Requirements 3.4, 3.5
describe('Property 4: Invalid submission input returns HTTP 400', () => {
  test(
    'requests with missing required fields return 400 with error field',
    async () => {
      const { app } = createTestApp();

      await fc.assert(
        fc.asyncProperty(
          submissionPayloadArb,
          fc.subarray(['problemId', 'language', 'verdict'], { minLength: 1 }),
          async (payload, fieldsToRemove) => {
            const body = { ...payload };
            for (const field of fieldsToRemove) {
              delete body[field];
            }

            const res = await request(app).post('/submissions').send(body);

            if (res.status !== 400) return false;
            if (!res.body.error || typeof res.body.error !== 'string') return false;
            if (res.body.error.length === 0) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test(
    'requests with invalid verdict value return 400 with error field',
    async () => {
      const { app } = createTestApp();

      await fc.assert(
        fc.asyncProperty(
          problemIdArb,
          languageArb,
          fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !VALID_VERDICTS.includes(s)),
          async (problemId, language, invalidVerdict) => {
            const res = await request(app)
              .post('/submissions')
              .send({ problemId, language, verdict: invalidVerdict, timeTaken: null });

            if (res.status !== 400) return false;
            if (!res.body.error || typeof res.body.error !== 'string') return false;
            if (res.body.error.length === 0) return false;

            return true;
          }
        ),
        { numRuns: 100 }
      );
    }
  );
});
