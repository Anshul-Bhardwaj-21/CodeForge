# CodeForge DSA

A premium, developer-focused DSA practice platform. Write and execute code directly in the browser with a VS Code-inspired dark theme interface.

![CodeForge DSA](https://img.shields.io/badge/CodeForge-DSA-blue?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![Node.js](https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?style=flat-square&logo=tailwindcss)

## Features

- Monaco Editor (VS Code's editor engine) with `vs-dark` theme
- Multi-language support: C++, Python, Java
- Real-time code execution with custom input
- Submit against test cases with detailed pass/fail breakdown
- Problem browser with search and difficulty filter
- Premium dark theme UI — built for long coding sessions

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4, Monaco Editor |
| Backend | Node.js, Express |
| Testing | Vitest, Testing Library, fast-check (property-based) |

## Project Structure

```
CodeForge DSA/
├── frontend/          # React app (Vite + Tailwind v4)
│   └── src/
│       ├── components/    # ProblemPanel, EditorPanel, ExecutionPanel
│       ├── pages/         # ProblemList, Workspace
│       └── utils/         # API helpers
├── backend/           # Express API server
│   └── routes/            # /api/run, /api/submit, /api/problems
└── data/
    └── problems/          # Problem definitions (JSON)
```

## Getting Started

### Prerequisites

- Node.js 18+
- Docker and Docker Compose — for running the Judge0 code execution service

### Installation

```bash
# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd frontend && npm install
```

### Running Locally

**Judge0 Code Execution** (port 2358):
```bash
# Start the Judge0 stack (Judge0 server, worker, Redis, Postgres)
docker compose up -d

# Stop the stack
docker compose down
```

Judge0 will be accessible at `http://localhost:2358`.

**Backend** (port 3000):
```bash
cd backend && node index.js
```

**Frontend** (port 5173):
```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Running Tests

```bash
cd frontend && npm test
```

## Roadmap

- [x] Judge0 integration — real sandboxed compiler execution (GCC, CPython, OpenJDK, Node.js)
- [ ] User authentication
- [ ] DSA progress tracker with heatmap and topic breakdown
- [ ] AI-powered hints and complexity analysis
- [ ] Personalized problem recommendations
- [ ] Streaks and daily challenges
- [ ] Company tag filters

## License

MIT
