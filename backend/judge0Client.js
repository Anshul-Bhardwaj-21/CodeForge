'use strict';

const JUDGE0_URL = process.env.JUDGE0_URL || 'http://localhost:2358';

const LANGUAGE_IDS = {
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

  if (id === 3) {
    return { output: stdout, error: '', status: 'success' };
  }

  if (id === 5) {
    return { output: '', error: 'Time Limit Exceeded', status: 'error' };
  }

  if (id === 8) {
    return { output: '', error: 'Memory Limit Exceeded', status: 'error' };
  }

  if (id === 6) {
    return { output: '', error: compileOutput, status: 'error' };
  }

  // All other statuses (runtime errors, wrong answer, etc.)
  return {
    output: stdout,
    error:  stderr || compileOutput || description,
    status: 'error',
  };
}

/**
 * Submit code to Judge0 and return a normalized result.
 * @param {{ languageId: number, sourceCode: string, stdin: string }} params
 * @returns {Promise<{ output: string, error: string, status: "success"|"error" }>}
 */
async function execute({ languageId, sourceCode, stdin }) {
  const url = `${JUDGE0_URL}/submissions?base64_encoded=true&wait=true`;

  const body = {
    language_id:  languageId,
    source_code:  Buffer.from(sourceCode).toString('base64'),
    stdin:        Buffer.from(stdin || '').toString('base64'),
  };

  let response;
  try {
    response = await fetch(url, {
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
  return normalizeResult(json);
}

module.exports = { LANGUAGE_IDS, normalize, normalizeResult, execute };
