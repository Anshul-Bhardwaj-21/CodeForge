import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ProblemPanel from '../components/ProblemPanel';
import EditorPanel from '../components/EditorPanel';
import ExecutionPanel from '../components/ExecutionPanel';
import { getProblemDetails } from '../utils/api';
import { Terminal, ChevronLeft } from 'lucide-react';

export default function Workspace() {
  const { id } = useParams();
  const [problem, setProblem] = useState(null);
  
  // Editor state
  const [language, setLanguage] = useState(localStorage.getItem('cf_language') || 'cpp');
  const [code, setCode] = useState(localStorage.getItem(`cf_code_${language}_${id}`) || '');
  
  // Execution state
  const [customInput, setCustomInput] = useState('');
  const [outputData, setOutputData] = useState(null); 
  const [submitResult, setSubmitResult] = useState(null); 
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('cf_last_problem', id);
    const loadProblem = async () => {
      try {
        const data = await getProblemDetails(id);
        setProblem(data);
        if (data && data.examples && data.examples.length > 0) {
          setCustomInput(data.examples[0].input);
        }
      } catch (err) {
        console.error("Failed to load problem", err);
      }
    };
    loadProblem();
  }, [id]);

  const handleSetCode = (newCode) => {
    setCode(newCode);
    localStorage.setItem(`cf_code_${language}_${id}`, newCode);
  }

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-[#e5e7eb] font-sans justify-stretch">
      {/* Navbar */}
      <header className="flex items-center justify-between px-6 py-3 bg-[#111827] border-b border-[#1f2937] shadow-sm z-10 shrink-0">
        <div className="flex items-center">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-teal-500 mr-3 shadow-lg shadow-blue-500/20">
            <Terminal className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">CodeForge</h1>
          <span className="ml-3 px-2 py-0.5 rounded text-[11px] font-bold tracking-widest bg-[#1f2937] text-[#9ca3af] border border-[#374151] uppercase">DSA</span>
        </div>
        
        <Link to="/" className="flex items-center text-sm font-semibold text-[#9ca3af] hover:text-[#e5e7eb] transition-colors bg-[#1f2937]/50 hover:bg-[#1f2937] px-4 py-2 rounded-lg border border-[#334155]">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Problem List
        </Link>
      </header>

      {/* Main Workspace */}
      <main className="flex flex-1 overflow-hidden p-4 gap-4">
        {/* Left Panel: Problem Statement (30%) */}
        <div className="w-[30%] min-w-[320px] border border-[#1f2937] bg-[#111827] rounded-xl flex flex-col overflow-hidden shadow-lg">
          <ProblemPanel problem={problem} />
        </div>

        {/* Center Panel: Code Editor (40%) */}
        <div className="w-[40%] min-w-[420px] border border-[#1f2937] bg-[#111827] rounded-xl flex flex-col overflow-hidden shadow-lg">
          <EditorPanel 
            language={language} 
            setLanguage={setLanguage} 
            code={code} 
            setCode={handleSetCode} 
          />
        </div>

        {/* Right Panel: Execution (30%) */}
        <div className="w-[30%] min-w-[320px] border border-[#1f2937] bg-[#111827] rounded-xl flex flex-col overflow-hidden shadow-lg">
          <ExecutionPanel 
            problemId={problem?.id}
            language={language}
            code={code}
            customInput={customInput}
            setCustomInput={setCustomInput}
            outputData={outputData}
            setOutputData={setOutputData}
            submitResult={submitResult}
            setSubmitResult={setSubmitResult}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
          />
        </div>
      </main>
    </div>
  );
}
