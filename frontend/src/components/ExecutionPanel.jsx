import React, { useState } from 'react';
import { runCode, submitCode } from '../utils/api';
import { Play, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Check } from 'lucide-react';

export default function ExecutionPanel({
  problemId,
  language,
  code,
  customInput,
  setCustomInput,
  outputData,
  setOutputData,
  submitResult,
  setSubmitResult,
  isLoading,
  setIsLoading,
  onSubmitComplete,
}) {
  const [copied, setCopied] = useState(false);

  const handleRun = async () => {
    setIsLoading(true);
    setSubmitResult(null); 
    setOutputData(null);
    try {
      const result = await runCode(language, code, customInput);
      setOutputData(result);
    } catch (err) {
      setOutputData({ error: 'Failed to connect to execution server.', status: 'error' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!problemId) return;
    setIsLoading(true);
    setOutputData(null); 
    setSubmitResult(null);
    const startTime = Date.now();
    try {
      const result = await submitCode(problemId, language, code);
      const timeTaken = Date.now() - startTime;
      if (onSubmitComplete) {
        onSubmitComplete(result, timeTaken);
      } else {
        setSubmitResult(result);
      }
    } catch (err) {
      if (onSubmitComplete) {
        onSubmitComplete({ error: 'Failed to submit to server.' }, null);
      } else {
        setSubmitResult({ error: 'Failed to submit to server.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-[#111827]">
      {/* Sticky Action Bar */}
      <div className="flex items-center justify-end gap-3 px-5 py-3 bg-[#111827] border-b border-[#1f2937] shrink-0 z-10 sticky top-0">
        <button
          onClick={handleRun}
          disabled={isLoading}
          className="flex items-center px-5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#3b82f6]/10"
        >
          {isLoading && !submitResult ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Play className="w-4 h-4 mr-2" fill="currentColor" />}
          Run
        </button>
        <button
          onClick={handleSubmit}
          disabled={isLoading}
          className="flex items-center px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#22c55e]/10"
        >
          {isLoading && !outputData ? <Loader2 className="w-4 h-4 mr-2 animate-spin text-white" /> : <Send className="w-4 h-4 mr-2" />}
          Submit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-6 scrollbar-thin scrollbar-thumb-[#334155]">
        
        {/* Custom Input Block */}
        <div className="bg-[#0f172a] rounded-xl border border-[#1f2937] p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-3">Custom Input</h3>
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="w-full h-32 bg-[#111827] border border-[#334155] rounded-lg p-4 text-[14px] font-mono text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 resize-y transition-colors leading-relaxed"
            placeholder="Provide input for your code here..."
          />
        </div>

        {/* Console / Output Block */}
        <div className="flex-1 flex flex-col min-h-[350px] bg-[#0f172a] rounded-xl border border-[#1f2937] p-5 shadow-sm">
          <div className="flex justify-between items-center mb-4 border-b border-[#1f2937] pb-3">
             <h3 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider">Console Output</h3>
             {(outputData?.output || submitResult) && (
               <button 
                 onClick={() => handleCopy(outputData?.output || JSON.stringify(submitResult, null, 2))}
                 className="text-[#9ca3af] hover:text-white transition-colors"
                 title="Copy to clipboard"
               >
                 {copied ? <Check className="w-4 h-4 text-[#22c55e]" /> : <Copy className="w-4 h-4" />}
               </button>
             )}
          </div>
          
          <div className="flex-1 font-mono text-[14px] leading-relaxed overflow-y-auto">
            
            {!outputData && !submitResult && !isLoading && (
              <div className="h-full flex items-center justify-center text-[#6b7280] italic">
                Ready. Run or Submit code to view results.
              </div>
            )}

            {isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-[#3b82f6] gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="font-sans font-medium">Executing on server...</span>
              </div>
            )}

            {/* Run Output Display */}
            {outputData && !isLoading && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {outputData.status === 'success' ? (
                   <div className="flex items-center text-[#22c55e] font-bold text-lg font-sans">
                     <CheckCircle2 className="w-6 h-6 mr-2" /> Accepted
                   </div>
                ) : (
                   <div className="flex items-center text-[#f97316] font-bold text-lg font-sans">
                     <AlertTriangle className="w-6 h-6 mr-2" /> Runtime Error
                   </div>
                )}

                {outputData.output && (
                  <div>
                    <span className="text-xs font-bold text-[#9ca3af] block mb-2">Standard Output</span>
                    <div className="bg-[#111827] px-4 py-3 rounded-lg border border-[#334155] shadow-inner">
                      <pre className="text-[#e5e7eb] whitespace-pre-wrap">{outputData.output}</pre>
                    </div>
                  </div>
                )}
                
                {outputData.error && (
                  <div>
                    <span className="text-xs font-bold text-[#ef4444] block mb-2">Standard Error</span>
                    <div className="bg-[#ef4444]/10 px-4 py-3 rounded-lg border border-[#ef4444]/30 shadow-inner">
                      <pre className="text-[#f87171] whitespace-pre-wrap">{outputData.error}</pre>
                    </div>
                  </div>
                )}

                {!outputData.output && !outputData.error && outputData.status === 'success' && (
                  <span className="text-[#6b7280] italic">Program exited successfully with no output log.</span>
                )}
              </div>
            )}

            {/* Submit Results Display */}
            {submitResult && !isLoading && (
              <div className="space-y-6 animate-in fade-in duration-300">
                {submitResult.error ? (
                  <div className="text-[#ef4444] font-bold flex items-center bg-[#ef4444]/10 p-4 rounded-lg border border-[#ef4444]/30">
                    <XCircle className="w-6 h-6 mr-3" /> {submitResult.error}
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-4 border-b border-[#1f2937] pb-4">
                      {submitResult.passed === submitResult.total ? (
                        <div className="flex items-center text-[#22c55e] font-bold text-xl font-sans">
                          <CheckCircle2 className="w-7 h-7 mr-2" /> All Test Cases Passed
                        </div>
                      ) : (
                        <div className="flex items-center text-[#ef4444] font-bold text-xl font-sans">
                          <XCircle className="w-7 h-7 mr-2" /> Wrong Answer
                        </div>
                      )}
                      <span className="text-[#e5e7eb] font-bold font-sans bg-[#374151] px-4 py-1.5 rounded-full text-sm border border-[#4b5563] shadow-sm">
                        {submitResult.passed} / {submitResult.total}
                      </span>
                    </div>

                    <div className="space-y-5 mt-4">
                      {submitResult.details?.map((detail, index) => (
                        <div key={index} className={`p-5 rounded-xl border shadow-sm transition-colors ${detail.passed ? 'bg-[#22c55e]/5 border-[#22c55e]/20' : 'bg-[#ef4444]/5 border-[#ef4444]/30'}`}>
                          <div className="flex items-center font-bold mb-4 font-sans text-base">
                            {detail.passed ? (
                              <span className="text-[#22c55e] flex items-center"><CheckCircle2 className="w-5 h-5 mr-2"/> Test Case {detail.testCaseNumber}</span>
                            ) : (
                              <span className="text-[#ef4444] flex items-center"><XCircle className="w-5 h-5 mr-2"/> Test Case {detail.testCaseNumber}</span>
                            )}
                          </div>
                          
                          <div className="grid grid-cols-1 gap-5">
                            <div>
                              <span className="text-xs font-bold text-[#9ca3af] block mb-1.5">Input:</span>
                              <div className="bg-[#111827] px-4 py-2 border border-[#334155] rounded-lg shadow-inner">
                                <pre className="text-[#e5e7eb] whitespace-pre-wrap">{detail.input}</pre>
                              </div>
                            </div>
                            
                            {!detail.passed && (
                              <>
                                <div>
                                  <span className="text-xs font-bold text-[#9ca3af] block mb-1.5">Expected Output:</span>
                                  <div className="bg-[#111827] px-4 py-2 border border-[#334155] rounded-lg shadow-inner">
                                    <pre className="text-[#22c55e] whitespace-pre-wrap">{detail.expectedOutput}</pre>
                                  </div>
                                </div>
                                
                                <div>
                                  <span className="text-xs font-bold text-[#9ca3af] block mb-1.5">Actual Output:</span>
                                  <div className={`px-4 py-2 border rounded-lg shadow-inner min-h-[44px] ${detail.status === 'error' ? 'bg-[#ef4444]/10 border-[#ef4444]/30' : 'bg-[#111827] border-[#334155]'}`}>
                                    <pre className={`${detail.status === 'error' ? 'text-[#f87171]' : 'text-[#fca5a5]'} whitespace-pre-wrap`}>
                                      {detail.actualOutput || (detail.error ? <span className="font-sans font-medium text-[#ef4444]">{detail.error}</span> : <span className="text-[#6b7280] italic">Empty</span>)}
                                    </pre>
                                  </div>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
