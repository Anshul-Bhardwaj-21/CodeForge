import React from 'react';
import ReactMarkdown from 'react-markdown';
import { CheckCircle2, Clock } from 'lucide-react';

const difficultyColors = {
  Easy: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20',
  Medium: 'text-[#eab308] bg-[#eab308]/10 border border-[#eab308]/20',
  Hard: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20'
};

// solvedStatus: 'solved' | 'attempted' | 'unseen' | null
export default function ProblemPanel({ problem, solvedStatus }) {
  if (!problem) {
    return (
      <div className="flex flex-col h-full p-6 animate-pulse bg-[#111827]">
        <div className="h-8 w-48 bg-[#1f2937] rounded-md mb-4"></div>
        <div className="flex gap-2 mb-8">
          <div className="h-6 w-16 bg-[#1f2937] rounded-full"></div>
          <div className="h-6 w-20 bg-[#1f2937] rounded-full"></div>
        </div>
        <div className="space-y-4 mb-8">
          <div className="h-4 bg-[#1f2937] rounded w-full"></div>
          <div className="h-4 bg-[#1f2937] rounded w-5/6"></div>
          <div className="h-4 bg-[#1f2937] rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-[#334155] bg-[#111827]">
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">{problem.id}. {problem.title}</h2>
          {solvedStatus === 'solved' && (
            <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30">
              <CheckCircle2 className="w-3.5 h-3.5" /> Solved
            </span>
          )}
          {solvedStatus === 'attempted' && (
            <span className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#eab308]/10 text-[#eab308] border border-[#eab308]/25">
              <Clock className="w-3.5 h-3.5" /> Attempted
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${difficultyColors[problem.difficulty] || 'text-[#9ca3af] bg-[#1f2937]'}`}>
            {problem.difficulty}
          </span>
          {problem.tags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-medium bg-[#1f2937] text-[#cbd5e1] border border-[#334155]">
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="prose prose-invert prose-sm max-w-none text-[#d1d5db] mb-10 leading-[1.7] font-medium text-[15px]">
        <ReactMarkdown>{problem.description}</ReactMarkdown>
      </div>

      <div className="mb-10">
        <h3 className="text-sm font-bold text-[#9ca3af] uppercase tracking-wider mb-5 border-b border-[#1f2937] pb-2">Examples</h3>
        <div className="flex flex-col gap-6">
          {problem.examples?.map((ex, i) => (
            <div key={i} className="bg-[#0f172a] rounded-xl border border-[#1f2937] p-5 shadow-sm transition-colors hover:border-[#334155]">
              <p className="text-xs font-bold text-[#9ca3af] mb-4">Example {i + 1}</p>
              
              <div className="mb-4">
                <span className="text-xs text-[#9ca3af] font-semibold block mb-1.5">Input:</span>
                <div className="bg-[#111827] px-4 py-3 rounded-lg border border-[#334155] shadow-inner">
                  <pre className="text-[14px] font-mono text-[#e5e7eb] whitespace-pre-wrap leading-relaxed">{ex.input}</pre>
                </div>
              </div>
              
              <div className="mb-4">
                <span className="text-xs text-[#9ca3af] font-semibold block mb-1.5">Output:</span>
                <div className="bg-[#111827] px-4 py-3 rounded-lg border border-[#334155] shadow-inner">
                  <pre className="text-[14px] font-mono text-[#22c55e] whitespace-pre-wrap leading-relaxed">{ex.output}</pre>
                </div>
              </div>

              {ex.explanation && (
                <div className="mt-4 pt-4 border-t border-[#1f2937] border-dashed">
                  <span className="text-xs text-[#9ca3af] font-semibold block mb-1.5">Explanation:</span>
                  <div className="text-[14px] text-[#cbd5e1] leading-relaxed">
                    <ReactMarkdown>{ex.explanation}</ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-[#9ca3af] uppercase tracking-wider mb-4 border-b border-[#1f2937] pb-2">Constraints</h3>
        <div className="prose prose-invert prose-sm p-5 rounded-xl bg-[#0f172a] border border-[#1f2937] text-[#d1d5db] leading-[1.7]">
          <ReactMarkdown>{problem.constraints}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
