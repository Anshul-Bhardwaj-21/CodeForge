import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getProblems } from '../utils/api';
import { Terminal, Search } from 'lucide-react';

export default function ProblemList() {
  const [problems, setProblems] = useState([]);
  const [search, setSearch] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('All');

  useEffect(() => {
    getProblems().then(setProblems).catch(console.error);
  }, []);

  const difficultyColors = {
    Easy: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20',
    Medium: 'text-[#eab308] bg-[#eab308]/10 border border-[#eab308]/20',
    Hard: 'text-[#ef4444] bg-[#ef4444]/10 border border-[#ef4444]/20'
  };

  const filtered = problems.filter(p => {
    const matchSearch = p.title.toLowerCase().includes(search.toLowerCase()) || p.tags.some(t => t.toLowerCase().includes(search.toLowerCase()));
    const matchDiff = difficultyFilter === 'All' || p.difficulty === difficultyFilter;
    return matchSearch && matchDiff;
  });

  return (
    <div className="min-h-screen bg-[#0f172a] text-[#e5e7eb] font-sans">
      <header className="flex items-center px-6 py-4 bg-[#111827] border-b border-[#1f2937] shadow-sm">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 mr-3 shadow-lg shadow-blue-500/20">
          <Terminal className="w-5 h-5 text-white" />
        </div>
        <h1 className="text-2xl font-bold text-white tracking-tight">CodeForge</h1>
        <span className="ml-3 px-2 py-0.5 rounded text-[11px] font-bold tracking-widest bg-[#1f2937] text-[#9ca3af] border border-[#374151] uppercase">DSA</span>
      </header>

      <main className="max-w-5xl mx-auto py-10 px-6 animate-in fade-in duration-500">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h2 className="text-3xl font-bold text-white mb-2">Problem Set</h2>
            <p className="text-[#9ca3af]">Sharpen your skills with our curated list of algorithms.</p>
          </div>
          
          <div className="flex gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
              <input 
                type="text" 
                placeholder="Search problems or tags..." 
                className="pl-9 pr-4 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-sm text-[#e5e7eb] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 w-full md:w-64 transition-all"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select 
              className="px-4 py-2.5 bg-[#111827] border border-[#334155] rounded-xl text-sm text-[#e5e7eb] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 transition-all cursor-pointer hover:bg-[#1f2937]"
              value={difficultyFilter}
              onChange={e => setDifficultyFilter(e.target.value)}
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
            </select>
          </div>
        </div>

        <div className="bg-[#111827] border border-[#1f2937] rounded-xl overflow-hidden shadow-lg">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#0f172a] border-b border-[#1f2937] text-[#9ca3af] text-sm uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold w-12"></th>
                <th className="px-6 py-4 font-semibold">Title</th>
                <th className="px-6 py-4 font-semibold">Difficulty</th>
                <th className="px-6 py-4 font-semibold hidden md:table-cell">Tags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {filtered.map(problem => (
                <tr key={problem.id} className="hover:bg-[#1e293b]/50 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="w-5 h-5 rounded-full border-2 border-[#334155] group-hover:border-blue-500/50 transition-colors"></div>
                  </td>
                  <td className="px-6 py-5 text-base font-semibold">
                    <Link to={`/problems/${problem.id}`} className="text-[#e5e7eb] hover:text-blue-400 transition-colors">
                      {problem.id}. {problem.title}
                    </Link>
                  </td>
                  <td className="px-6 py-5">
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${difficultyColors[problem.difficulty]}`}>
                      {problem.difficulty}
                    </span>
                  </td>
                  <td className="px-6 py-5 hidden md:table-cell">
                    <div className="flex gap-2">
                      {problem.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="text-xs px-2.5 py-1 bg-[#1f2937] text-[#cbd5e1] rounded-md border border-[#334155]">
                          {tag}
                        </span>
                      ))}
                      {problem.tags.length > 3 && <span className="text-xs px-2.5 py-1 bg-[#1f2937] text-[#cbd5e1] rounded-md border border-[#334155]">+{problem.tags.length - 3}</span>}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center text-[#9ca3af]">
                    <div className="flex flex-col items-center justify-center">
                      <Search className="w-8 h-8 text-[#475569] mb-3" />
                      <p>No problems found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
