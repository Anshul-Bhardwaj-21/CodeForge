'use strict';

/**
 * Heuristic time complexity estimator.
 * Combines static code analysis + runtime curve fitting.
 * Returns { notation, label, confidence, method }
 */

// ── Static analysis ───────────────────────────────────────────────────────────

const LOOP_PATTERNS = [
  /\bfor\s*\(/g,
  /\bwhile\s*\(/g,
  /\bdo\s*\{/g,
];

const SORT_PATTERNS = [
  /\bsort\s*\(/,
  /\.sort\s*\(/,
  /Arrays\.sort\s*\(/,
  /Collections\.sort\s*\(/,
  /sorted\s*\(/,
  /heapq\./,
  /\.sorted\b/,
];

const LOG_PATTERNS = [
  /\bbinary.?search\b/i,
  /\blog\s*\(/,
  /\bMath\.log\b/,
  /\bmath\.log\b/,
  />>?\s*1\b/,          // bit shift (often in binary search)
  /mid\s*=.*\/\s*2/,
];

const HASH_PATTERNS = [
  /\bunordered_map\b/,
  /\bunordered_set\b/,
  /\bHashMap\b/,
  /\bHashSet\b/,
  /\bdict\b/,
  /\bset\s*\(/,
  /\{\s*\}/,            // dict/set literal in python
];

const RECURSIVE_PATTERNS = [
  /\bfunction\s+(\w+)[^{]*\{[\s\S]*?\b\1\s*\(/,  // JS recursive fn
];

function countLoopDepth(code) {
  // Count max nesting depth of loops
  let maxDepth = 0;
  let depth = 0;
  const lines = code.split('\n');

  for (const line of lines) {
    const stripped = line.replace(/\/\/.*$/, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const loopOpens = LOOP_PATTERNS.reduce((acc, p) => {
      const m = stripped.match(new RegExp(p.source, 'g'));
      return acc + (m ? m.length : 0);
    }, 0);
    const closes = (stripped.match(/\}/g) || []).length;

    depth += loopOpens;
    maxDepth = Math.max(maxDepth, depth);
    depth = Math.max(0, depth - closes);
  }
  return maxDepth;
}

function staticAnalysis(code) {
  const hasSort   = SORT_PATTERNS.some(p => p.test(code));
  const hasLog    = LOG_PATTERNS.some(p => p.test(code));
  const hasHash   = HASH_PATTERNS.some(p => p.test(code));
  const loopDepth = countLoopDepth(code);

  // Heuristic rules (priority order)
  if (loopDepth >= 3) return { notation: 'O(n³)', label: 'Cubic', confidence: 0.6 };
  if (loopDepth === 2) return { notation: 'O(n²)', label: 'Quadratic', confidence: 0.7 };
  if (loopDepth === 1 && hasSort) return { notation: 'O(n log n)', label: 'Linearithmic', confidence: 0.75 };
  if (loopDepth === 1 && hasLog)  return { notation: 'O(n log n)', label: 'Linearithmic', confidence: 0.65 };
  if (loopDepth === 1)            return { notation: 'O(n)', label: 'Linear', confidence: 0.8 };
  if (hasLog)                     return { notation: 'O(log n)', label: 'Logarithmic', confidence: 0.65 };
  if (hasHash && loopDepth === 0) return { notation: 'O(1)', label: 'Constant', confidence: 0.5 };
  return { notation: 'O(n)', label: 'Linear', confidence: 0.5 };
}

// ── Runtime curve fitting ─────────────────────────────────────────────────────

/**
 * Given pairs of (inputSize, time), fit to complexity classes and return best match.
 * Uses least-squares log-log regression.
 */
function runtimeAnalysis(inputSizes, times) {
  if (!inputSizes || inputSizes.length < 2) return null;

  // Filter out zeros
  const pairs = inputSizes
    .map((n, i) => [n, times[i]])
    .filter(([n, t]) => n > 0 && t > 0);

  if (pairs.length < 2) return null;

  // Log-log regression: log(t) = a * log(n) + b  →  slope a ≈ complexity exponent
  const logN = pairs.map(([n]) => Math.log(n));
  const logT = pairs.map(([, t]) => Math.log(t));

  const meanLogN = logN.reduce((a, b) => a + b, 0) / logN.length;
  const meanLogT = logT.reduce((a, b) => a + b, 0) / logT.length;

  const num = logN.reduce((acc, x, i) => acc + (x - meanLogN) * (logT[i] - meanLogT), 0);
  const den = logN.reduce((acc, x) => acc + (x - meanLogN) ** 2, 0);

  if (den === 0) return null;
  const slope = num / den;

  // Map slope to complexity class
  if (slope < 0.2)       return { notation: 'O(1)',      label: 'Constant',      confidence: 0.6 };
  if (slope < 0.7)       return { notation: 'O(log n)',  label: 'Logarithmic',   confidence: 0.65 };
  if (slope < 1.3)       return { notation: 'O(n)',      label: 'Linear',        confidence: 0.75 };
  if (slope < 1.7)       return { notation: 'O(n log n)',label: 'Linearithmic',  confidence: 0.7 };
  if (slope < 2.4)       return { notation: 'O(n²)',     label: 'Quadratic',     confidence: 0.7 };
  if (slope < 3.2)       return { notation: 'O(n³)',     label: 'Cubic',         confidence: 0.65 };
  return                        { notation: 'O(2ⁿ)',     label: 'Exponential',   confidence: 0.5 };
}

// ── Combine both ──────────────────────────────────────────────────────────────

/**
 * @param {string} code - source code
 * @param {number[]} times - execution times in seconds per test case
 * @param {number[]} inputSizes - size of input (e.g. n) per test case, optional
 * @returns {{ notation, label, confidence, method, spaceNotation }}
 */
function estimateComplexity(code, times, inputSizes) {
  const staticResult  = staticAnalysis(code);
  const runtimeResult = inputSizes ? runtimeAnalysis(inputSizes, times) : null;

  let result;
  let method;

  if (runtimeResult && runtimeResult.confidence >= staticResult.confidence) {
    // Runtime result is more confident — use it but cross-check with static
    if (runtimeResult.notation === staticResult.notation) {
      result = { ...runtimeResult, confidence: Math.min(0.95, runtimeResult.confidence + 0.1) };
      method = 'both';
    } else {
      // Disagree — pick higher confidence
      result = runtimeResult.confidence >= staticResult.confidence ? runtimeResult : staticResult;
      method = result === runtimeResult ? 'runtime' : 'static';
    }
  } else {
    result = staticResult;
    method = runtimeResult ? 'static' : 'static';
  }

  // Simple space complexity heuristic from static analysis
  const hasExtraArray = /new\s+\w+\[|vector\s*<|ArrayList|list\s*=\s*\[|\[\s*\]/.test(code);
  const hasHashStructure = HASH_PATTERNS.some(p => p.test(code));
  const spaceNotation = (hasExtraArray || hasHashStructure) ? 'O(n)' : 'O(1)';

  return { ...result, method, spaceNotation };
}

module.exports = { estimateComplexity };
