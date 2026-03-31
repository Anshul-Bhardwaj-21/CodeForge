'use strict';

const express = require('express');
const router = express.Router();
const { LANGUAGE_IDS, execute } = require('../judge0Client');
const { getCached, setCached, isCacheable } = require('../cacheManager');

router.post('/', async (req, res) => {
  const { language, code, input } = req.body;

  if (!language || !code) {
    return res.status(400).json({ error: 'Language and code are required' });
  }

  if (!Object.prototype.hasOwnProperty.call(LANGUAGE_IDS, language)) {
    return res.status(400).json({ error: `Unsupported language: ${language}` });
  }

  const languageId = LANGUAGE_IDS[language];
  const stdin = input || '';

  // ── Cache lookup ────────────────────────────────────────────────────────────
  const cached = await getCached(languageId, code, stdin);
  if (cached) {
    console.log(`[CACHE HIT]  lang=${language} stdin_len=${stdin.length} code_len=${code.length}`);
    return res.json(cached);
  }
  console.log(`[CACHE MISS] lang=${language} stdin_len=${stdin.length} code_len=${code.length}`);

  // ── Execute via Judge0 ──────────────────────────────────────────────────────
  try {
    const result = await execute({ languageId, sourceCode: code, stdin });

    if (isCacheable(result)) {
      await setCached(languageId, code, stdin, result);
    }

    return res.json(result);
  } catch (err) {
    const msg = err.message || '';
    const isConnectivityError =
      msg.includes('ECONNREFUSED') ||
      msg.includes('unreachable') ||
      msg.toLowerCase().includes('network error');

    if (isConnectivityError) {
      return res.status(503).json({ error: 'Code execution service is unavailable' });
    }

    return res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
