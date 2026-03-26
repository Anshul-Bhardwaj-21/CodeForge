'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../judge0Client');
jest.mock('fs');

const { LANGUAGE_IDS, execute, normalize } = require('../judge0Client');
const fs = require('fs');

// Set up mock LANGUAGE_IDS
LANGUAGE_IDS.cpp = 54;
LANGUAGE_IDS.python = 71;
LANGUAGE_IDS.java = 62;
LANGUAGE_IDS.javascript = 63;

// Real normalize for comparison (mirrors judge0Client implementation)
normalize.mockImplementation((str) =>
  str == null ? '' : String(str).trim().replace(/\s+/g, ' ')
);

const MOCK_PROBLEM = JSON.stringify({
  id: 'test-problem',
  title: 'Test Problem',
  test_cases: {
    sample_test_cases: [
      { input: '1 2', output: '3' },
      { input: '4 5', output: '9' },
    ],
    hidden_test_cases: [],
  },
});

const submitRoute = require('../routes/submit');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', submitRoute);
  return app;
}

describe('POST /api/submit — submit route', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: problem file exists
    fs.readFileSync.mockReturnValue(MOCK_PROBLEM);
    app = buildApp();
  });

  // Test 1: Returns 400 when language is missing
  test('returns 400 when language is missing', async () => {
    const res = await request(app)
      .post('/')
      .send({ code: 'print(1)', problemId: 'test-problem' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // Test 2: Returns 400 when code is missing
  test('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/')
      .send({ language: 'python', problemId: 'test-problem' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // Test 3: Returns 400 when problemId is missing
  test('returns 400 when problemId is missing', async () => {
    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print(1)' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  // Test 4: Returns 404 when problem file doesn't exist
  test('returns 404 when problem file does not exist', async () => {
    const enoentError = new Error('ENOENT: no such file or directory');
    enoentError.code = 'ENOENT';
    fs.readFileSync.mockImplementation(() => { throw enoentError; });

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print(1)', problemId: 'nonexistent' });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Problem not found' });
  });

  // Test 5: Returns correct { passed, total, details } when all test cases pass
  test('returns correct aggregation when all test cases pass', async () => {
    execute.mockResolvedValue({ output: '3', error: '', status: 'success' });
    // Second call returns '9'
    execute
      .mockResolvedValueOnce({ output: '3', error: '', status: 'success' })
      .mockResolvedValueOnce({ output: '9', error: '', status: 'success' });

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print(sum(map(int,input().split())))', problemId: 'test-problem' });

    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(2);
    expect(res.body.total).toBe(2);
    expect(res.body.details).toHaveLength(2);
    expect(res.body.details[0].passed).toBe(true);
    expect(res.body.details[1].passed).toBe(true);
    expect(res.body.details[0].testCaseNumber).toBe(1);
    expect(res.body.details[1].testCaseNumber).toBe(2);
  });

  // Test 6: Returns correct aggregation when some test cases fail (output mismatch)
  test('returns correct aggregation when some test cases fail due to output mismatch', async () => {
    execute
      .mockResolvedValueOnce({ output: '3', error: '', status: 'success' })   // passes
      .mockResolvedValueOnce({ output: 'wrong', error: '', status: 'success' }); // fails

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print("wrong")', problemId: 'test-problem' });

    expect(res.status).toBe(200);
    expect(res.body.passed).toBe(1);
    expect(res.body.total).toBe(2);
    expect(res.body.details).toHaveLength(2);
    expect(res.body.details[0].passed).toBe(true);
    expect(res.body.details[1].passed).toBe(false);
  });

  // Test 7: Resilience — when one test case throws a non-connectivity error,
  // records it as failed and continues (details.length === total)
  test('records failed test case and continues when one test case throws a non-connectivity error', async () => {
    execute
      .mockResolvedValueOnce({ output: '3', error: '', status: 'success' })  // passes
      .mockRejectedValueOnce(new Error('Runtime error: division by zero'));   // throws non-connectivity

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print(1/0)', problemId: 'test-problem' });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.details).toHaveLength(2); // details.length === total
    expect(res.body.details[0].passed).toBe(true);
    expect(res.body.details[1].passed).toBe(false);
    expect(res.body.details[1].error.length).toBeGreaterThan(0);
  });
});

// Feature: judge0-integration, Property 5: /api/submit response shape invariant
describe('Property 5: /api/submit response shape invariant', () => {
  const fc = require('fast-check');

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-apply normalize mock after clearAllMocks
    normalize.mockImplementation((str) =>
      str == null ? '' : String(str).trim().replace(/\s+/g, ' ')
    );
  });

  test('response always contains passed (number), total (number), details (array) with correct element shape', async () => {
    // Validates: Requirements 4.3, 4.4, 7.4
    const testCaseArb = fc.record({
      input: fc.string(),
      output: fc.string(),
    });

    const executeResultArb = fc.record({
      output: fc.string(),
      error: fc.string(),
      status: fc.constantFrom('success', 'error'),
    });

    await fc.assert(
      fc.asyncProperty(
        fc.array(testCaseArb, { minLength: 1, maxLength: 5 }),
        fc.array(executeResultArb, { minLength: 1, maxLength: 5 }),
        async (testCases, executeResults) => {
          // Build a problem JSON with the generated test cases
          const problem = {
            id: 'prop5-problem',
            title: 'Property 5 Problem',
            test_cases: {
              sample_test_cases: testCases,
              hidden_test_cases: [],
            },
          };
          fs.readFileSync.mockReturnValue(JSON.stringify(problem));

          // Mock execute to return results cycling through executeResults
          let callIndex = 0;
          execute.mockImplementation(() => {
            const result = executeResults[callIndex % executeResults.length];
            callIndex++;
            return Promise.resolve(result);
          });

          const app = buildApp();
          const res = await request(app)
            .post('/')
            .send({ language: 'python', code: 'print(1)', problemId: 'prop5-problem' });

          expect(res.status).toBe(200);

          // passed and total must be numbers
          expect(typeof res.body.passed).toBe('number');
          expect(typeof res.body.total).toBe('number');

          // details must be an array
          expect(Array.isArray(res.body.details)).toBe(true);

          // Every element of details must have exactly the required fields
          const REQUIRED_KEYS = [
            'testCaseNumber',
            'passed',
            'input',
            'expectedOutput',
            'actualOutput',
            'error',
            'status',
          ];

          for (const detail of res.body.details) {
            for (const key of REQUIRED_KEYS) {
              expect(detail).toHaveProperty(key);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 9: Test case resilience
describe('Property 9: Test case resilience', () => {
  const fc = require('fast-check');

  beforeEach(() => {
    jest.clearAllMocks();
    normalize.mockImplementation((str) =>
      str == null ? '' : String(str).trim().replace(/\s+/g, ' ')
    );
  });

  test('details.length === total and each throwing test case has passed: false with non-empty error', async () => {
    // Validates: Requirements 6.5
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 1, maxLength: 5 }),
        async (throwFlags) => {
          // Build a problem with one test case per boolean
          const testCases = throwFlags.map((_, i) => ({
            input: `input-${i}`,
            output: `output-${i}`,
          }));

          const problem = {
            id: 'prop9-problem',
            title: 'Property 9 Problem',
            test_cases: {
              sample_test_cases: testCases,
              hidden_test_cases: [],
            },
          };
          fs.readFileSync.mockReturnValue(JSON.stringify(problem));

          // For each boolean: true → throw non-connectivity error, false → resolve successfully
          let callIndex = 0;
          execute.mockImplementation(() => {
            const shouldThrow = throwFlags[callIndex++];
            if (shouldThrow) {
              return Promise.reject(new Error('Runtime error: non-connectivity failure'));
            }
            return Promise.resolve({ output: 'output-0', error: '', status: 'success' });
          });

          const app = buildApp();
          const res = await request(app)
            .post('/')
            .send({ language: 'python', code: 'print(1)', problemId: 'prop9-problem' });

          expect(res.status).toBe(200);

          const { total, details } = res.body;

          // details.length === total (all test cases are represented)
          expect(details.length).toBe(total);
          expect(total).toBe(throwFlags.length);

          // Each test case that threw has passed: false with a non-empty error field
          throwFlags.forEach((shouldThrow, i) => {
            if (shouldThrow) {
              expect(details[i].passed).toBe(false);
              expect(typeof details[i].error).toBe('string');
              expect(details[i].error.length).toBeGreaterThan(0);
            }
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 8: Missing required fields return 400
describe('Property 8: Missing required fields return 400 — /api/submit side', () => {
  const fc = require('fast-check');

  beforeEach(() => {
    jest.clearAllMocks();
    normalize.mockImplementation((str) =>
      str == null ? '' : String(str).trim().replace(/\s+/g, ' ')
    );
    fs.readFileSync.mockReturnValue(MOCK_PROBLEM);
  });

  test('returns 400 with non-empty error when any required field is missing', async () => {
    // Validates: Requirements 6.3
    const validLanguage = fc.constantFrom('cpp', 'python', 'java', 'javascript');
    const validCode = fc.string({ minLength: 1 });
    const validProblemId = fc.string({ minLength: 1 });

    // Generate a body that is missing at least one of language, code, problemId
    const bodyWithMissingFieldArb = fc.oneof(
      // missing language
      fc.record({ code: validCode, problemId: validProblemId }),
      // missing code
      fc.record({ language: validLanguage, problemId: validProblemId }),
      // missing problemId
      fc.record({ language: validLanguage, code: validCode }),
      // missing language + code
      fc.record({ problemId: validProblemId }),
      // missing language + problemId
      fc.record({ code: validCode }),
      // missing code + problemId
      fc.record({ language: validLanguage }),
      // missing all three
      fc.constant({})
    );

    await fc.assert(
      fc.asyncProperty(bodyWithMissingFieldArb, async (body) => {
        const app = buildApp();
        const res = await request(app).post('/').send(body);

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('error');
        expect(typeof res.body.error).toBe('string');
        expect(res.body.error.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 }
    );
  });
});
