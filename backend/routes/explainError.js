'use strict';

const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────────────────────

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const MAX_CODE_LEN   = 4000;   // chars
const MAX_ERROR_LEN  = 2000;
const MAX_INPUT_LEN  = 500;
const TIMEOUT_MS     = 15000;

// Simple in-process explanation cache (same key = same explanation)
const explanationCache = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function cacheKey(language, code, error) {
  return crypto
    .createHash('sha256')
    .update(`${language}:${error}:${code}`)
    .digest('hex');
}

function getCached(key) {
  const entry = explanationCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { explanationCache.delete(key); return null; }
  return entry.value;
}

function setCached(key, value) {
  explanationCache.set(key, { value, ts: Date.now() });
}

// ── Sanitize: strip null bytes, truncate ──────────────────────────────────────

function sanitize(str, maxLen) {
  if (str == null) return '';
  return String(str).replace(/\0/g, '').slice(0, maxLen);
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildPrompt(language, code, error, input) {
  return `You are an expert programming mentor helping a beginner debug their code.

A user ran the following code and got an error:

Language: ${language}

Code:
\`\`\`${language}
${code}
\`\`\`

Error:
\`\`\`
${error}
\`\`\`
${input ? `\nInput provided:\n\`\`\`\n${input}\n\`\`\`` : ''}

Please explain:
1. What this error means in simple terms (no jargon)
2. Why it likely happened in THIS specific code (reference line numbers or variable names if possible)
3. Concrete steps to fix it
4. A brief corrected code snippet if applicable

Respond ONLY with a valid JSON object in this exact shape (no markdown, no extra text):
{
  "summary": "<one sentence plain-English summary of the error>",
  "detailed": "<step-by-step explanation referencing the actual code>",
  "fix_suggestions": ["<suggestion 1>", "<suggestion 2>", "<suggestion 3>"]
}`;
}

// ── Fallback when AI is unavailable ──────────────────────────────────────────

function buildFallback(error) {
  return {
    summary: 'AI explanation is currently unavailable.',
    detailed: `Here is the raw error message:\n\n${error}\n\nCheck the error type and line number for clues. Common causes: syntax errors, undefined variables, type mismatches, or out-of-bounds access.`,
    fix_suggestions: [
      'Read the error message carefully — it usually contains the line number.',
      'Search the exact error text online for examples.',
      'Add print/console.log statements to trace variable values.',
    ],
  };
}

// ── POST /api/explain-error ───────────────────────────────────────────────────

router.post('/', async (req, res) => {
  const { language, code, error, input } = req.body || {};

  if (!language || !code) {
    return res.status(400).json({ error: 'language and code are required' });
  }

  if (!error || !error.trim()) {
    return res.status(400).json({ error: 'No error message provided to explain' });
  }

  // Sanitize + truncate all inputs
  const safeLanguage = sanitize(language, 20);
  const safeCode     = sanitize(code, MAX_CODE_LEN);
  const safeError    = sanitize(error, MAX_ERROR_LEN);
  const safeInput    = sanitize(input, MAX_INPUT_LEN);

  // Cache check
  const key = cacheKey(safeLanguage, safeCode, safeError);
  const cached = getCached(key);
  if (cached) {
    console.log('[explain-error] CACHE HIT');
    return res.json({ ...cached, cached: true });
  }

  // No API key configured — return structured fallback immediately
  if (!OPENAI_API_KEY) {
    console.warn('[explain-error] OPENAI_API_KEY not set — returning fallback');
    const fallback = buildFallback(safeError);
    return res.json({ ...fallback, cached: false, fallback: true });
  }

  // ── Call OpenAI ─────────────────────────────────────────────────────────────
  const prompt = buildPrompt(safeLanguage, safeCode, safeError, safeInput);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!openaiRes.ok) {
      const errBody = await openaiRes.text();
      console.error(`[explain-error] OpenAI error ${openaiRes.status}: ${errBody}`);
      return res.json({ ...buildFallback(safeError), cached: false, fallback: true });
    }

    const json = await openaiRes.json();
    const content = json.choices?.[0]?.message?.content || '';

    // Parse the JSON the model returned
    let parsed;
    try {
      // Strip any accidental markdown fences
      const clean = content.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      parsed = JSON.parse(clean);
    } catch (_) {
      // Model didn't return valid JSON — wrap raw text
      parsed = {
        summary: 'Could not parse AI response.',
        detailed: content,
        fix_suggestions: [],
      };
    }

    // Validate shape
    const result = {
      summary:         typeof parsed.summary === 'string'          ? parsed.summary         : '',
      detailed:        typeof parsed.detailed === 'string'         ? parsed.detailed        : content,
      fix_suggestions: Array.isArray(parsed.fix_suggestions)       ? parsed.fix_suggestions : [],
      cached: false,
      fallback: false,
    };

    setCached(key, result);
    return res.json(result);

  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err.name === 'AbortError';
    console.error(`[explain-error] ${isTimeout ? 'Timeout' : err.message}`);
    return res.json({ ...buildFallback(safeError), cached: false, fallback: true });
  }
});

module.exports = router;
