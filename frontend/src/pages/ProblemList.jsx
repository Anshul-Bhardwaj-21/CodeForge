import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProblems, getProgress } from '../utils/api';
import { Terminal, Search, CheckCircle2, Circle, MinusCircle, LayoutDashboard, Code2, Filter } from 'lucide-react';

const DIFFICULTY_CONFIG = {
  Easy:   { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/25', dot: 'bg-[#22c55e]' },
  Medium: { text: 'text-[#eab308]', bg: 'bg-[#eab308]/10', border: 'border-[#eab308]/25', dot: 'bg-[#eab308]' },
  Hard:   { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/25', dot: 'bg-[#ef4444]' },
};

export default function ProblemList() {
  const [problems, setProblems] = useState([]);
  const [progress, setProgress] = useState({});
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');

  useEffect(() => {
    getProblems().then(setProblems).catch(console.error);
    getProgress()
      .then(data => setProgress(data.problems || {}))
      .catch(() => {}); // non-critical
  }, []);

  const filtered = problems.filter(p => {
    const matchSearch =
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
    return matchSearch && matchDiff;
  });

  const counts = { Easy: 0, Medium: 0, Hard: 0 };
  problems.forEach(p => { if (counts[p.difficulty] !== undefined) counts[p.difficulty]++; });

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e5e7eb] font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center px-6 py-3 bg-[#0d1424]/95 backdrop-blur border-b border-[#1e2d45] shadow-lg shadow-black/30">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 mr-3 shadow-lg shadow-blue-500/30">
          <Terminal className="w-4 h-4 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">CodeForge</span>
        <span className="ml-2.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest bg-[#1e2d45] text-[#64748b] border border-[#2a3f5f] uppercase">DSA</span>

        <nav className="ml-auto flex items-center gap-1">
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#1e2d45] border border-[#2a3f5f]">
            <Code2 className="w-3.5 h-3.5 text-blue-400" />
            Problems
          </span>
          <Link to="/profile" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#64748b] hover:text-white hover:bg-[#1e2d45] transition-all">
            <LayoutDashboard className="w-3.5 h-3.5" />
            Profile
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        {/* ── Hero row ── */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-400 to-teal-400" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Problem Set</h2>
            </div>
            <p className="text-[#64748b] text-sm ml-3">
              {problems.length} problems · sharpen your algorithms
            </p>
          </div>

          {/* Difficulty pills */}
          <div className="flex gap-3 ml-3">
            {Object.entries(counts).map(([diff, count]) => {
              const c = DIFFICULTY_CONFIG[diff];
              return (
                <div key={diff} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${c.bg} ${c.border} ${c.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                  {diff} <span className="opacity-60">·</span> {count}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Filter bar ── */}
        <div className="flex gap-3 mb-5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#475569]" />
            <input
              type="text"
              placeholder="Search problems or tags..."
              className="w-full pl-9 pr-4 py-2 bg-[#0d1424] border border-[#1e2d45] rounded-lg text-sm text-[#e5e7eb] placeholder-[#475569] focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/20 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-1.5 bg-[#0d1424] border border-[#1e2d45] rounded-lg px-1 py-1">
            <Filter className="w-3.5 h-3.5 text-[#475569] ml-2" />
            {['All', 'Easy', 'Medium', 'Hard'].map(d => (
              <button
                key={d}
                onClick={() => setDifficultyFilter(d)}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                  difficultyFilter === d
                    ? d === 'All'
                      ? 'bg-[#1e2d45] text-white'
                      : `${DIFFICULTY_CONFIG[d]?.bg} ${DIFFICULTY_CONFIG[d]?.text} border ${DIFFICULTY_CONFIG[d]?.border}`
                    : 'text-[#64748b] hover:text-[#94a3b8]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* ── Problem table ── */}
        <div className="bg-[#0d1424] border border-[#1e2d45] rounded-xl overflow-hidden shadow-xl shadow-black/20">
          {/* Table header */}
          <div className="grid grid-cols-[2rem_1fr_7rem_1fr] gap-0 px-5 py-3 bg-[#0a0f1e] border-b border-[#1e2d45]">
            <div />
            <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Title</div>
            <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider">Difficulty</div>
            <div className="text-[11px] font-semibold text-[#475569] uppercase tracking-wider hidden md:block">Tags</div>
          </div>

          <div className="divide-y divide-[#1e2d45]/60">
            {filtered.map((problem, idx) => {
              const c = DIFFICULTY_CONFIG[problem.difficulty] ?? {};
              return (
                <div
                  key={problem.id}
                  className="grid grid-cols-[2rem_1fr_7rem_1fr] gap-0 px-5 py-4 items-center hover:bg-[#111827]/60 transition-colors group"
                >
                  {/* Status icon */}
                  <div className="flex items-center">
                    {progress[problem.id]?.status === 'solved' ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22c55e]" />
                    ) : progress[problem.id]?.status === 'attempted' ? (
                      <MinusCircle className="w-4 h-4 text-[#eab308]" />
                    ) : (
                      <Circle className="w-4 h-4 text-[#2a3f5f] group-hover:text-[#3b82f6]/40 transition-colors" />
                    )}
                  </div>

                  {/* Title */}
                  <div className="pr-4">
                    <Link
                      to={`/problems/${problem.id}`}
                      className="text-sm font-semibold text-[#cbd5e1] hover:text-white transition-colors group-hover:text-white"
                    >
                      <span className="text-[#475569] mr-2 font-mono text-xs">{String(problem.id).padStart(2, '0')}.</span>
                      {problem.title}
                    </Link>
                  </div>

                  {/* Difficulty */}
                  <div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg} ${c.border} ${c.text}`}>
                      <span className={`w-1 h-1 rounded-full ${c.dot}`} />
                      {problem.difficulty}
                    </span>
                  </div>

                  {/* Tags */}
                  <div className="hidden md:flex gap-1.5 flex-wrap">
                    {problem.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="text-[11px] px-2 py-0.5 bg-[#1e2d45]/60 text-[#64748b] rounded border border-[#2a3f5f]/50 font-medium">
                        {tag}
                      </span>
                    ))}
                    {problem.tags.length > 3 && (
                      <span className="text-[11px] px-2 py-0.5 bg-[#1e2d45]/60 text-[#475569] rounded border border-[#2a3f5f]/50">
                        +{problem.tags.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="py-20 text-center">
                <Search className="w-8 h-8 text-[#2a3f5f] mx-auto mb-3" />
                <p className="text-[#475569] text-sm">No problems found matching your filters.</p>
              </div>
            )}
          </div>
        </div>

        {filtered.length > 0 && (
          <p className="text-center text-[#2a3f5f] text-xs mt-4">
            Showing {filtered.length} of {problems.length} problems
          </p>
        )}
      </main>
    </div>
  );
}
