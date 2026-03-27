import React, { useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { RotateCcw } from 'lucide-react';

const boilerplates = {
  c: `#include <stdio.h>

int main() {
    // your code here
    return 0;
}`,
  cpp: `#include <bits/stdc++.h>
using namespace std;

void solve() {
    // your code here
}

int main() {
    solve();
    return 0;
}`,
  python: `def solve():
    pass

if __name__ == "__main__":
    solve()`,
  java: `import java.util.*;

class Main {
    public static void solve(Scanner sc) {
        // your code here
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        solve(sc);
    }
}`
};

export default function EditorPanel({ language, setLanguage, code, setCode }) {
  useEffect(() => {
    localStorage.setItem('cf_language', language);
    const savedCode = localStorage.getItem(`cf_code_${language}`);
    if (savedCode !== null && savedCode !== "") {
      setCode(savedCode);
    } else {
      setCode(boilerplates[language]);
    }
  }, [language, setCode]);

  const handleLanguageChange = (e) => {
    setLanguage(e.target.value);
  };

  const handleEditorChange = (value) => {
    setCode(value);
    localStorage.setItem(`cf_code_${language}`, value);
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Sticky Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#111827] border-b border-[#1f2937] shrink-0 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-[#9ca3af] uppercase tracking-wider">Language</span>
          <select 
            className="bg-[#1f2937] text-sm text-[#e5e7eb] border border-[#374151] rounded-lg py-1.5 px-3 focus:ring-2 focus:ring-blue-500/50 outline-none cursor-pointer hover:bg-[#374151] transition-colors"
            value={language}
            onChange={handleLanguageChange}
          >
            <option value="c">C</option>
            <option value="cpp">C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <button 
          onClick={() => {
            setCode(boilerplates[language]);
            localStorage.setItem(`cf_code_${language}`, boilerplates[language]);
          }}
          className="flex items-center text-xs font-medium text-[#9ca3af] hover:text-[#e5e7eb] transition-colors px-3 py-1.5 rounded bg-transparent hover:bg-[#1f2937]"
          title="Reset to boilerplate code"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Reset Defaults
        </button>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <Editor
          height="100%"
          language={language}
          theme="vs-dark"
          value={code}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: false },
            fontSize: 15,
            lineHeight: 26,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
            padding: { top: 20, bottom: 20 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: "smooth",
            cursorSmoothCaretAnimation: "on",
            formatOnPaste: true,
            scrollbar: {
              verticalScrollbarSize: 10,
              horizontalScrollbarSize: 10,
            }
          }}
          loading={
            <div className="flex flex-col items-center justify-center h-full text-[#9ca3af] bg-[#1e1e1e]">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-sm font-medium">Loading editor...</span>
            </div>
          }
        />
      </div>
    </div>
  );
}
