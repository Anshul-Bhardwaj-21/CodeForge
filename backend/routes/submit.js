'use strict';

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const { LANGUAGE_IDS, execute, normalize } = require('../judge0Client');

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
  const problemPath = path.join(__dirname, '../../data/problems', problemId + '.json');
  try {
    const content = fs.readFileSync(problemPath, 'utf8');
    problem = JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return res.status(404).json({ error: 'Problem not found' });
    }
    return res.status(500).json({ error: 'Error reading problem data' });
  }

  const allTestCases = [
    ...(problem.test_cases?.sample_test_cases || []),
    ...(problem.test_cases?.hidden_test_cases || []),
  ];

  let passedCounter = 0;
  const details = [];

  try {
    for (let i = 0; i < allTestCases.length; i++) {
      const testCase = allTestCases[i];

      try {
        const result = await execute({ languageId, sourceCode: code, stdin: testCase.input });

        const actualOutput = result.output;
        const expectedOutput = testCase.output;
        let passed = false;

        if (result.status === 'success') {
          if (normalize(actualOutput) === normalize(expectedOutput)) {
            passed = true;
            passedCounter++;
          }
        }

        details.push({
          testCaseNumber: i + 1,
          passed,
          input: testCase.input,
          expectedOutput,
          actualOutput: actualOutput || '',
          error: result.error || '',
          status: result.status,
        });
      } catch (err) {
        const msg = err.message || '';
        const isConnectivity =
          msg.includes('ECONNREFUSED') ||
          msg.includes('unreachable') ||
          msg.toLowerCase().includes('network error');

        if (isConnectivity) {
          throw err; // bubble up to outer catch → 503
        }

        details.push({
          testCaseNumber: i + 1,
          passed: false,
          input: testCase.input,
          expectedOutput: testCase.output,
          actualOutput: '',
          error: msg,
          status: 'error',
        });
      }
    }

    return res.json({
      passed: passedCounter,
      total: allTestCases.length,
      details,
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
