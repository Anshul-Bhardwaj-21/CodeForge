'use strict';

const express = require('express');
const router = express.Router();
const { LANGUAGE_IDS } = require('../judge0Client');

const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');
const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 25; // ~30 seconds max

function decodeB64(val) {
  if (!val) return '';
  return Buffer.from(val, 'base64').toString('utf8');
}

function normalizeResult(json) {
  const id = json.status && json.status.id;
  const description = (json.status && json.status.description) || '';
  const stdout = decodeB64(json.stdout);
  const stderr = decodeB64(json.stderr);
  const compileOutput = decodeB64(json.compile_output);

  if (id === 3) return { output: stdout, error: '', status: 'success', time: json.time, memory: json.memory };
  if (id === 5) return { output: '', error: 'Time Limit Exceeded', status: 'error', time: json.time, memory: json.memory };
  if (id === 8) return { output: '', error: 'Memory Limit Exceeded', status: 'error', time: json.time, memory: json.memory };
  if (id === 6) return { output: '', error: compileOutput, status: 'error', time: json.time, memory: json.memory };
  return { output: stdout, error: stderr || compileOutput || description, status: 'error', time: json.time, memory: json.memory };
}

/**
 * Send a structured SSE event to the client.
 * Format: data: <json>\n\n
 */
function sendEvent(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

router.get('/', async (req, res) => {
  const { language, code, input } = req.query;

  // SSE headers — must be set before any write
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if present
  res.flushHeaders();

  // Validation
  if (!language || !code) {
    sendEvent(res, { stage: 'error', error: 'Language and code are required', status: 'error' });
    return res.end();
  }

  if (!Object.prototype.hasOwnProperty.call(LANGUAGE_IDS, language)) {
    sendEvent(res, { stage: 'error', error: `Unsupported language: ${language}`, status: 'error' });
    return res.end();
  }

  const languageId = LANGUAGE_IDS[language];

  // Track if client disconnected early
  let clientGone = false;
  req.on('close', () => { clientGone = true; });

  // ── Stage 1: Submitting ───────────────────────────────────────────────────
  sendEvent(res, { stage: 'submitting', status: 'queued', output: '', error: null });

  let token;
  try {
    const submitUrl = `${JUDGE0_URL}/submissions?base64_encoded=true`;
    const body = {
      language_id: languageId,
      source_code: Buffer.from(code).toString('base64'),
      stdin: Buffer.from(input || '').toString('base64'),
    };

    const submitRes = await fetch(submitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!submitRes.ok) {
      throw new Error(`Unexpected status: ${submitRes.status}`);
    }

    const submitJson = await submitRes.json();

    // If Judge0 returned a terminal result immediately (wait=true behavior on some instances)
    if (submitJson.status && submitJson.status.id >= 3) {
      const result = normalizeResult(submitJson);
      sendEvent(res, { stage: 'completed', ...result });
      return res.end();
    }

    token = submitJson.token;
    if (!token) {
      // No token and no terminal status — treat as immediate result
      const result = normalizeResult(submitJson);
      sendEvent(res, { stage: 'completed', ...result });
      return res.end();
    }
  } catch (err) {
    const isConnectivity =
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('unreachable') ||
      err.message.toLowerCase().includes('network error') ||
      err.message.toLowerCase().includes('fetch failed');

    sendEvent(res, {
      stage: 'error',
      error: isConnectivity ? 'Code execution service is unavailable' : err.message,
      status: 'error',
    });
    return res.end();
  }

  // ── Stage 2: Polling ──────────────────────────────────────────────────────
  sendEvent(res, { stage: 'running', status: 'running', output: '', error: null });

  const pollUrl = `${JUDGE0_URL}/submissions/${token}?base64_encoded=true`;

  for (let attempt = 0; attempt < MAX_POLLS; attempt++) {
    if (clientGone) return; // client disconnected, stop polling

    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));

    if (clientGone) return;

    let pollJson;
    try {
      const pollRes = await fetch(pollUrl);
      if (!pollRes.ok) throw new Error(`Judge0 poll status: ${pollRes.status}`);
      pollJson = await pollRes.json();
    } catch (err) {
      sendEvent(res, { stage: 'error', error: `Polling failed: ${err.message}`, status: 'error' });
      return res.end();
    }

    const statusId = pollJson.status && pollJson.status.id;

    // Still in queue or processing — send a heartbeat update
    if (statusId === 1) {
      sendEvent(res, { stage: 'running', status: 'queued', output: '', error: null, attempt });
      continue;
    }
    if (statusId === 2) {
      sendEvent(res, { stage: 'running', status: 'running', output: '', error: null, attempt });
      continue;
    }

    // Terminal status reached
    if (statusId >= 3) {
      const result = normalizeResult(pollJson);
      sendEvent(res, { stage: 'completed', ...result });
      return res.end();
    }
  }

  // Timeout
  sendEvent(res, { stage: 'error', error: 'Execution timed out', status: 'error' });
  res.end();
});

module.exports = router;
