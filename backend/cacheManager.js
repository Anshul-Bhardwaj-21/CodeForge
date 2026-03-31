'use strict';

const crypto = require('crypto');

/**
 * CacheManager — abstracted execution result cache.
 *
 * Backed by an in-memory Map with TTL-based expiry.
 * The interface is async so it can be swapped for a Redis
 * backend without changing any call sites.
 *
 * Only successful AND error-terminal results are cached.
 * Partial / connectivity failures are never stored.
 */

const DEFAULT_TTL_MS = 8 * 60 * 1000; // 8 minutes

class InMemoryCache {
  constructor(ttlMs = DEFAULT_TTL_MS) {
    this._store = new Map();
    this._ttl   = ttlMs;

    // Sweep expired entries every 2 minutes to prevent unbounded growth
    this._sweepInterval = setInterval(() => this._sweep(), 2 * 60 * 1000);
    // Don't keep the process alive just for sweeping
    if (this._sweepInterval.unref) this._sweepInterval.unref();
  }

  async get(key) {
    const entry = this._store.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > this._ttl) {
      this._store.delete(key);
      return null;
    }
    return entry;
  }

  async set(key, value) {
    this._store.set(key, { ...value, timestamp: Date.now() });
  }

  async has(key) {
    return (await this.get(key)) !== null;
  }

  /** Remove all expired entries */
  _sweep() {
    const now = Date.now();
    for (const [key, entry] of this._store) {
      if (now - entry.timestamp > this._ttl) {
        this._store.delete(key);
      }
    }
  }

  /** Expose size for diagnostics */
  get size() {
    return this._store.size;
  }
}

// ── Singleton instance ────────────────────────────────────────────────────────
const cache = new InMemoryCache();

/**
 * Build a collision-resistant cache key.
 * SHA-256 of "languageId:stdin:sourceCode" — O(1) lookup after hashing.
 *
 * @param {number} languageId
 * @param {string} sourceCode
 * @param {string} stdin
 * @returns {string} hex digest
 */
function buildKey(languageId, sourceCode, stdin) {
  return crypto
    .createHash('sha256')
    .update(`${languageId}:${stdin ?? ''}:${sourceCode}`)
    .digest('hex');
}

/**
 * Retrieve a cached execution result.
 * Returns null on miss or expiry.
 *
 * @param {number} languageId
 * @param {string} sourceCode
 * @param {string} stdin
 * @returns {Promise<object|null>}
 */
async function getCached(languageId, sourceCode, stdin) {
  const key = buildKey(languageId, sourceCode, stdin);
  return cache.get(key);
}

/**
 * Store an execution result.
 * Only call this for terminal results (success or known error) —
 * never for connectivity failures or partial results.
 *
 * @param {number} languageId
 * @param {string} sourceCode
 * @param {string} stdin
 * @param {{ output: string, error: string, status: string, time?: any, memory?: any }} result
 */
async function setCached(languageId, sourceCode, stdin, result) {
  const key = buildKey(languageId, sourceCode, stdin);
  await cache.set(key, {
    output:    result.output    ?? '',
    error:     result.error     ?? '',
    status:    result.status,
    time:      result.time      ?? null,
    memory:    result.memory    ?? null,
  });
}

/**
 * Determine whether a result is safe to cache.
 * Connectivity errors and unhandled exceptions must NOT be cached.
 *
 * @param {{ status: string, error?: string }} result
 * @returns {boolean}
 */
function isCacheable(result) {
  if (!result || !result.status) return false;
  // Only cache terminal Judge0 outcomes
  if (result.status !== 'success' && result.status !== 'error') return false;
  // Don't cache connectivity / infrastructure errors
  const err = (result.error || '').toLowerCase();
  if (err.includes('econnrefused')) return false;
  if (err.includes('unreachable'))  return false;
  if (err.includes('network error')) return false;
  if (err.includes('timed out'))    return false;
  return true;
}

module.exports = { getCached, setCached, isCacheable, buildKey };
