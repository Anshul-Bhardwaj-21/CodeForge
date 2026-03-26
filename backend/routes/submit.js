const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const PROBLEMS_DIR = path.join(__dirname, '../../data/problems');

const normalize = (str) => {
  if (str == null) return "";
  return String(str).trim().replace(/\s+/g, " ");
};

router.post('/', async (req, res) => {
  const { language, code, problemId } = req.body;

  if (!language || !code || !problemId) {
    return res.status(400).json({ error: 'Language, code, and problemId are required' });
  }

  let problem = null;
  try {
    const files = fs.readdirSync(PROBLEMS_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const content = JSON.parse(fs.readFileSync(path.join(PROBLEMS_DIR, file), 'utf8'));
        if (content.id.toString() === problemId.toString()) {
          problem = content;
          break;
        }
      }
    }
  } catch (err) {
    return res.status(500).json({ error: 'Error reading problem data' });
  }

  if (!problem) return res.status(404).json({ error: 'Problem not found' });

  const allTestCases = [
    ...(problem.test_cases?.sample_test_cases || []),
    ...(problem.test_cases?.hidden_test_cases || [])
  ];

  if (allTestCases.length === 0) {
    return res.status(400).json({ error: 'No test cases found for this problem' });
  }

  let passedCounter = 0;
  const details = [];
  const executeUrl = `http://localhost:${process.env.PORT || 3000}/api/run`;

  for (let i = 0; i < allTestCases.length; i++) {
    const testCase = allTestCases[i];
    
    try {
      const response = await fetch(executeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language, code, input: testCase.input })
      });

      const result = await response.json();

      let passed = false;
      const actualOutput = result.output;
      const expectedOutput = testCase.output;

      if (result.status === 'success') {
        const normalizedActual = normalize(actualOutput);
        const normalizedExpected = normalize(expectedOutput);
        if (normalizedActual === normalizedExpected) {
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
        status: result.status 
      });

    } catch (err) {
      details.push({
        testCaseNumber: i + 1,
        passed: false,
        input: testCase.input,
        expectedOutput: testCase.output,
        actualOutput: '',
        error: 'Execution request failed',
        status: 'error'
      });
    }
  }

  res.json({
    passed: passedCounter,
    total: allTestCases.length,
    details
  });
});

module.exports = router;
