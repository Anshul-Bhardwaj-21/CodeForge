import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Terminal, AlertCircle, LayoutDashboard, Code2,
  Flame, Trophy, TrendingUp, Activity, Clock, Layers,
} from 'lucide-react';
import { getProgress, getProblems } from '../utils/api';
import {
  computeSummary, computeStreaks, buildHeatmapData,
  getHeatmapIntensity, computeTopicBreakdown,
  computeDifficultyBreakdown, getRecentSubmissions,
} from '../utils/progressStats';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr) {
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  const days = Math.floor(diff / 86400);
  return `${days}d ago`;
}

const VERDICT_STYLES = {
  accepted:            { text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/20', label: 'Accepted' },
  wrong_answer:        { text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20', label: 'Wrong Answer' },
  runtime_error:       { text: 'text-[#f97316]', bg: 'bg-[#f97316]/10', border: 'border-[#f97316]/20', label: 'Runtime Error' },
  time_limit_exceeded: { text: 'text-[#eab308]', bg: 'bg-[#eab308]/10', border: 'border-[#eab308]/20', label: 'TLE' },
};

const INTENSITY_CLASSES = [
  'bg-[#0d1424]',
  'bg-[#14532d]',
  'bg-[#166534]',
  'bg-[#16a34a]',
  'bg-[#22c55e]',
];

const DIFF_CONFIG = {
  Easy:   { bar: 'from-[#22c55e] to-[#4ade80]', text: 'text-[#22c55e]', bg: 'bg-[#22c55e]/10', border: 'border-[#22c55e]/20' },
  Medium: { bar: 'from-[#eab308] to-[#fbbf24]', text: 'text-[#eab308]', bg: 'bg-[#eab308]/10', border: 'border-[#eab308]/20' },
  Hard:   { bar: 'from-[#ef4444] to-[#f87171]', text: 'text-[#ef4444]', bg: 'bg-[#ef4444]/10', border: 'border-[#ef4444]/20' },
};

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children, className = '' }) {
  return (
    <div className={`bg-[#0d1424] border border-[#1e2d45] rounded-xl overflow-hidden ${className}`}>
      {children}
    </div>
  );
}

function PanelHeader({ icon: Icon, title, accent = 'text-blue-400' }) {
  return (
    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e2d45] bg-[#0a0f1e]/60">
      <Icon className={`w-3.5 h-3.5 ${accent}`} />
      <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">{title}</span>
    </div>
  );
}

// ─── StatsBar ─────────────────────────────────────────────────────────────────

function StatsBar({ summary }) {
  const stats = [
    { label: 'Solved',      value: summary.solved,           color: 'text-[#22c55e]', glow: 'shadow-[#22c55e]/20', icon: Trophy,     accent: 'text-[#22c55e]' },
    { label: 'Attempted',   value: summary.attempted,        color: 'text-[#eab308]', glow: 'shadow-[#eab308]/20', icon: TrendingUp, accent: 'text-[#eab308]' },
    { label: 'Submissions', value: summary.totalSubmissions, color: 'text-[#60a5fa]', glow: 'shadow-[#60a5fa]/20', icon: Activity,   accent: 'text-[#60a5fa]' },
  ];
  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map(({ label, value, color, glow, icon: Icon, accent }) => (
        <Panel key={label}>
          <div className="p-5 flex items-center gap-4">
            <div className={`flex items-center justify-center w-10 h-10 rounded-lg bg-[#111827] border border-[#1e2d45] shadow-lg ${glow}`}>
              <Icon className={`w-5 h-5 ${accent}`} />
            </div>
            <div>
              <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
              <div className="text-[#475569] text-xs mt-0.5">{label}</div>
            </div>
          </div>
        </Panel>
      ))}
    </div>
  );
}

// ─── StreakCard ───────────────────────────────────────────────────────────────

function StreakCard({ streaks }) {
  return (
    <Panel>
      <PanelHeader icon={Flame} title="Streaks" accent="text-orange-400" />
      <div className="p-5 grid grid-cols-2 gap-4">
        <div className="bg-[#0a0f1e] rounded-lg border border-[#1e2d45] p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="text-3xl font-bold font-mono text-white">{streaks.current}</span>
            {streaks.current > 0 && <Flame className="w-6 h-6 text-orange-400" />}
          </div>
          <div className="text-[#475569] text-xs">Current Streak</div>
          <div className="text-[#2a3f5f] text-[10px] mt-0.5">days</div>
        </div>
        <div className="bg-[#0a0f1e] rounded-lg border border-[#1e2d45] p-4 text-center">
          <div className="text-3xl font-bold font-mono text-white mb-1">{streaks.longest}</div>
          <div className="text-[#475569] text-xs">Longest Streak</div>
          <div className="text-[#2a3f5f] text-[10px] mt-0.5">days</div>
        </div>
      </div>
    </Panel>
  );
}

// ─── DifficultyBreakdown ──────────────────────────────────────────────────────

function DifficultyBreakdown({ breakdown }) {
  return (
    <Panel>
      <PanelHeader icon={Layers} title="Difficulty" accent="text-purple-400" />
      <div className="p-5 space-y-4">
        {breakdown.map(({ difficulty, solved, total }) => {
          const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
          const c = DIFF_CONFIG[difficulty];
          return (
            <div key={difficulty}>
              <div className="flex justify-between items-center mb-2">
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded border ${c.bg} ${c.border} ${c.text}`}>
                  {difficulty}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[#475569] text-xs font-mono">{solved}/{total}</span>
                  <span className={`text-xs font-bold font-mono ${c.text}`}>{pct}%</span>
                </div>
              </div>
              <div className="h-1.5 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e2d45]">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${c.bar} transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ─── ActivityHeatmap ──────────────────────────────────────────────────────────

function ActivityHeatmap({ progressData }) {
  const today = new Date();
  const heatmap = buildHeatmapData(progressData, today);
  const entries = Array.from(heatmap.entries());

  const columns = [];
  for (let col = 0; col < 52; col++) {
    columns.push(entries.slice(col * 7, col * 7 + 7));
  }

  const monthLabels = columns.map((col, i) => {
    const firstDate = col[0]?.[0];
    if (!firstDate) return '';
    const d = new Date(firstDate + 'T00:00:00');
    const prevFirst = columns[i - 1]?.[0]?.[0];
    if (!prevFirst) return d.toLocaleString('default', { month: 'short' });
    return new Date(prevFirst + 'T00:00:00').getMonth() !== d.getMonth()
      ? d.toLocaleString('default', { month: 'short' })
      : '';
  });

  return (
    <Panel>
      <PanelHeader icon={Activity} title="Activity — past 52 weeks" accent="text-teal-400" />
      <div className="p-5">
        <div className="overflow-x-auto">
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1.5">
            {monthLabels.map((label, i) => (
              <div key={i} className="w-[13px] text-[9px] text-[#2a3f5f] shrink-0 text-center font-medium">
                {label}
              </div>
            ))}
          </div>
          {/* Grid */}
          <div className="flex gap-[3px]">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-[3px]">
                {col.map(([date, count]) => {
                  const intensity = getHeatmapIntensity(count);
                  return (
                    <div
                      key={date}
                      className={`w-[13px] h-[13px] rounded-sm ${INTENSITY_CLASSES[intensity]} border border-[#1e2d45]/40 cursor-default transition-opacity hover:opacity-80`}
                      title={`${date}: ${count} accepted`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 justify-end">
            <span className="text-[#2a3f5f] text-[10px]">Less</span>
            {INTENSITY_CLASSES.map((cls, i) => (
              <div key={i} className={`w-[13px] h-[13px] rounded-sm ${cls} border border-[#1e2d45]/40`} />
            ))}
            <span className="text-[#2a3f5f] text-[10px]">More</span>
          </div>
        </div>
      </div>
    </Panel>
  );
}

// ─── TopicBreakdown ───────────────────────────────────────────────────────────

function TopicBreakdown({ breakdown }) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader icon={Code2} title="Topics" accent="text-blue-400" />
      <div className="p-5 flex-1 overflow-y-auto max-h-72">
        {breakdown.length === 0 ? (
          <p className="text-[#2a3f5f] text-sm text-center py-8">No topic data yet.</p>
        ) : (
          <div className="space-y-3">
            {breakdown.map(({ topic, solved, total }) => {
              const pct = total > 0 ? Math.round((solved / total) * 100) : 0;
              return (
                <div key={topic}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[#94a3b8] text-xs font-medium">{topic}</span>
                    <span className="text-[#475569] text-[11px] font-mono">{solved}/{total}</span>
                  </div>
                  <div className="h-1 bg-[#0a0f1e] rounded-full overflow-hidden border border-[#1e2d45]">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-teal-400 rounded-full transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Panel>
  );
}

// ─── RecentSubmissions ────────────────────────────────────────────────────────

function RecentSubmissions({ submissions }) {
  return (
    <Panel className="flex flex-col">
      <PanelHeader icon={Clock} title="Recent Submissions" accent="text-violet-400" />
      {submissions.length === 0 ? (
        <div className="py-12 text-center text-[#2a3f5f] text-sm">No submissions yet.</div>
      ) : (
        <div className="divide-y divide-[#1e2d45]/60 overflow-y-auto max-h-72">
          {submissions.map((sub, i) => {
            const v = VERDICT_STYLES[sub.verdict] ?? { text: 'text-[#64748b]', bg: 'bg-[#1e2d45]', border: 'border-[#2a3f5f]', label: sub.verdict };
            return (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-[#111827]/50 transition-colors">
                <div className={`shrink-0 px-2 py-0.5 rounded border text-[11px] font-semibold ${v.bg} ${v.border} ${v.text}`}>
                  {v.label}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[#94a3b8] text-xs font-medium truncate">{sub.problemTitle}</div>
                  <div className="text-[#475569] text-[11px] font-mono mt-0.5">{sub.language}</div>
                </div>
                <div className="text-[#2a3f5f] text-[11px] shrink-0">{relativeTime(sub.submittedAt)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function Skeleton({ className = '' }) {
  return <div className={`bg-[#0d1424] border border-[#1e2d45] rounded-xl animate-pulse ${className}`} />;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
        <Skeleton className="h-20" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-36" />
        <Skeleton className="h-36" />
      </div>
      <Skeleton className="h-32" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}

// ─── Profile page ─────────────────────────────────────────────────────────────

export default function Profile() {
  const [progressData, setProgressData] = useState(null);
  const [problems, setProblems] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([getProgress(), getProblems()])
      .then(([progress, probs]) => { setProgressData(progress); setProblems(probs); })
      .catch(err => setError(err.message ?? 'Failed to load data'));
  }, []);

  const loading = !error && (progressData === null || problems === null);

  const summary      = progressData && problems ? computeSummary(progressData) : null;
  const streaks      = progressData ? computeStreaks(progressData) : null;
  const diffBreakdown  = progressData && problems ? computeDifficultyBreakdown(progressData, problems) : null;
  const topicBreakdown = progressData && problems ? computeTopicBreakdown(progressData, problems) : null;
  const recentSubs   = progressData && problems ? getRecentSubmissions(progressData, problems, 10) : null;

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-[#e5e7eb] font-sans">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 flex items-center px-6 py-3 bg-[#0d1424]/95 backdrop-blur border-b border-[#1e2d45] shadow-lg shadow-black/30">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-teal-400 mr-3 shadow-lg shadow-blue-500/30">
          <Terminal className="w-4 h-4 text-white" />
        </div>
        <Link to="/" className="text-xl font-bold text-white tracking-tight hover:text-blue-400 transition-colors">
          CodeForge
        </Link>
        <span className="ml-2.5 px-1.5 py-0.5 rounded text-[10px] font-bold tracking-widest bg-[#1e2d45] text-[#64748b] border border-[#2a3f5f] uppercase">DSA</span>

        <nav className="ml-auto flex items-center gap-1">
          <Link to="/" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#64748b] hover:text-white hover:bg-[#1e2d45] transition-all">
            <Code2 className="w-3.5 h-3.5" />
            Problems
          </Link>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-[#1e2d45] border border-[#2a3f5f]">
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
            Profile
          </span>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        {/* Page title */}
        <div className="mb-7 flex items-center gap-3">
          <div className="w-1 h-6 rounded-full bg-gradient-to-b from-blue-400 to-teal-400" />
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Dashboard</h2>
            <p className="text-[#475569] text-xs mt-0.5">Your coding progress at a glance</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-3 bg-[#ef4444]/10 border border-[#ef4444]/25 text-[#ef4444] rounded-xl px-5 py-4 mb-6">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {loading && !error && <LoadingSkeleton />}

        {!loading && !error && (
          <div className="space-y-4">
            <StatsBar summary={summary} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <StreakCard streaks={streaks} />
              <DifficultyBreakdown breakdown={diffBreakdown} />
            </div>

            <ActivityHeatmap progressData={progressData} />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <TopicBreakdown breakdown={topicBreakdown} />
              <RecentSubmissions submissions={recentSubs} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
