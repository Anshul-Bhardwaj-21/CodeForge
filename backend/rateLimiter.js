'use strict';

const rateLimit = require('express-rate-limit');

/**
 * Execution rate limiter — applied only to /api/run and /api/submit.
 *
 * 10 requests per minute per IP.
 *
 * For distributed / multi-process deployments, swap the default
 * in-memory store for a Redis-backed store using `rate-limit-redis`:
 *
 *   const RedisStore = require('rate-limit-redis');
 *   const { createClient } = require('redis');
 *   const redisClient = createClient({ url: process.env.REDIS_URL });
 *   await redisClient.connect();
 *
 *   store: new RedisStore({ sendCommand: (...args) => redisClient.sendCommand(args) })
 *
 * This keeps the counter consistent across all Node.js workers/pods.
 */
const executionLimiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 10,              // max requests per window per IP

  // Trust X-Forwarded-For from reverse proxies (nginx, load balancers).
  // Set to the number of trusted proxy hops in front of Express.
  // 0 = no proxy (direct connection), 1 = one proxy (typical nginx setup).
  // In development this is 0; set via env for production.
  skip: (req) => {
    // Never rate-limit localhost during development
    const ip = req.ip || '';
    if (process.env.NODE_ENV !== 'production') {
      if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
        return true;
      }
    }
    return false;
  },

  standardHeaders: true,   // Return RateLimit-* headers in response
  legacyHeaders: false,     // Disable X-RateLimit-* legacy headers

  handler: (req, res) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    console.warn(`[RATE LIMIT EXCEEDED] IP=${ip} path=${req.path}`);
    res.status(429).json({
      success: false,
      error: 'Too many requests, please try again later.',
    });
  },
});

module.exports = { executionLimiter };
