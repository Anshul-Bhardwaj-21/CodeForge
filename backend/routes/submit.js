'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { LANGUAGE_IDS, execute, normalize } = require('../judge0Client');
const { estimateComplexity } = require('../complexityAnalyzer');
const { getCached, setCached, isCacheable } = require('../cacheManager');

const PROBLEMS_DIR = path.join(__dirname, '../../data/problems');

function findProblem(problemId) {
  const files = fs.readdirSync(PROBLEMS_DIR);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    try {
      const content = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf8'));
      // Match by string or number
      if (String(content.id) === String(problemId)) return content;
    } catch (_) {}
  }
  return null;
}

router.post('/', async (req, res) => {
  const { language, code, problemId } = req.body;

  if (!language || !code || !problemId) {
    return res.status(400).json({ error: 'Language, code, and problemId are required' });
  }

  if (!Object.prototype.hasOwnProperty.call(LANGUAGE_IDS, language)) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const languageId = LANGUAGE_IDS[language];

  let problem;
  try {
    problem = findProblem(problemId);
  } catch (err) {
    return res.status(500).json({ error: 'Error reading problem data' });
  }

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const allTestCases = [
    ...(problem.test_cases?.sample_test_cases || []),
    ...(problem.test_cases?.hidden_test_cases || []),
  ];

  let passedCounter = 0;
  const details = [];
  const executionTimes = [];
  const inputSizes = []; // first integer on first line of each test case input

  try {
    for (let i = 0; i < allTestCases.length; i++) {
      const testCase = allTestCases[i];

      try {
        // ── Per-test-case cache lookup ──────────────────────────────────────
        let result = await getCached(languageId, code, testCase.input);
        if (result) {
          console.log(`[CACHE HIT]  submit problem=${problemId} tc=${i + 1}`);
        } else {
          console.log(`[CACHE MISS] submit problem=${problemId} tc=${i + 1}`);
          result = await execute({ languageId, sourceCode: code, stdin: testCase.input });
          if (isCacheable(result)) {
            await setCached(languageId, code, testCase.input, result);
          }
        }

        const actualOutput = result.output;
        const expectedOutput = testCase.output;
        let passed = false;

        if (result.status === 'success') {
          if (normalize(actualOutput) === normalize(expectedOutput)) {
            passed = true;
            passedCounter++;
          }
        }

        if (result.time != null) executionTimes.push(parseFloat(result.time));

        // Extract input size: first integer token in the input string
        const firstToken = parseInt((testCase.input || '').trim().split(/\s+/)[0], 10);
        if (!isNaN(firstToken) && firstToken > 0) inputSizes.push(firstToken);

        details.push({
          testCaseNumber: i + 1,
          passed,
          input: testCase.input,
          expectedOutput,
          actualOutput: actualOutput || '',
          error: result.error || '',
          status: result.status,
          time: result.time ?? null,
          memory: result.memory ?? null,
        });
      } catch (err) {
        const msg = err.message || '';
        const isConnectivity =
          msg.includes('ECONNREFUSED') ||
          msg.includes('unreachable') ||
          msg.toLowerCase().includes('network error');

        if (isConnectivity) throw err;

        details.push({
          testCaseNumber: i + 1,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          error: msg,
          status: 'error',
          time: null,
          memory: null,
        });
      }
    }

    const avgTime = executionTimes.length
      ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length
      : null;
    const maxTime = executionTimes.length ? Math.max(...executionTimes) : null;

    const complexity = estimateComplexity(
      code,
      executionTimes,
      inputSizes.length === executionTimes.length ? inputSizes : null
    );

    return res.json({
      passed: passedCounter,
      total: allTestCases.length,
      details,
      performance: {
        avgTime,
        maxTime,
        times: executionTimes,
        complexity,
      },
    });
  } catch (err) {
    const msg = (err.message || '').toLowerCase();
    const isConnectivity =
      msg.includes('econnrefused') ||
      msg.includes('unreachable') ||
      msg.includes('network error');

    if (isConnectivity) {
      return res.status(503).json({ error: 'Code execution service is unavailable' });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
