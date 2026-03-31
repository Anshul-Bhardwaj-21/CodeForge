const API_BASE = 'http://localhost:3000/api';

export const getProblems = async ({ difficulty, tag } = {}) => {
  const params = new URLSearchParams();
  if (difficulty && difficulty !== 'All') params.set('difficulty', difficulty);
  if (tag) params.set('tag', tag);
  const query = params.toString() ? `?${params.toString()}` : '';
  const res = await fetch(`${API_BASE}/problems${query}`);
  if (!res.ok) throw new Error('Failed to fetch problems');
  return res.json();
};

export const getProblemDetails = async (id) => {
  const res = await fetch(`${API_BASE}/problems/${id}`);
  if (!res.ok) throw new Error('Failed to fetch problem');
  return res.json();
};

/**
 * Open an SSE connection to /api/run-stream.
 * Calls onEvent(payload) for each server-sent event.
 * Returns a cleanup function that aborts the connection.
 */
export const runCodeStream = (language, code, input, onEvent) => {
  const params = new URLSearchParams({
    language,
    code,
    input: input || '',
  });

  const url = `${API_BASE}/run-stream?${params.toString()}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    try {
      const payload = JSON.parse(e.data);
      onEvent(payload);
      // Close the connection once execution is terminal
      if (payload.stage === 'completed' || payload.stage === 'error') {
        es.close();
      }
    } catch (_) {}
  };

  es.onerror = () => {
    onEvent({ stage: 'error', error: 'Connection to execution server lost.', status: 'error' });
    es.close();
  };

  // Return cleanup so callers can abort early (e.g. component unmount)
  return () => es.close();
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
  if (!res.ok) {
    // Try to get the actual error message from the server
    try {
      const body = await res.json();
      throw new Error(body.error || `Server error: ${res.status}`);
    } catch (e) {
      if (e.message !== `Server error: ${res.status}`) throw e;
      throw new Error(`Server error: ${res.status}`);
    }
  }
  return res.json();
};

export const getProgress = async () => {  const res = await fetch(`${API_BASE}/progress`);
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

export const getSubmissions = async () => {
  const res = await fetch(`${API_BASE}/submissions`);
  if (!res.ok) throw new Error('Failed to fetch submissions');
  return res.json();
};

export const getSubmission = async (id) => {
  const res = await fetch(`${API_BASE}/submissions/${id}`);
  if (!res.ok) throw new Error('Failed to fetch submission');
  return res.json();
};

export const replaySubmission = async (submissionId) => {
  const res = await fetch(`${API_BASE}/submissions/replay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ submissionId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Replay failed: ${res.status}`);
  }
  return res.json();
};

export const explainError = async ({ language, code, error, input }) => {
  const res = await fetch(`${API_BASE}/explain-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ language, code, error, input }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Explain failed: ${res.status}`);
  }
  return res.json();
};
