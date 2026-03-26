# Tasks: Premium Dark Theme UI

## Task List

- [x] 1. Set up global design system tokens
  - [x] 1.1 Extend `tailwind.config.js` with the design token color palette (bg-page, bg-surface, border-subtle, accent colors)
  - [x] 1.2 Update `index.css` to set `line-height: 1.6` on body and confirm Inter font import is present
  - [x] 1.3 Verify scrollbar styles in `index.css` use the correct muted color tokens

- [x] 2. Upgrade ProblemPanel
  - [x] 2.1 Confirm title renders at `text-2xl font-bold` (already present — verify and lock in)
  - [x] 2.2 Confirm difficulty badge uses `rounded-full` with correct color mapping for Easy/Medium/Hard
  - [x] 2.3 Confirm each tag renders as `rounded-full` pill with muted styling
  - [x] 2.4 Confirm example code blocks use a dark boxed container with monospace font and `whitespace-pre-wrap`
  - [x] 2.5 Confirm root element has `overflow-y-auto` for scrollable panel
  - [x] 2.6 Confirm skeleton loader uses `animate-pulse` placeholder blocks matching real layout structure

- [x] 3. Upgrade EditorPanel
  - [x] 3.1 Confirm Monaco Editor has `theme="vs-dark"` (already present — verify)
  - [x] 3.2 Confirm toolbar has `sticky top-0 z-10` classes
  - [x] 3.3 Confirm language selector `<select>` has all three options (C++, Python, Java) with correct styling
  - [x] 3.4 Confirm all toolbar interactive elements have `transition-colors` class
  - [x] 3.5 Confirm editor wrapper in `Workspace.jsx` has `border border-[#1f2937] shadow-lg`

- [x] 4. Upgrade ExecutionPanel
  - [x] 4.1 Confirm Custom Input section is inside a boxed container with `border rounded-xl`
  - [x] 4.2 Confirm Console Output section is inside a boxed container with `border rounded-xl`
  - [x] 4.3 Confirm all `<pre>` output elements have `whitespace-pre-wrap`
  - [x] 4.4 Confirm output area container has `overflow-y-auto`
  - [x] 4.5 Confirm Accepted/all-passed status renders `CheckCircle2` with `text-[#22c55e]`
  - [x] 4.6 Confirm Wrong Answer status renders `XCircle` with `text-[#ef4444]`
  - [x] 4.7 Confirm Runtime Error status renders `AlertTriangle` with `text-[#f97316]`
  - [x] 4.8 Confirm copy button is present adjacent to output section
  - [x] 4.9 Confirm copy button toggles to `Check` icon for 2 seconds after click

- [x] 5. Upgrade button design
  - [x] 5.1 Confirm Run button has `bg-[#3b82f6] hover:bg-[#2563eb] rounded-lg px-5 py-2 text-white font-semibold`
  - [x] 5.2 Confirm Submit button has `bg-[#22c55e] hover:bg-[#16a34a] rounded-lg px-5 py-2 text-white font-semibold`
  - [x] 5.3 Confirm both buttons have `disabled:opacity-50 disabled:cursor-not-allowed` classes
  - [x] 5.4 Confirm both buttons show `Loader2` with `animate-spin` when `isLoading` is true

- [x] 6. Loading and execution feedback
  - [x] 6.1 Confirm loading state renders centered `Loader2` spinner with `animate-spin` in the output area
  - [x] 6.2 Confirm loading state renders "Executing on server..." text alongside the spinner
  - [x] 6.3 Confirm result containers have `animate-in fade-in duration-300` classes for fade-in transition

- [x] 7. Upgrade ProblemList page
  - [x] 7.1 Confirm header renders gradient `Terminal` icon + "CodeForge" wordmark + "DSA" badge
  - [x] 7.2 Confirm problems table wrapper has `rounded-xl border border-[#1f2937]`
  - [x] 7.3 Confirm table rows have `hover:bg-[#1e293b]/50 transition-colors` classes
  - [x] 7.4 Confirm difficulty badges use the same `rounded-full` pill style and color mapping as ProblemPanel
  - [x] 7.5 Confirm search input and difficulty filter have `border border-[#334155] rounded-xl` styling
  - [x] 7.6 Confirm empty state renders `Search` icon and descriptive message when no problems match filters

- [x] 8. Workspace layout integrity
  - [x] 8.1 Confirm three panels have `w-[30%]`, `w-[40%]`, `w-[30%]` with `min-w` guards
  - [x] 8.2 Confirm each panel wrapper has `border border-[#1f2937] rounded-xl shadow-lg`
  - [x] 8.3 Confirm workspace background is `bg-[#0f172a]`
  - [x] 8.4 Confirm navigation header has back-link `<Link to="/">` to Problem List

- [x] 9. Write tests
  - [x] 9.1 Install test dependencies: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `fast-check`, `jsdom`
  - [x] 9.2 Configure Vitest in `vite.config.js` with jsdom environment
  - [x] 9.3 Write property test for Property 1: difficulty badge color mapping (fast-check, 100 runs)
  - [x] 9.4 Write property test for Property 2: tag pill shape (fast-check, 100 runs)
  - [x] 9.5 Write property test for Property 3: output text whitespace-pre-wrap (fast-check, 100 runs)
  - [x] 9.6 Write property test for Property 4: button hover variants present (fast-check, 100 runs)
  - [x] 9.7 Write property test for Property 5: all controls disabled during loading (fast-check, 100 runs)
  - [x] 9.8 Write property test for Property 6: status indicator correctness (fast-check, 100 runs)
  - [x] 9.9 Write unit tests for skeleton loader, scrollable panel, Monaco theme, sticky toolbar
  - [x] 9.10 Write unit tests for copy button toggle, loading spinner+message, fade-in on result
  - [x] 9.11 Write unit tests for empty state, three-panel layout, back-link, button colors, spinner-in-button
