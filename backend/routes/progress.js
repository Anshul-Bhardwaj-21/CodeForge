'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const PROGRESS_FILE = path.join(__dirname, '../../data/progress.json');

const VALID_VERDICTS = new Set([
  'accepted',
  'wrong_answer',
  'runtime_error',
  'time_limit_exceeded',
]);

const DEFAULT_PROBLEM_PROGRESS = {
  status: 'unseen',
  solvedAt: null,
  languages: [],
  submissions: [],
};

function ensureProgressFile() {
  if (!fs.existsSync(PROGRESS_FILE)) {
    const dir = path.dirname(PROGRESS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      PROGRESS_FILE,
      JSON.stringify({ lastUpdated: null, problems: {} }, null, 2),
      'utf8'
    );
  }
}

function readStore() {
  ensureProgressFile();
  const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
  return JSON.parse(raw);
}

// GET /api/progress — return full store
router.get('/', (req, res) => {
  try {
    const store = readStore();
    return res.json(store);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read progress data' });
  }
});

// POST /api/progress/submissions — record a submission
// MUST be registered before /:problemId
router.post('/submissions', (req, res) => {
  const { problemId, language, verdict, timeTaken } = req.body || {};

  // Validate required fields
  const missing = [];
  if (!problemId) missing.push('problemId');
  if (!language) missing.push('language');
  if (!verdict) missing.push('verdict');

  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  // Validate verdict value
  if (!VALID_VERDICTS.has(verdict)) {
    return res.status(400).json({ error: `Invalid verdict: ${verdict}` });
  }

  let store;
  try {
    store = readStore();
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read progress data' });
  }

  // Get or initialise problem progress
  const problemProgress = store.problems[problemId]
    ? { ...store.problems[problemId] }
    : { ...DEFAULT_PROBLEM_PROGRESS, languages: [], submissions: [] };

  const submittedAt = new Date().toISOString();

  // Build submission record
  const record = {
    submittedAt,
    language,
    verdict,
    timeTaken: timeTaken !== undefined ? timeTaken : null,
  };

  // Append submission
  problemProgress.submissions = [...(problemProgress.submissions || []), record];

  // Update status / solvedAt / languages
  if (verdict === 'accepted' && problemProgress.status !== 'solved') {
    problemProgress.status = 'solved';
    problemProgress.solvedAt = submittedAt;
    // Add language (deduplicated)
    if (!problemProgress.languages.includes(language)) {
      problemProgress.languages = [...problemProgress.languages, language];
    }
  } else if (problemProgress.status === 'unseen') {
    problemProgress.status = 'attempted';
  }
  // If status is 'solved', keep it — never downgrade

  store.problems[problemId] = problemProgress;
  store.lastUpdated = new Date().toISOString();

  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    return res.status(500).json({ error: 'Failed to write progress data' });
  }

  return res.json(problemProgress);
});

// GET /api/progress/:problemId — return progress for one problem
// Registered AFTER /submissions to avoid Express matching "submissions" as a problem ID
router.get('/:problemId', (req, res) => {
  try {
    const store = readStore();
    const progress = store.problems[req.params.problemId];
    if (!progress) {
      return res.json({ ...DEFAULT_PROBLEM_PROGRESS, languages: [], submissions: [] });
    }
    return res.json(progress);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read progress data' });
  }
});

module.exports = router;
