'use strict';

// Feature: judge0-integration, Property 7: Base64 round trip

const fc = require('fast-check');

// Validates: Requirements 5.5
describe('Property 7: Base64 round trip', () => {
  test('encoding a string to Base64 and decoding it returns the original string', () => {
    fc.assert(
      fc.property(fc.string({ unit: 'grapheme' }), (s) => {
        const encoded = Buffer.from(s).toString('base64');
        const decoded = Buffer.from(encoded, 'base64').toString('utf8');
        return decoded === s;
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 4: Judge0 status normalization

const { normalizeResult } = require('../judge0Client');

// Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7
describe('Property 4: Judge0 status normalization', () => {
  test('status id 3 always yields success with empty error', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.string(),
        fc.string(),
        (stdout, stderr, compileOutput) => {
          const response = {
            status: { id: 3, description: 'Accepted' },
            stdout: Buffer.from(stdout).toString('base64'),
            stderr: Buffer.from(stderr).toString('base64'),
            compile_output: Buffer.from(compileOutput).toString('base64'),
          };
          const result = normalizeResult(response);
          return result.status === 'success' && result.error === '';
        }
      ),
      { numRuns: 100 }
    );
  });

  test('non-3 status ids always yield error status with a string error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).filter((id) => id !== 3),
        fc.string(),
        fc.string(),
        fc.string(),
        (id, stdout, stderr, compileOutput) => {
          const response = {
            status: { id, description: 'Some Error' },
            stdout: Buffer.from(stdout).toString('base64'),
            stderr: Buffer.from(stderr).toString('base64'),
            compile_output: Buffer.from(compileOutput).toString('base64'),
          };
          const result = normalizeResult(response);
          return result.status === 'error' && typeof result.error === 'string';
        }
      ),
      { numRuns: 100 }
    );
  });

  test('status id 5 yields exactly "Time Limit Exceeded"', () => {
    const response = {
      status: { id: 5, description: 'Time Limit Exceeded' },
      stdout: null,
      stderr: null,
      compile_output: null,
    };
    const result = normalizeResult(response);
    expect(result.status).toBe('error');
    expect(result.error).toBe('Time Limit Exceeded');
  });

  test('status id 8 yields exactly "Memory Limit Exceeded"', () => {
    const response = {
      status: { id: 8, description: 'Memory Limit Exceeded' },
      stdout: null,
      stderr: null,
      compile_output: null,
    };
    const result = normalizeResult(response);
    expect(result.status).toBe('error');
    expect(result.error).toBe('Memory Limit Exceeded');
  });
});

// Feature: judge0-integration, Property 6: Output normalization equivalence

const { normalize } = require('../judge0Client');

// Validates: Requirements 4.5
describe('Property 6: Output normalization equivalence', () => {
  test('normalize(s) === normalize(s.trim()) for any string', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        return normalize(s) === normalize(s.trim());
      }),
      { numRuns: 100 }
    );
  });

  test('internal whitespace is collapsed: normalize("a  b") === normalize("a b")', () => {
    expect(normalize('a  b')).toBe(normalize('a b'));
  });
});

// Feature: judge0-integration, Property 10: Unexpected HTTP status includes status code

const { execute } = require('../judge0Client');

// Validates: Requirements 5.4
describe('Property 10: Unexpected HTTP status includes status code', () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test('error message contains the numeric HTTP status code for any unexpected status', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 202, max: 599 }), async (statusCode) => {
        global.fetch = jest.fn().mockResolvedValue({
          status: statusCode,
          json: async () => ({}),
        });

        let threw = false;
        try {
          await execute({ languageId: 71, sourceCode: 'print(1)', stdin: '' });
        } catch (err) {
          threw = true;
          if (!err.message.includes(String(statusCode))) {
            throw new Error(
              `Expected error message to contain "${statusCode}" but got: "${err.message}"`
            );
          }
        }

        if (!threw) {
          throw new Error(`Expected execute to throw for status ${statusCode} but it did not`);
        }
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: judge0-integration, Property 1: Language mapping completeness

const { LANGUAGE_IDS } = require('../judge0Client');

// Validates: Requirements 2.1
describe('Property 1: Language mapping completeness', () => {
  test('LANGUAGE_IDS contains exactly 5 entries', () => {
    expect(Object.keys(LANGUAGE_IDS).length).toBe(5);
  });

  test('each supported language maps to the correct Judge0 ID', () => {
    expect(LANGUAGE_IDS.c).toBe(50);
    expect(LANGUAGE_IDS.cpp).toBe(54);
    expect(LANGUAGE_IDS.python).toBe(71);
    expect(LANGUAGE_IDS.java).toBe(62);
    expect(LANGUAGE_IDS.javascript).toBe(63);
  });
});
