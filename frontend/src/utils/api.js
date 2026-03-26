const API_BASE = 'http://localhost:3000/api';

export const getProblems = async () => {
  const res = await fetch(`${API_BASE}/problems`);
  if (!res.ok) throw new Error('Failed to fetch problems');
  return res.json();
};

export const getProblemDetails = async (id) => {
  const res = await fetch(`${API_BASE}/problems/${id}`);
  if (!res.ok) throw new Error('Failed to fetch problem');
  return res.json();
};

export const runCode = async (language, code, input) => {
  const res = await fetch(`${API_BASE}/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, input })
  });
  if (!res.ok) throw new Error('Execution failed');
  return res.json();
};

export const submitCode = async (problemId, language, code) => {
  const res = await fetch(`${API_BASE}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId, language, code })
  });
  if (!res.ok) throw new Error('Submission failed');
  return res.json();
};

export const getProgress = async () => {
  const res = await fetch(`${API_BASE}/progress`);
  if (!res.ok) throw new Error('Failed to fetch progress');
  return res.json();
};

export const getProgressForProblem = async (id) => {
  const res = await fetch(`${API_BASE}/progress/${id}`);
  if (!res.ok) throw new Error('Failed to fetch progress for problem');
  return res.json();
};

export const recordSubmission = async (payload) => {
  const { problemId, language, verdict, timeTaken } = payload;
  const res = await fetch(`${API_BASE}/progress/submissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ problemId, language, verdict, timeTaken })
  });
  if (!res.ok) throw new Error('Failed to record submission');
  return res.json();
};
