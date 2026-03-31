'use strict';

// Use JUDGE0_URL env var if set (local Docker), otherwise fall back to the
// public Judge0 CE instance which works without an API key for low-volume use.
const JUDGE0_URL = (process.env.JUDGE0_URL || 'https://ce.judge0.com').replace(/\/$/, '');

const LANGUAGE_IDS = {
  c:          50,
  cpp:        54,
  python:     71,
  java:       62,
  javascript: 63,
};

/**
 * Normalize a string: null/undefined → "", trim, collapse internal whitespace.
 */
const normalize = (str) =>
  str == null ? '' : String(str).trim().replace(/\s+/g, ' ');

/**
 * Decode a Base64 string returned by Judge0, or return "" if falsy.
 */
function decodeB64(val) {
  if (!val) return '';
  return Buffer.from(val, 'base64').toString('utf8');
}

/**
 * Map a Judge0 response object to a normalized result.
 * @param {object} response - parsed Judge0 JSON response
 * @returns {{ output: string, error: string, status: "success"|"error" }}
 */
function normalizeResult(response) {
  const id = response.status && response.status.id;
  const description = (response.status && response.status.description) || '';

  const stdout         = decodeB64(response.stdout);
  const stderr         = decodeB64(response.stderr);
  const compileOutput  = decodeB64(response.compile_output);

  const base = {
    time:   response.time   ?? null,   // seconds string e.g. "0.042"
    memory: response.memory ?? null,   // KB
  };

  if (id === 3) {
    return { ...base, output: stdout, error: '', status: 'success' };
  }

  if (id === 5) {
    return { ...base, output: '', error: 'Time Limit Exceeded', status: 'error' };
  }

  if (id === 8) {
    return { ...base, output: '', error: 'Memory Limit Exceeded', status: 'error' };
  }

  if (id === 6) {
    return { ...base, output: '', error: compileOutput, status: 'error' };
  }

  return {
    ...base,
    output: stdout,
    error:  stderr || compileOutput || description,
    status: 'error',
  };
}

/**
 * Submit code to Judge0 and return a normalized result.
 * Uses wait=true for local instances; falls back to polling for hosted instances.
 * @param {{ languageId: number, sourceCode: string, stdin: string }} params
 * @returns {Promise<{ output: string, error: string, status: "success"|"error" }>}
 */
async function execute({ languageId, sourceCode, stdin }) {
  const submitUrl = `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`;

  const body = {
    language_id:  languageId,
    source_code:  Buffer.from(sourceCode).toString('base64'),
    stdin:        Buffer.from(stdin || '').toString('base64'),
  };

  let response;
  try {
    response = await fetch(submitUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
  } catch (err) {
    const isConnRefused =
      err.code === 'ECONNREFUSED' ||
      (err.cause && err.cause.code === 'ECONNREFUSED') ||
      (err.message && err.message.includes('ECONNREFUSED'));

    if (isConnRefused) {
      throw new Error('Judge0 is unreachable: connection refused (ECONNREFUSED)');
    }
    throw new Error(`Judge0 network error: ${err.message}`);
  }

  if (response.status !== 200 && response.status !== 201) {
    throw new Error(`Unexpected status: ${response.status}`);
  }

  const json = await response.json();

  // If wait=true worked and we already have a terminal status, return immediately
  if (json.status && json.status.id >= 3) {
    return normalizeResult(json);
  }

  // Otherwise poll until done (public hosted instance may return token only)
  if (!json.token) {
    return normalizeResult(json);
  }

  const token = json.token;
  const pollUrl = `${JUDGE0_URL}/submissions/${token}?base64_encoded=true`;

  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise(r => setTimeout(r, 800));
    let pollRes;
    try {
      pollRes = await fetch(pollUrl);
    } catch (err) {
      throw new Error(`Judge0 poll error: ${err.message}`);
    }
    if (!pollRes.ok) throw new Error(`Judge0 poll status: ${pollRes.status}`);
    const pollJson = await pollRes.json();
    // Status IDs 1 (In Queue) and 2 (Processing) mean not done yet
    if (pollJson.status && pollJson.status.id >= 3) {
      return normalizeResult(pollJson);
    }
  }

  throw new Error('Judge0 timed out waiting for result');
}

module.exports = { LANGUAGE_IDS, normalize, normalizeResult, execute };
