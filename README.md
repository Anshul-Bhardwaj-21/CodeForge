# CodeForge DSA

> A full-stack, browser-based Data Structures & Algorithms practice platform with real sandboxed code execution, test case evaluation, and submission tracking — built as a production-grade engineering project.

![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![Judge0](https://img.shields.io/badge/Judge0-1.13.1-orange?style=flat-square)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker)
![Tailwind](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss)

---

## Table of Contents

- [Project Overview](#project-overview)
- [System Architecture](#system-architecture)
- [Execution Flow](#execution-flow)
- [Backend Design](#backend-design)
- [Frontend Design](#frontend-design)
- [API Documentation](#api-documentation)
- [Code Execution System](#code-execution-system)
- [Testing Strategy](#testing-strategy)
- [Setup Instructions](#setup-instructions)
- [Future Roadmap](#future-roadmap)

---

## Project Overview

### What Problem It Solves

Most self-hosted coding platforms either rely on unsafe `child_process` execution (spawning system compilers directly) or depend on third-party APIs with rate limits and data privacy concerns. CodeForge solves this by integrating a **self-hosted Judge0 instance** — an open-source, Docker-based code execution engine — as the sandboxed runtime backend.

The result is a platform where:
- Code runs in fully isolated containers with resource limits (CPU, memory, time)
- The frontend API contract is clean and stable — no execution logic leaks into the UI layer
- The backend is a thin, well-tested proxy that translates HTTP requests into Judge0 submissions

### Key Capabilities

- Write and execute code with custom stdin input
- Submit solutions against sample and hidden test cases
- Per-test-case pass/fail breakdown with actual vs expected output diff
- Heuristic time complexity estimation combining static analysis and runtime curve fitting
- Submission history tracking with verdict classification (Accepted, Wrong Answer, Runtime Error, TLE)
- Multi-language support: C++, Python, Java, JavaScript

### Why This Project Is Technically Interesting

- **Sandboxed execution pipeline**: Code never touches the host OS. Judge0 runs each submission in an isolated container with configurable CPU/memory/time limits.
- **Base64 transport layer**: All code and I/O is Base64-encoded over the Judge0 REST API to safely handle special characters, newlines, and binary data.
- **Dual complexity analysis**: `complexityAnalyzer.js` combines static AST-level loop depth analysis with log-log regression on actual runtime measurements to estimate Big-O.
- **Property-based testing**: Uses `fast-check` to verify correctness invariants across hundreds of generated inputs — not just hand-written examples.
- **Zero frontend changes on backend swap**: The entire execution backend was replaced (from `child_process` to Judge0) without modifying a single line of frontend code.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│                                                                 │
│  ProblemList ──► Workspace                                      │
│                    ├── ProblemPanel   (problem statement)       │
│                    ├── EditorPanel    (Monaco Editor)           │
│                    └── ExecutionPanel (run / submit / results)  │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP (fetch)
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Express Backend (:3000)                       │
│                                                                 │
│  POST /api/run      ──► routes/execute.js                       │
│  POST /api/submit   ──► routes/submit.js                        │
│  GET  /api/problems ──► routes/problems.js                      │
│  GET  /api/progress ──► routes/progress.js                      │
│                                                                 │
│                    judge0Client.js (HTTP proxy layer)           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP POST /submissions?wait=true
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Judge0 Docker Stack (:2358)                     │
│                                                                 │
│  judge0-server  ◄──► judge0-worker                              │
│       │                    │                                    │
│     Redis              PostgreSQL                               │
│  (job queue)         (submission store)                         │
│                            │                                    │
│                    Isolated Container                           │
│               (GCC / CPython / OpenJDK / Node.js)              │
└─────────────────────────────────────────────────────────────────┘
```

**Data directory** (`data/problems/*.json`) is read directly by the backend at submission time — no database required for problem definitions.

---

## Execution Flow

### A) Running Code (`POST /api/run`)

Used when the user clicks "Run" with optional custom stdin.

```
1. User clicks Run in ExecutionPanel
2. Frontend calls POST /api/run { language, code, input }
3. routes/execute.js validates:
   - language and code are present → 400 if missing
   - language exists in LANGUAGE_IDS map → 400 if unsupported
4. Calls judge0Client.execute({ languageId, sourceCode: code, stdin: input })
5. judge0Client:
   a. Base64-encodes source_code and stdin
   b. POSTs to Judge0: POST /submissions?base64_encoded=true&wait=true
   c. Judge0 queues the job via Redis, worker picks it up
   d. Worker compiles + executes in an isolated container
   e. Judge0 returns result synchronously (wait=true)
   f. judge0Client decodes Base64 stdout/stderr/compile_output
   g. Maps Judge0 status ID → normalized { output, error, status }
6. routes/execute.js returns { output, error, status } to frontend
7. ExecutionPanel renders the output
```

### B) Submitting Code (`POST /api/submit`)

Used when the user clicks "Submit" to evaluate against all test cases.

```
1. User clicks Submit in ExecutionPanel
2. Frontend calls POST /api/submit { language, code, problemId }
3. routes/submit.js validates language, code, problemId → 400 if missing
4. Loads problem JSON from data/problems/<problemId>.json → 404 if not found
5. Merges sample_test_cases + hidden_test_cases into a single array
6. For each test case (sequential loop):
   a. Calls judge0Client.execute({ languageId, sourceCode, stdin: testCase.input })
   b. Normalizes actual output: trim + collapse whitespace
   c. Compares normalize(actual) === normalize(expected)
   d. Records { testCaseNumber, passed, input, expectedOutput, actualOutput, error, status, time, memory }
   e. If judge0Client throws a connectivity error → re-throws (caught by outer handler → 503)
   f. If judge0Client throws any other error → records test case as failed, continues loop
7. After all test cases:
   a. Computes avgTime, maxTime across successful executions
   b. Extracts input sizes (first integer token per test case input)
   c. Calls estimateComplexity(code, times, inputSizes)
8. Returns { passed, total, details, performance: { avgTime, maxTime, times, complexity } }
9. Workspace.jsx records the submission verdict via POST /api/progress/submissions
```

---

## Backend Design

### `judge0Client.js`

The single module responsible for all Judge0 HTTP communication. Routes never call Judge0 directly.

**Responsibilities:**
- Maintains `LANGUAGE_IDS` map: `{ cpp: 54, python: 71, java: 62, javascript: 63 }`
- Reads `JUDGE0_URL` from environment (default: `http://localhost:2358`)
- Base64-encodes `source_code` and `stdin` before sending — required by Judge0's `base64_encoded=true` mode to safely transport arbitrary code containing quotes, backslashes, and Unicode
- Decodes `stdout`, `stderr`, `compile_output` from the response using `Buffer.from(val, 'base64').toString('utf8')`
- Implements `normalizeResult(response)` which maps Judge0 status IDs to a consistent internal shape:

| Judge0 Status ID | Meaning | Normalized Result |
|---|---|---|
| 3 | Accepted | `{ status: "success", output: stdout, error: "" }` |
| 5 | Time Limit Exceeded | `{ status: "error", output: "", error: "Time Limit Exceeded" }` |
| 6 | Compilation Error | `{ status: "error", output: "", error: compile_output }` |
| 8 | Memory Limit Exceeded | `{ status: "error", output: "", error: "Memory Limit Exceeded" }` |
| all others | Runtime Error / other | `{ status: "error", output: stdout, error: stderr \|\| compile_output \|\| description }` |

- Exports `normalize(str)` helper: `str == null ? "" : String(str).trim().replace(/\s+/g, " ")` — used by `submit.js` for output comparison
- Handles connectivity failures: detects `ECONNREFUSED` in error code or message, throws with a descriptive message that routes use to return 503
- Supports polling fallback for hosted Judge0 instances that don't support `wait=true`

### `routes/execute.js`

Thin validation + delegation layer for `/api/run`. Validates input, delegates to `judge0Client`, maps connectivity errors to 503 and all others to 500.

### `routes/submit.js`

Orchestrates multi-test-case evaluation. Calls `judge0Client.execute` directly per test case (not via internal HTTP to `/api/run`) to avoid unnecessary network round-trips. Implements per-test-case error isolation — a single failing Judge0 call does not abort the entire submission. Also invokes `estimateComplexity` after all test cases complete.

### `routes/problems.js`

Reads problem definitions from `data/problems/*.json` at request time. Each JSON file contains: `id`, `title`, `difficulty`, `tags`, `description`, `examples`, `constraints`, `boilerplates`, and `test_cases` (split into `sample_test_cases` and `hidden_test_cases`).

### `routes/progress.js`

Persists submission history to `data/progress.json`. Tracks per-problem verdict history, solve status (`solved` / `attempted` / `unseen`), and timestamps. Exposes endpoints for reading global progress and per-problem status.

### `complexityAnalyzer.js`

Dual-mode heuristic complexity estimator:

**Static analysis** — scans source code for:
- Loop nesting depth (counts `for`/`while`/`do` blocks, tracks `{` / `}` depth)
- Sort calls (`.sort(`, `Arrays.sort`, `sorted(`, `heapq.`)
- Binary search patterns (`mid = ... / 2`, bit shifts, `Math.log`)
- Hash structure usage (`HashMap`, `dict`, `unordered_map`)

**Runtime curve fitting** — when input sizes are available:
- Performs log-log linear regression on `(log(inputSize), log(executionTime))` pairs
- The slope of the regression line approximates the complexity exponent
- Slope < 0.2 → O(1), slope ~1.0 → O(n), slope ~2.0 → O(n²), etc.

**Combination logic**: if runtime confidence ≥ static confidence and both agree, confidence is boosted. If they disagree, the higher-confidence result wins. Method is tagged as `"both"`, `"runtime"`, or `"static"`.

Also estimates space complexity from static patterns: presence of array allocations or hash structures → O(n), otherwise O(1).

---

## Frontend Design

### `Workspace.jsx`

The top-level page component for the coding environment. Manages all shared state:
- `language` / `code` — editor state, language persisted to `localStorage`
- `outputData` / `submitResult` — execution and submission results
- `isLoading` — controls loading states across panels
- `solvedStatus` — fetched from `/api/progress/:id` on mount, updated optimistically after accepted submissions

Implements `onSubmitComplete` which classifies the verdict (`accepted`, `wrong_answer`, `runtime_error`, `time_limit_exceeded`) and calls `recordSubmission`. Prevents double-counting: if a problem is already `solved`, subsequent accepted submissions are not re-recorded.

Layout: three-panel flex row — ProblemPanel (30%), EditorPanel (40%), ExecutionPanel (30%).

### `EditorPanel.jsx`

Wraps the Monaco Editor (`@monaco-editor/react`) with:
- Language selector that triggers boilerplate injection on first switch
- Per-problem, per-language code persistence in `localStorage` (key: `cf_code_{problemId}_{language}`)
- Editor options: `vs-dark` theme, font size 14, minimap disabled, smooth scrolling

### `ExecutionPanel.jsx`

Handles both Run and Submit interactions:
- Run: calls `runCode(language, code, customInput)` from `api.js`, displays `{ output, error, status }`
- Submit: calls `submitCode(problemId, language, code)`, renders per-test-case results with pass/fail indicators, shows performance metrics (avg time, complexity estimate)
- Editable custom input textarea pre-populated with the first example input from the problem

### `ProblemPanel.jsx`

Renders problem metadata and statement:
- Difficulty badge with color coding (green/yellow/red for Easy/Medium/Hard)
- Tag chips for DSA topic classification
- Problem description rendered via `ReactMarkdown` (supports LaTeX-style constraints)
- Example blocks with input/output/explanation in monospace code boxes
- Solved/Attempted status badge sourced from Workspace state

---

## API Documentation

### `POST /api/run`

Execute code with optional stdin.

**Request:**
```json
{
  "language": "python",
  "code": "print(input())",
  "input": "hello world"
}
```

**Response (200):**
```json
{
  "output": "hello world",
  "error": "",
  "status": "success"
}
```

**Error responses:** `400` missing fields / unsupported language, `503` Judge0 unreachable, `500` internal error

---

### `POST /api/submit`

Evaluate code against all test cases for a problem.

**Request:**
```json
{
  "language": "cpp",
  "code": "...",
  "problemId": "1"
}
```

**Response (200):**
```json
{
  "passed": 3,
  "total": 4,
  "details": [
    {
      "testCaseNumber": 1,
      "passed": true,
      "input": "2\n1 2",
      "expectedOutput": "3",
      "actualOutput": "3",
      "error": "",
      "status": "success",
      "time": "0.042",
      "memory": 3380
    }
  ],
  "performance": {
    "avgTime": 0.044,
    "maxTime": 0.051,
    "times": [0.042, 0.046],
    "complexity": {
      "notation": "O(n)",
      "label": "Linear",
      "confidence": 0.8,
      "method": "static",
      "spaceNotation": "O(1)"
    }
  }
}
```

**Error responses:** `400` missing/invalid fields, `404` problem not found, `503` Judge0 unreachable

---

### `GET /api/problems`

Returns array of all problems (metadata only, no test cases).

**Response (200):**
```json
[
  { "id": 1, "title": "Two Sum", "difficulty": "Easy", "tags": ["Array", "Hash Table"] }
]
```

---

### `GET /api/problems/:id`

Returns full problem object including examples, constraints, and boilerplates. Does not include hidden test cases.

---

### `GET /api/progress`

Returns aggregated submission history across all problems.

---

### `GET /api/progress/:problemId`

Returns solve status for a specific problem: `{ status: "solved" | "attempted" | "unseen" }`.

---

### `POST /api/progress/submissions`

Records a submission verdict.

**Request:**
```json
{
  "problemId": "1",
  "language": "python",
  "verdict": "accepted",
  "timeTaken": 1240
}
```

---

## Code Execution System

### How Judge0 Works

Judge0 is an open-source code execution system that runs submissions in isolated Linux containers using kernel-level isolation primitives.

**Docker Compose stack (4 services):**

| Service | Role |
|---|---|
| `judge0-server` | REST API server, accepts submission requests, returns results |
| `judge0-worker` | Pulls jobs from Redis queue, spawns isolated execution containers |
| `redis` | Message broker between server and worker |
| `postgres` | Persistent store for submission records and tokens |

**Execution lifecycle:**
1. `judge0-server` receives `POST /submissions?wait=true`
2. Job is enqueued in Redis
3. `judge0-worker` dequeues the job and spawns an isolated container with the target language runtime (GCC for C++, CPython for Python, OpenJDK for Java, Node.js for JavaScript)
4. Container runs with configurable limits: CPU time, wall clock time, memory, process count, file size
5. stdout, stderr, and compile_output are captured and Base64-encoded in the response
6. With `wait=true`, the server holds the HTTP connection open until execution completes (synchronous mode — no polling needed for local instances)

**Why Base64?** Judge0 uses Base64 encoding for all code and I/O fields to safely transport arbitrary text over JSON — avoiding issues with escape sequences, null bytes, and multi-line strings.

**Isolation guarantees:**
- No network access inside the container
- No filesystem access outside the sandbox
- Resource limits enforced at the kernel level (cgroups)
- Each submission runs in a fresh container — no state leaks between runs

---

## Testing Strategy

### Unit Tests (Jest / Vitest)

Backend unit tests use `jest.mock` to isolate `judge0Client` from real HTTP calls. Each route is tested independently:

- `execute.test.js`: 400 on missing `language`/`code`, 400 on unknown language, 503 on connectivity error, correct response shape on success
- `submit.test.js`: 400/404 validation, correct `passed`/`total`/`details` aggregation, resilience when individual test cases throw
- `judge0Client` unit tests: Base64 encode/decode correctness, status normalization for each Judge0 status ID, error thrown on non-200/201 response, error thrown on network failure

Frontend unit tests use Vitest + Testing Library to verify component rendering and interaction behavior.

### Property-Based Tests (fast-check)

`fast-check` is used to verify correctness invariants that hold across all valid inputs — not just the specific cases a developer thinks to write.

**Why fast-check over example-based tests?**
Example-based tests verify behavior for inputs you anticipate. Property-based tests generate hundreds of random inputs and assert that invariants always hold — catching edge cases like empty strings, Unicode characters, extreme integers, and unexpected whitespace that manual tests miss.

**10 properties verified across the codebase:**

| Property | What It Verifies | Generator |
|---|---|---|
| P1: Language mapping completeness | All 4 languages map to correct Judge0 IDs | Enumerate supported languages |
| P2: Unsupported language rejection | Any unknown language → HTTP 400 | `fc.string()` filtered to exclude supported |
| P3: /api/run response shape | Response always has `output`, `error`, `status` | `fc.record({ language, code, input })` |
| P4: Judge0 status normalization | Status ID 3 → success; all others → error with non-empty message | `fc.integer({ min: 1, max: 20 })` |
| P5: /api/submit response shape | Response always has `passed`, `total`, `details` array | `fc.record(...)` with mocked client |
| P6: Output normalization equivalence | `normalize(s) === normalize(s.trim())` for any string | `fc.string()` |
| P7: Base64 round trip | `decode(encode(s)) === s` for any UTF-8 string | `fc.string()` including Unicode |
| P8: Missing required fields → 400 | Omitting any required field always returns 400 | `fc.record(...)` with randomly omitted fields |
| P9: Test case resilience | Failed test cases have `passed: false` with non-empty `error` | `fc.array(fc.boolean())` |
| P10: Unexpected HTTP status in error | Error message always contains the numeric status code | `fc.integer({ min: 202, max: 599 })` |

All property tests run a minimum of 100 iterations and make no real HTTP calls — Judge0 is fully mocked.

**Running tests:**
```bash
# Backend (Jest)
cd backend && npm test

# Frontend (Vitest)
cd frontend && npm test
```

---

## Setup Instructions

### Prerequisites

- Node.js 18+
- Docker and Docker Compose

### 1. Start Judge0 (code execution backend)

```bash
# From project root
docker compose up -d
```

This starts 4 containers: `judge0-server` (port 2358), `judge0-worker`, `redis`, and `postgres`.

Verify Judge0 is running:
```bash
curl http://localhost:2358/system_info
```

Stop the stack:
```bash
docker compose down
```

### 2. Backend

```bash
cd backend
npm install
node index.js
# Server starts on http://localhost:3000
```

Optional: set a custom Judge0 URL via environment variable:
```bash
JUDGE0_URL=http://localhost:2358 node index.js
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Dev server starts on http://localhost:5173
```

Open [http://localhost:5173](http://localhost:5173).

### Project Structure

```
CodeForge/
├── frontend/
│   └── src/
│       ├── components/        # EditorPanel, ExecutionPanel, ProblemPanel
│       ├── pages/             # ProblemList, Workspace, Profile
│       └── utils/             # api.js, progressStats.js
├── backend/
│   ├── routes/                # execute.js, submit.js, problems.js, progress.js
│   ├── judge0Client.js        # Judge0 HTTP proxy layer
│   ├── complexityAnalyzer.js  # Static + runtime complexity estimation
│   └── __tests__/             # Unit + property-based tests
├── data/
│   └── problems/              # Problem definitions (JSON)
└── docker-compose.yml         # Judge0 stack
```

---

## Future Roadmap

### AI Integration
- AI-powered hints: analyze the user's code and provide targeted hints without revealing the solution
- Natural language problem search using embeddings
- Automated editorial generation from accepted solutions

### Performance Improvements
- Replace synchronous `wait=true` with async token polling + Server-Sent Events for real-time execution status streaming
- Redis-backed submission queue on the Express side for concurrent submission handling
- Problem data migration from JSON files to PostgreSQL for filtering, pagination, and full-text search

### Advanced Features
- User authentication with OAuth (GitHub/Google) and per-user submission history
- Company tag filters and curated problem lists
- Streak tracking, daily challenges, and XP system
- Side-by-side solution comparison and editorial viewer
- Contest mode with timed problem sets and live leaderboard
- Support for additional languages (Rust, Go, C#, TypeScript)
