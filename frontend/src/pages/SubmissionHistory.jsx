import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal, Code2, LayoutDashboard, History,
  CheckCircle2, XCircle, ChevronRight, RefreshCw,
  Loader2, AlertTriangle, Clock,
} from 'lucide-react';
import { getSubmissions, getSubmission, replaySubmission } from '../utils/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const VERDICT_STYLES = {
  accepted:            { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/25', label: 'Accepted' },
  wrong_answer:        { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/25', label: 'Wrong Answer' },
  runtime_error:       { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/25', label: 'Runtime Error' },
  time_limit_exceeded: { text: 'text-[#eab308]', bg: 'bg-[#eab308]/10', border: 'border-[#eab308]/25', label: 'TLE' },
};

function VerdictBadge({ verdict }) {
  const v = VERDICT_STYLES[verdict] ?? { text: 'text-[#64748b]', bg: 'bg-[#1e2d45]', border: 'border-[#2a3f5f]', label: verdict };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] font-semibold ${v.bg} ${v.border} ${v.text}`}>
      {verdict === 'accepted' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
      {v.label}
    </span>
  );
}

// ── Test case detail row ──────────────────────────────────────────────────────

function TestCaseRow({ tc }) {
  const [open, setOpen] = useState(!tc.passed);
  return (
    <div className={`rounded-xl border ${tc.passed ? 'border-[#22c55e]/20 bg-[#22c55e]/5' : 'border-[#ef4444]/25 bg-[#ef4444]/5'}`}>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          {tc.passed
            ? <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
            : <XCircle className="w-4 h-4 text-[#ef4444]" />}
          <span className={`text-sm font-semibold ${tc.passed ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}>
            Test Case {tc.testCaseNumber}
          </span>
        </div>
        <ChevronRight className={`w-4 h-4 text-[#475569] transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-[#1e2d45]/60 pt-3">
          <div>
            <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">Input</span>
            <pre className="bg-[#0a0f1e] border border-[#1e2d45] rounded-lg px-3 py-2 text-[13px] font-mono text-[#cbd5e1] whitespace-pre-wrap">{tc.input}</pre>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">Expected</span>
              <pre className="bg-[#0a0f1e] border border-[#1e2d45] rounded-lg px-3 py-2 text-[13px] font-mono text-[#22c55e] whitespace-pre-wrap min-h-[36px]">{tc.expectedOutput}</pre>
            </div>
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">Got</span>
              <pre className={`bg-[#0a0f1e] border rounded-lg px-3 py-2 text-[13px] font-mono whitespace-pre-wrap min-h-[36px] ${tc.passed ? 'border-[#1e2d45] text-[#22c55e]' : 'border-[#ef4444]/30 text-[#f87171]'}`}>
                {tc.actualOutput || (tc.error ? <span className="text-[#f87171]">{tc.error}</span> : <span className="text-[#475569] italic">empty</span>)}
              </pre>
            </div>
          </div>
          {tc.error && !tc.passed && (
            <div>
              <span className="text-[10px] font-bold text-[#ef4444] uppercase tracking-wider block mb-1">Error</span>
              <pre className="bg-[#ef4444]/10 border border-[#ef4444]/25 rounded-lg px-3 py-2 text-[13px] font-mono text-[#f87171] whitespace-pre-wrap">{tc.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function SubmissionDetail({ submissionId, onClose }) {
  const [sub, setSub] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setReplayResult(null);
    setError(null);
    getSubmission(submissionId)
      .then(setSub)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [submissionId]);

  const handleReplay = useCallback(async () => {
    setReplaying(true);
    setReplayResult(null);
    try {
      const result = await replaySubmission(submissionId);
      setReplayResult(result);
    } catch (e) {
      setError(e.message);
    } finally {
      setReplaying(false);
    }
  }, [submissionId]);

  const display = replayResult || sub;

  return (
    <div className="flex flex-col h-full bg-[#0d1424] border-l border-[#1e2d45]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2d45] bg-[#0a0f1e]/60 shrink-0">
        <div>
          <h3 className="text-sm font-bold text-white">{sub?.problemTitle ?? 'Submission Detail'}</h3>
          {sub && <p className="text-[11px] text-[#475569] mt-0.5 font-mono">{sub.language} · {relativeTime(sub.timestamp)}</p>}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleReplay}
            disabled={replaying || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] hover:bg-[#2563eb] text-white text-xs font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {replaying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Replay
          </button>
          <button onClick={onClose} className="text-[#475569] hover:text-white transition-colors text-lg leading-none px-1">×</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading && (
          <div className="flex items-center justify-center py-16 text-[#3b82f6]">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444] rounded-xl px-4 py-3 text-sm">
            <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {display && !loading && (
          <>
            {/* Summary */}
            <div className="flex items-center gap-3 bg-[#0a0f1e] border border-[#1e2d45] rounded-xl px-5 py-4">
              <VerdictBadge verdict={display.verdict} />
              <span className="text-sm font-bold text-white font-mono">
                {display.passed} / {display.total} passed
              </span>
              {replayResult && (
                <span className="ml-auto text-[11px] text-[#3b82f6] font-semibold bg-[#3b82f6]/10 border border-[#3b82f6]/25 px-2 py-0.5 rounded">
                  Replayed
                </span>
              )}
            </div>

            {/* Code */}
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-2">Code</span>
              <pre className="bg-[#0a0f1e] border border-[#1e2d45] rounded-xl px-4 py-3 text-[13px] font-mono text-[#cbd5e1] whitespace-pre-wrap overflow-x-auto max-h-64">{display.code}</pre>
            </div>

            {/* Test cases */}
            <div>
              <span className="text-[10px] font-bold text-[#64748b] uppercase tracking-wider block mb-3">Test Cases</span>
              <div className="space-y-2">
                {(display.details || []).map((tc, i) => (
                  <TestCaseRow key={i} tc={tc} />
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SubmissionHistory() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    getSubmissions()
      .then(setSubmissions)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e5e7eb] font-sans flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 flex items-center px-6 py-3 bg-[#0d1424]/95 backdrop-blur border-b border-[#1e2d45] shadow-lg shadow-black/30 shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 mr-3 shadow-lg shadow-blue-500/30">
          <Terminal className="w-4 h-4 text-white" />
        </div>
        <Link to="/" className="text-xl font-bold text-white tracking-tight hover:text-blue-400 transition-colors">CodeForge</Link>
        <span className="ml-2.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest bg-[#1e2d45] text-[#64748b] border border-[#2a3f5f] uppercase">DSA</span>
        <nav className="ml-auto flex items-center gap-1">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#64748b] hover:text-white hover:bg-[#1e2d45] transition-all">
            <Code2 className="w-3.5 h-3.5" /> Problems
          </Link>
          <Link to="/profile" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#64748b] hover:text-white hover:bg-[#1e2d45] transition-all">
            <LayoutDashboard className="w-3.5 h-3.5" /> Profile
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#1e2d45] border border-[#2a3f5f]">
            <History className="w-3.5 h-3.5 text-violet-400" /> History
          </span>
        </nav>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Submission list */}
        <div className={`flex flex-col ${selectedId ? 'w-[40%]' : 'w-full max-w-4xl mx-auto'} overflow-y-auto`}>
          <div className="px-6 py-6">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-violet-400 to-blue-400" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Submission History</h2>
            </div>
            <p className="text-[#475569] text-sm ml-3">{submissions.length} submissions</p>
          </div>

          {error && (
            <div className="mx-6 flex items-center gap-2 bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444] rounded-xl px-4 py-3 text-sm mb-4">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-20 text-[#3b82f6]">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {!loading && submissions.length === 0 && !error && (
            <div className="flex flex-col items-center justify-center py-20 text-[#2a3f5f]">
              <History className="w-10 h-10 mb-3" />
              <p className="text-sm">No submissions yet. Submit a solution to see history here.</p>
            </div>
          )}

          {!loading && submissions.length > 0 && (
            <div className="px-6 pb-6">
              <div className="bg-[#0d1424] border border-[#1e2d45] rounded-xl overflow-hidden">
                {/* Table header */}
                <div className="grid grid-cols-[1fr_7rem_6rem_7rem] gap-0 px-5 py-3 bg-[#0a0f1e] border-b border-[#1e2d45]">
                  <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Problem</div>
                  <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Verdict</div>
                  <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Score</div>
                  <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">When</div>
                </div>
                <div className="divide-y divide-[#1e2d45]/60">
                  {submissions.map(sub => (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedId(sub.id === selectedId ? null : sub.id)}
                      className={`w-full grid grid-cols-[1fr_7rem_6rem_7rem] gap-0 px-5 py-3.5 items-center text-left transition-colors hover:bg-[#111827]/60 ${sub.id === selectedId ? 'bg-[#111827]/80 border-l-2 border-l-blue-500' : ''}`}
                    >
                      <div>
                        <Link
                          to={`/problems/${sub.problemId}`}
                          onClick={e => e.stopPropagation()}
                          className="text-sm font-semibold text-[#cbd5e1] hover:text-white transition-colors"
                        >
                          {sub.problemTitle}
                        </Link>
                        <div className="text-[11px] text-[#475569] font-mono mt-0.5">{sub.language}</div>
                      </div>
                      <div><VerdictBadge verdict={sub.verdict} /></div>
                      <div className="text-sm font-mono text-[#94a3b8]">{sub.passed}/{sub.total}</div>
                      <div className="flex items-center gap-1 text-[11px] text-[#475569]">
                        <Clock className="w-3 h-3" />{relativeTime(sub.timestamp)}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedId && (
          <div className="flex-1 overflow-hidden">
            <SubmissionDetail
              submissionId={selectedId}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
