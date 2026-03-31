'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { LANGUAGE_IDS, execute, normalize } = require('../judge0Client');

const SUBMISSIONS_FILE = path.join(__dirname, '../../data/submissions.json');
const PROBLEMS_DIR = path.join(__dirname, '../../data/problems');

// ── Storage helpers ───────────────────────────────────────────────────────────

function ensureFile() {
  if (!fs.existsSync(SUBMISSIONS_FILE)) {
    const dir = path.dirname(SUBMISSIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify({ submissions: [] }, null, 2), 'utf8');
  }
}

function readStore() {
  ensureFile();
  return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf8'));
}

function writeStore(store) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

function findProblem(problemId) {
  if (!fs.existsSync(PROBLEMS_DIR)) return null;
  for (const file of fs.readdirSync(PROBLEMS_DIR)) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf8'));
      if (String(content.id) === String(problemId)) return content;
    } catch (_) {}
  }
  return null;
}

/**
 * Persist a detailed submission record.
 * Called by submit.js after execution completes.
 */
function saveSubmission({ id, problemId, problemTitle, language, languageId, code, verdict, passed, total, details, timestamp }) {
  try {
    const store = readStore();
    store.submissions.unshift({
      id,
      problemId: String(problemId),
      problemTitle: problemTitle || `Problem ${problemId}`,
      language,
      languageId,
      code,
      verdict,
      passed,
      total,
      details,
      timestamp,
    });
    // Keep at most 200 submissions to prevent unbounded growth
    if (store.submissions.length > 200) store.submissions = store.submissions.slice(0, 200);
    writeStore(store);
  } catch (err) {
    console.error('[submissions] Failed to save submission:', err.message);
  }
}

// ── GET /api/submissions ──────────────────────────────────────────────────────
// Returns all submissions (code omitted for list view)
router.get('/', (req, res) => {
  try {
    const store = readStore();
    const list = store.submissions.map(({ code: _code, details: _details, ...meta }) => meta);
    return res.json(list);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read submissions' });
  }
});

// ── GET /api/submissions/:id ──────────────────────────────────────────────────
// Returns full submission including code and per-test-case details
router.get('/:id', (req, res) => {
  try {
    const store = readStore();
    const sub = store.submissions.find(s => s.id === req.params.id);
    if (!sub) return res.status(404).json({ error: 'Submission not found' });
    return res.json(sub);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read submission' });
  }
});

// ── POST /api/replay ──────────────────────────────────────────────────────────
// Re-runs a stored submission against current test cases
router.post('/replay', async (req, res) => {
  const { submissionId } = req.body || {};
  if (!submissionId) return res.status(400).json({ error: 'submissionId is required' });

  let original;
  try {
    const store = readStore();
    original = store.submissions.find(s => s.id === submissionId);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read submissions' });
  }

  if (!original) return res.status(404).json({ error: 'Submission not found' });

  const { code, language, languageId, problemId } = original;

  const problem = findProblem(problemId);
  if (!problem) {
    return res.status(404).json({ error: `Problem ${problemId} no longer exists` });
  }

  const allTestCases = [
    ...(problem.test_cases?.sample_test_cases || []),
    ...(problem.test_cases?.hidden_test_cases || []),
  ];

  let passedCounter = 0;
  const details = [];

  try {
    for (let i = 0; i < allTestCases.length; i++) {
      const tc = allTestCases[i];
      try {
        const result = await execute({ languageId, sourceCode: code, stdin: tc.input });
        const passed =
          result.status === 'success' &&
          normalize(result.output) === normalize(tc.output);
        if (passed) passedCounter++;
        details.push({
          testCaseNumber: i + 1,
          passed,
          input: tc.input,
          expectedOutput: tc.output,
          actualOutput: result.output || '',
          error: result.error || '',
          status: result.status,
        });
      } catch (err) {
        details.push({
          testCaseNumber: i + 1,
          passed: false,
          input: tc.input,
          expectedOutput: tc.output,
          actualOutput: '',
          error: err.message || 'Execution error',
          status: 'error',
        });
      }
    }

    // Persist the replayed submission as a new record
    const replayId = uuidv4();
    const timestamp = new Date().toISOString();
    const verdict = passedCounter === allTestCases.length ? 'accepted' : 'wrong_answer';

    saveSubmission({
      id: replayId,
      problemId,
      problemTitle: original.problemTitle,
      language,
      languageId,
      code,
      verdict,
      passed: passedCounter,
      total: allTestCases.length,
      details,
      timestamp,
    });

    return res.json({
      id: replayId,
      problemId,
      problemTitle: original.problemTitle,
      language,
      verdict,
      passed: passedCounter,
      total: allTestCases.length,
      details,
      timestamp,
      replayOf: submissionId,
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('econnrefused') || msg.includes('unreachable')) {
      return res.status(503).json({ error: 'Code execution service is unavailable' });
    }
    return res.status(500).json({ error: 'Replay failed' });
  }
});

module.exports = { router, saveSubmission };
