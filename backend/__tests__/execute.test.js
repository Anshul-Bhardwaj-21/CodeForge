'use strict';

const request = require('supertest');
const express = require('express');

jest.mock('../judge0Client');

const { LANGUAGE_IDS, execute } = require('../judge0Client');

// Set up mock LANGUAGE_IDS
LANGUAGE_IDS.cpp = 54;
LANGUAGE_IDS.python = 71;
LANGUAGE_IDS.java = 62;
LANGUAGE_IDS.javascript = 63;

const executeRoute = require('../routes/execute');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', executeRoute);
  return app;
}

describe('POST /api/run — execute route', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = buildApp();
  });

  test('returns 400 when language is missing', async () => {
    const res = await request(app)
      .post('/')
      .send({ code: 'print("hello")' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 when code is missing', async () => {
    const res = await request(app)
      .post('/')
      .send({ language: 'python' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  test('returns 400 with unsupported language error for unknown language', async () => {
    const res = await request(app)
      .post('/')
      .send({ language: 'ruby', code: 'puts "hello"' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Unsupported language: ruby' });
  });

  test('returns 503 when judge0Client throws ECONNREFUSED error', async () => {
    execute.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:2358'));

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print("hello")' });

    expect(res.status).toBe(503);
    expect(res.body).toEqual({ error: 'Code execution service is unavailable' });
  });

  test('returns correct { output, error, status } shape on success', async () => {
    execute.mockResolvedValue({ output: 'hello\n', error: '', status: 'success' });

    const res = await request(app)
      .post('/')
      .send({ language: 'python', code: 'print("hello")' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ output: 'hello\n', error: '', status: 'success' });
  });
});

// Feature: judge0-integration, Property 2: Unsupported language rejection
describe('Property 2: Unsupported language rejection', () => {
  const fc = require('fast-check');
  const SUPPORTED = new Set(['cpp', 'python', 'java', 'javascript']);
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    const express = require('express');
    const a = express();
    a.use(express.json());
    a.use('/', require('../routes/execute'));
    app = a;
  });

  test('returns 400 with non-empty error for any unsupported language string', async () => {
    // Validates: Requirements 2.2
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1 }).filter((s) => !SUPPORTED.has(s)),
        async (lang) => {
          const res = await request(app)
            .post('/')
            .send({ language: lang, code: 'hello' });

          expect(res.status).toBe(400);
          expect(typeof res.body.error).toBe('string');
          expect(res.body.error.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 3: /api/run response shape invariant
describe('Property 3: /api/run response shape invariant', () => {
  const fc = require('fast-check');
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    const express = require('express');
    const a = express();
    a.use(express.json());
    a.use('/', require('../routes/execute'));
    app = a;
  });

  test('response always has output (string), error (string), status ("success"|"error")', async () => {
    // Validates: Requirements 3.8, 7.3
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          language: fc.constantFrom('cpp', 'python', 'java', 'javascript'),
          code: fc.string({ minLength: 1 }),
          input: fc.option(fc.string()),
        }),
        fc.record({
          output: fc.string(),
          error: fc.string(),
          status: fc.constantFrom('success', 'error'),
        }),
        async (reqBody, mockResult) => {
          execute.mockResolvedValue(mockResult);

          const res = await request(app)
            .post('/')
            .send(reqBody);

          expect(res.status).toBe(200);
          expect(typeof res.body.output).toBe('string');
          expect(typeof res.body.error).toBe('string');
          expect(['success', 'error']).toContain(res.body.status);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 8: Missing required fields return 400
describe('Property 8: Missing required fields return 400 — /api/run side', () => {
  const fc = require('fast-check');
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    const express = require('express');
    const a = express();
    a.use(express.json());
    a.use('/', require('../routes/execute'));
    app = a;
  });

  test('returns 400 with non-empty error when language or code is missing', async () => {
    // Validates: Requirements 6.2
    const missingLanguage = fc.record({ code: fc.string({ minLength: 1 }) });
    const missingCode = fc.record({ language: fc.string({ minLength: 1 }) });
    const missingBoth = fc.constant({});

    await fc.assert(
      fc.asyncProperty(
        fc.oneof(missingLanguage, missingCode, missingBoth),
        async (body) => {
          const res = await request(app).post('/').send(body);

          expect(res.status).toBe(400);
          expect(typeof res.body.error).toBe('string');
          expect(res.body.error.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
