'use strict';

const request = require('supertest');
const express = require('express');

// Mock fs before requiring the route so the route picks up the mock
jest.mock('fs');
const fs = require('fs');

// Build a minimal test app that mounts the progress router
// (index.js doesn't mount it yet — that's task 2)
function buildApp() {
  // Reset module registry so each test suite gets a fresh router with fresh state
  jest.resetModules();
  // Re-apply the fs mock after resetModules
  jest.mock('fs');
  const freshFs = require('fs');
  // Copy over any mock implementations set up before this call
  Object.assign(freshFs, require('fs'));

  const progressRoute = require('../routes/progress');
  const app = express();
  app.use(express.json());
  app.use('/', progressRoute);
  return app;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMPTY_STORE = JSON.stringify({ lastUpdated: null, problems: {} });

function setupFreshStore() {
  // existsSync: file does not exist on first call (triggers creation), then exists
  fs.existsSync.mockReturnValue(false);
  fs.mkdirSync.mockReturnValue(undefined);
  fs.writeFileSync.mockReturnValue(undefined);
  fs.readFileSync.mockReturnValue(EMPTY_STORE);
}

// ---------------------------------------------------------------------------
// Test 1: Startup creates data/progress.json if missing
// ---------------------------------------------------------------------------
describe('startup — creates data/progress.json if missing', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('calls writeFileSync with default structure when file does not exist', async () => {
    // File does not exist
    fs.existsSync.mockReturnValue(false);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.writeFileSync.mockReturnValue(undefined);
    fs.readFileSync.mockReturnValue(EMPTY_STORE);

    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    await request(app).get('/');

    // writeFileSync should have been called to create the file
    expect(fs.writeFileSync).toHaveBeenCalled();

    // The first writeFileSync call should write the default structure
    const [, content] = fs.writeFileSync.mock.calls[0];
    const parsed = JSON.parse(content);
    expect(parsed).toEqual({ lastUpdated: null, problems: {} });
  });
});

// ---------------------------------------------------------------------------
// Test 2: GET /api/progress returns empty structure on fresh store
// ---------------------------------------------------------------------------
describe('GET / — returns empty structure on fresh store', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFreshStore();
  });

  test('returns 200 with { lastUpdated: null, problems: {} }', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app).get('/');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ lastUpdated: null, problems: {} });
  });
});

// ---------------------------------------------------------------------------
// Test 3: GET /api/progress/:id returns default unseen object for unknown problem
// ---------------------------------------------------------------------------
describe('GET /:problemId — returns default unseen object for unknown problem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFreshStore();
  });

  test('returns 200 with default unseen Problem_Progress for unknown id', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app).get('/unknown-problem-id');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      status: 'unseen',
      solvedAt: null,
      languages: [],
      submissions: [],
    });
  });
});

// ---------------------------------------------------------------------------
// Test 4: POST /submissions with missing fields returns 400 with error field
// ---------------------------------------------------------------------------
describe('POST /submissions — missing fields returns 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFreshStore();
  });

  test('returns 400 with error when problemId is missing', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ language: 'python', verdict: 'accepted' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test('returns 400 with error when language is missing', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', verdict: 'accepted' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test('returns 400 with error when verdict is missing', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', language: 'python' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });

  test('returns 400 with error when all fields are missing', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app).post('/submissions').send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 5: POST /submissions with invalid verdict returns 400 with error field
// ---------------------------------------------------------------------------
describe('POST /submissions — invalid verdict returns 400', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFreshStore();
  });

  test('returns 400 with error for an unrecognised verdict value', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', language: 'python', verdict: 'invalid_verdict' });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Test 6: POST /submissions with timeTaken: null is accepted (HTTP 200)
// ---------------------------------------------------------------------------
describe('POST /submissions — timeTaken: null is accepted', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupFreshStore();
  });

  test('returns 200 when timeTaken is null', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', language: 'python', verdict: 'accepted', timeTaken: null });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'solved');
    expect(res.body.submissions).toHaveLength(1);
    expect(res.body.submissions[0].timeTaken).toBeNull();
  });

  test('returns 200 when timeTaken is omitted entirely', async () => {
    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', language: 'python', verdict: 'accepted' });

    expect(res.status).toBe(200);
    expect(res.body.submissions[0].timeTaken).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 7: Filesystem write failure returns 500
// ---------------------------------------------------------------------------
describe('POST /submissions — filesystem write failure returns 500', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 500 with error when writeFileSync throws', async () => {
    // File exists for reading, but write fails
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(EMPTY_STORE);
    fs.writeFileSync.mockImplementation(() => {
      throw new Error('ENOSPC: no space left on device');
    });

    const progressRoute = require('../routes/progress');
    const app = express();
    app.use(express.json());
    app.use('/', progressRoute);

    const res = await request(app)
      .post('/submissions')
      .send({ problemId: 'two-sum', language: 'python', verdict: 'accepted', timeTaken: 100 });

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.length).toBeGreaterThan(0);
  });
});
