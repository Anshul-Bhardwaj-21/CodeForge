import React, { useState, useRef } from 'react';
import { runCodeStream, submitCode } from '../utils/api';
import { Play, Send, Loader2, CheckCircle2, XCircle, AlertTriangle, Copy, Check, Zap, MemoryStick } from 'lucide-react';

// ── Performance bar chart ─────────────────────────────────────────────────────
const COMPLEXITY_CONFIG = {
  'O(1)':       { color: '#22c55e', glow: '#22c55e33', tier: 'Excellent' },
  'O(log n)':   { color: '#4ade80', glow: '#4ade8033', tier: 'Excellent' },
  'O(n)':       { color: '#60a5fa', glow: '#60a5fa33', tier: 'Good' },
  'O(n log n)': { color: '#a78bfa', glow: '#a78bfa33', tier: 'Good' },
  'O(n²)':      { color: '#f97316', glow: '#f9731633', tier: 'Fair' },
  'O(n³)':      { color: '#ef4444', glow: '#ef444433', tier: 'Poor' },
  'O(2ⁿ)':      { color: '#dc2626', glow: '#dc262633', tier: 'Poor' },
};

function ComplexityBadge({ notation, label, spaceNotation, confidence, method }) {
  const tc = COMPLEXITY_CONFIG[notation] ?? { color: '#94a3b8', glow: '#94a3b833', tier: '' };
  const sc = COMPLEXITY_CONFIG[spaceNotation] ?? { color: '#94a3b8', glow: '#94a3b833', tier: '' };
  const pct = Math.round((confidence ?? 0) * 100);

  return (
    <div className="bg-[#0a0f1e] rounded-xl border border-[#1e2d45] overflow-hidden shadow-xl">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e2d45] bg-[#0d1424]/80">
        <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Complexity Analysis</span>
        <span className="ml-auto text-[10px] text-[#334155] font-mono capitalize">{method} analysis · {pct}% confidence</span>
      </div>
      <div className="p-5 grid grid-cols-2 gap-4">
        {/* Time complexity */}
        <div
          className="rounded-xl border p-4 text-center relative overflow-hidden"
          style={{ borderColor: tc.color + '40', background: tc.glow }}
        >
          <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-2">Time</div>
          <div
            className="text-3xl font-bold font-mono mb-1"
            style={{ color: tc.color, textShadow: `0 0 20px ${tc.color}60` }}
          >
            {notation}
          </div>
          <div className="text-xs font-medium" style={{ color: tc.color + 'cc' }}>{label}</div>
          <div
            className="mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: tc.color + '20', color: tc.color }}
          >
            {tc.tier}
          </div>
        </div>

        {/* Space complexity */}
        <div
          className="rounded-xl border p-4 text-center relative overflow-hidden"
          style={{ borderColor: sc.color + '40', background: sc.glow }}
        >
          <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-2">Space</div>
          <div
            className="text-3xl font-bold font-mono mb-1"
            style={{ color: sc.color, textShadow: `0 0 20px ${sc.color}60` }}
          >
            {spaceNotation}
          </div>
          <div className="text-xs font-medium" style={{ color: sc.color + 'cc' }}>
            {spaceNotation === 'O(1)' ? 'Constant' : 'Linear'}
          </div>
          <div
            className="mt-2 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: sc.color + '20', color: sc.color }}
          >
            {sc.tier}
          </div>
        </div>
      </div>
      <div className="px-5 pb-4">
        <div className="text-[10px] text-[#334155] text-center">
          Estimated via static code analysis + runtime profiling. Results are heuristic.
        </div>
      </div>
    </div>
  );
}

function PerformanceChart({ performance }) {
  if (!performance) return null;
  const { times, avgTime, maxTime, complexity } = performance;

  const getColor = (ms) => {
    if (ms < 100) return { bar: '#22c55e', text: 'text-[#22c55e]', label: 'Fast' };
    if (ms < 500) return { bar: '#eab308', text: 'text-[#eab308]', label: 'OK' };
    return { bar: '#ef4444', text: 'text-[#ef4444]', label: 'Slow' };
  };

  const avgMs = avgTime != null ? avgTime * 1000 : null;
  const maxMs = maxTime != null ? maxTime * 1000 : null;
  const avgColor = avgMs != null ? getColor(avgMs) : null;
  const maxVal = times && times.length ? Math.max(...times, 0.001) : 0.001;

  return (
    <div className="space-y-4">
      {/* Complexity badges */}
      {complexity && (
        <ComplexityBadge
          notation={complexity.notation}
          label={complexity.label}
          spaceNotation={complexity.spaceNotation}
          confidence={complexity.confidence}
          method={complexity.method}
        />
      )}

      {/* Runtime chart */}
      {times && times.length > 0 && (
        <div className="bg-[#0a0f1e] rounded-xl border border-[#1e2d45] overflow-hidden shadow-xl">
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-[#1e2d45] bg-[#0d1424]/80">
            <Zap className="w-3.5 h-3.5 text-yellow-400" />
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Runtime Analysis</span>
          </div>
          <div className="p-5 space-y-5">
            {/* Summary cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#0d1424] rounded-xl border border-[#1e2d45] p-4 text-center">
                <div className={`text-2xl font-bold font-mono ${avgColor?.text ?? 'text-[#60a5fa]'}`}>
                  {avgMs != null ? `${avgMs.toFixed(1)}` : '—'}
                </div>
                <div className="text-[10px] text-[#475569] mt-0.5 font-medium">ms avg</div>
                {avgColor && <div className={`text-[10px] font-bold mt-1 ${avgColor.text}`}>{avgColor.label}</div>}
              </div>
              <div className="bg-[#0d1424] rounded-xl border border-[#1e2d45] p-4 text-center">
                <div className="text-2xl font-bold font-mono text-[#f97316]">
                  {maxMs != null ? `${maxMs.toFixed(1)}` : '—'}
                </div>
                <div className="text-[10px] text-[#475569] mt-0.5 font-medium">ms peak</div>
                <div className="text-[10px] font-bold mt-1 text-[#f97316]">Worst case</div>
              </div>
            </div>

            {/* Per test-case bars */}
            <div>
              <div className="text-[10px] font-semibold text-[#475569] uppercase tracking-wider mb-3">Per Test Case</div>
              <div className="space-y-2.5">
                {times.map((t, i) => {
                  const ms = t * 1000;
                  const pct = maxVal > 0 ? (t / maxVal) * 100 : 0;
                  const c = getColor(ms);
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <span className="text-[11px] text-[#475569] font-mono w-6 shrink-0 text-right">{i + 1}</span>
                      <div className="flex-1 h-5 bg-[#1e2d45]/60 rounded-md overflow-hidden relative">
                        <div
                          className="h-full rounded-md transition-all duration-700 ease-out"
                          style={{
                            width: `${pct}%`,
                            background: `linear-gradient(90deg, ${c.bar}cc, ${c.bar})`,
                            boxShadow: `0 0 8px ${c.bar}40`,
                          }}
                        />
                        {avgTime != null && (
                          <div
                            className="absolute top-0 bottom-0 w-px bg-white/30"
                            style={{ left: `${(avgTime / maxVal) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className={`text-[11px] font-mono w-16 text-right shrink-0 ${c.text}`}>
                        {ms.toFixed(1)} ms
                      </span>
                    </div>
                  );
                })}
              </div>
              {avgTime != null && (
                <div className="flex items-center gap-1.5 mt-3">
                  <div className="w-4 h-px bg-white/30" />
                  <span className="text-[10px] text-[#475569]">avg line</span>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 pt-1 border-t border-[#1e2d45]">
              {[{ color: '#22c55e', label: '< 100ms' }, { color: '#eab308', label: '< 500ms' }, { color: '#ef4444', label: '≥ 500ms' }].map(({ color, label }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: color }} />
                  <span className="text-[10px] text-[#475569]">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
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
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [streamStatus, setStreamStatus] = useState(null); // 'queued' | 'running' | null
  const cleanupStreamRef = useRef(null);

  const busy = isRunning || isSubmitting;

  const handleRun = () => {
    // Abort any in-flight stream
    if (cleanupStreamRef.current) {
      cleanupStreamRef.current();
      cleanupStreamRef.current = null;
    }

    setIsRunning(true);
    setIsLoading(true);
    setSubmitResult(null);
    setOutputData(null);
    setStreamStatus('queued');

    const cleanup = runCodeStream(language, code, customInput, (payload) => {
      if (payload.stage === 'submitting') {
        setStreamStatus('queued');
      } else if (payload.stage === 'running') {
        setStreamStatus(payload.status === 'queued' ? 'queued' : 'running');
      } else if (payload.stage === 'completed') {
        setStreamStatus(null);
        setOutputData({
          output: payload.output,
          error: payload.error,
          status: payload.status,
        });
        setIsRunning(false);
        setIsLoading(false);
        cleanupStreamRef.current = null;
      } else if (payload.stage === 'error') {
        setStreamStatus(null);
        setOutputData({ error: payload.error || 'Execution failed.', status: 'error' });
        setIsRunning(false);
        setIsLoading(false);
        cleanupStreamRef.current = null;
      }
    });

    cleanupStreamRef.current = cleanup;
  };

  const handleSubmit = async () => {
    if (!problemId) return;
    setIsSubmitting(true);
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
      const msg = err.message || 'Failed to submit to server.';
      if (onSubmitComplete) {
        onSubmitComplete({ error: msg }, null);
      } else {
        setSubmitResult({ error: msg });
      }
    } finally {
      setIsSubmitting(false);
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
      {/* Action Bar */}
      <div className="flex items-center justify-end gap-3 px-5 py-3 bg-[#111827] border-b border-[#1f2937] shrink-0 z-10 sticky top-0">
        <button
          onClick={handleRun}
          disabled={busy}
          className="flex items-center px-5 py-2 bg-[#3b82f6] hover:bg-[#2563eb] text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#3b82f6]/10"
        >
          {isRunning ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" fill="currentColor" />}
          Run
        </button>
        <button
          onClick={handleSubmit}
          disabled={busy}
          className="flex items-center px-5 py-2 bg-[#22c55e] hover:bg-[#16a34a] text-white font-semibold rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-[#22c55e]/10"
        >
          {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Submit
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5 scrollbar-thin scrollbar-thumb-[#334155]">

        {/* Custom Input */}
        <div className="bg-[#0f172a] rounded-xl border border-[#1f2937] p-5 shadow-sm">
          <h3 className="text-xs font-bold text-[#9ca3af] uppercase tracking-wider mb-3">Custom Input</h3>
          <textarea
            value={customInput}
            onChange={(e) => setCustomInput(e.target.value)}
            className="w-full h-28 bg-[#111827] border border-[#334155] rounded-lg p-4 text-[14px] font-mono text-[#e5e7eb] focus:outline-none focus:ring-2 focus:ring-[#3b82f6]/50 resize-y transition-colors leading-relaxed"
            placeholder="Provide input for your code here..."
          />
        </div>

        {/* Console / Output */}
        <div className="flex-1 flex flex-col min-h-[300px] bg-[#0f172a] rounded-xl border border-[#1f2937] p-5 shadow-sm">
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

            {!outputData && !submitResult && !busy && (
              <div className="h-full flex items-center justify-center text-[#6b7280] italic">
                Ready. Run or Submit code to view results.
              </div>
            )}

            {busy && (
              <div className="h-full flex flex-col items-center justify-center text-[#3b82f6] gap-3">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="font-sans font-medium">
                  {isSubmitting
                    ? 'Submitting...'
                    : streamStatus === 'queued'
                    ? 'Queued — waiting for sandbox...'
                    : 'Running on sandbox...'}
                </span>
                {isRunning && streamStatus && (
                  <span className="text-xs text-[#4b5563] font-mono">
                    {streamStatus === 'queued' ? '⏳ In queue' : '⚙️ Executing'}
                  </span>
                )}
              </div>
            )}

            {/* Run Output */}
            {outputData && !busy && (
              <div className="space-y-5 animate-in fade-in duration-300">
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
                  <span className="text-[#6b7280] italic">Program exited successfully with no output.</span>
                )}
              </div>
            )}

            {/* Submit Results */}
            {submitResult && !busy && (
              <div className="space-y-5 animate-in fade-in duration-300">
                {submitResult.error ? (
                  <div className="text-[#ef4444] font-bold flex items-center bg-[#ef4444]/10 p-4 rounded-lg border border-[#ef4444]/30">
                    <XCircle className="w-6 h-6 mr-3 shrink-0" /> {submitResult.error}
                  </div>
                ) : (
                  <>
                    {/* Verdict header */}
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
                      <span className="text-[#e5e7eb] font-bold font-sans bg-[#374151] px-4 py-1.5 rounded-full text-sm border border-[#4b5563]">
                        {submitResult.passed} / {submitResult.total}
                      </span>
                    </div>

                    {/* Test case details */}
                    <div className="space-y-4">
                      {submitResult.details?.map((detail, index) => (
                        <div key={index} className={`p-4 rounded-xl border shadow-sm ${detail.passed ? 'bg-[#22c55e]/5 border-[#22c55e]/20' : 'bg-[#ef4444]/5 border-[#ef4444]/30'}`}>
                          <div className="flex items-center justify-between font-bold mb-3 font-sans text-sm">
                            <span className={detail.passed ? 'text-[#22c55e] flex items-center gap-1.5' : 'text-[#ef4444] flex items-center gap-1.5'}>
                              {detail.passed ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                              Test Case {detail.testCaseNumber}
                            </span>
                            {detail.time != null && (
                              <span className="text-[11px] font-mono text-[#475569] font-normal">
                                {(parseFloat(detail.time) * 1000).toFixed(1)} ms
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 gap-3">
                            <div>
                              <span className="text-xs font-bold text-[#9ca3af] block mb-1">Input:</span>
                              <div className="bg-[#111827] px-3 py-2 border border-[#334155] rounded-lg">
                                <pre className="text-[#e5e7eb] whitespace-pre-wrap text-[13px]">{detail.input}</pre>
                              </div>
                            </div>
                            {!detail.passed && (
                              <>
                                <div>
                                  <span className="text-xs font-bold text-[#9ca3af] block mb-1">Expected:</span>
                                  <div className="bg-[#111827] px-3 py-2 border border-[#334155] rounded-lg">
                                    <pre className="text-[#22c55e] whitespace-pre-wrap text-[13px]">{detail.expectedOutput}</pre>
                                  </div>
                                </div>
                                <div>
                                  <span className="text-xs font-bold text-[#9ca3af] block mb-1">Got:</span>
                                  <div className={`px-3 py-2 border rounded-lg min-h-[36px] ${detail.status === 'error' ? 'bg-[#ef4444]/10 border-[#ef4444]/30' : 'bg-[#111827] border-[#334155]'}`}>
                                    <pre className={`whitespace-pre-wrap text-[13px] ${detail.status === 'error' ? 'text-[#f87171]' : 'text-[#fca5a5]'}`}>
                                      {detail.actualOutput || (detail.error || <span className="text-[#6b7280] italic">Empty</span>)}
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

        {/* Performance chart — only shown after a successful submit with timing data */}
        {submitResult && !submitResult.error && !busy && (
          <PerformanceChart performance={submitResult.performance} />
        )}
      </div>
    </div>
  );
}
