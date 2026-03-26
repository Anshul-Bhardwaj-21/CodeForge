# Requirements Document

## Introduction

This feature upgrades the UI/UX of the existing CodeForge DSA platform to a premium, developer-focused dark theme interface. The goal is to improve the existing layout — not redesign it from scratch — making it visually clean, modern, and comfortable for long coding sessions. The target aesthetic is a VS Code + LeetCode hybrid: distraction-free, polished, and built for serious developers.

The platform consists of three main views: the Problem List page and the Workspace page (which contains the Problem Panel, Editor Panel, and Execution Panel). All backend logic remains unchanged.

## Glossary

- **Platform**: The CodeForge DSA web application as a whole.
- **Workspace**: The three-panel layout page where users read a problem, write code, and view execution results.
- **Problem_Panel**: The left panel in the Workspace displaying the problem statement, examples, and constraints.
- **Editor_Panel**: The center panel in the Workspace containing the Monaco code editor and its toolbar.
- **Execution_Panel**: The right panel in the Workspace containing custom input, run/submit controls, and output display.
- **Problem_List**: The page listing all available DSA problems with search and filter controls.
- **Toolbar**: The sticky top bar within the Editor_Panel containing the language selector and action buttons.
- **Status_Indicator**: A visual element (icon + colored text) that communicates the result of a run or submit action.
- **Design_System**: The shared set of color tokens, typography rules, spacing conventions, and component styles applied consistently across the Platform.

---

## Requirements

### Requirement 1: Global Design System

**User Story:** As a developer, I want a consistent dark theme design system applied across the entire platform, so that the interface feels cohesive and professional during long coding sessions.

#### Acceptance Criteria

1. THE Design_System SHALL use `#0f172a` as the global page background color.
2. THE Design_System SHALL use `#111827` as the panel and surface background color.
3. THE Design_System SHALL use `#1f2937` as the border color for all panel and component borders.
4. THE Design_System SHALL use `#e5e7eb` as the primary text color.
5. THE Design_System SHALL use `#9ca3af` as the secondary/muted text color.
6. THE Design_System SHALL apply the Inter or Poppins font family as the primary sans-serif typeface across all UI text.
7. THE Design_System SHALL apply a minimum line-height of 1.6 to all body text elements.
8. THE Design_System SHALL apply a minimum padding of `p-4` (1rem) to all panel containers.
9. THE Design_System SHALL use only Tailwind CSS utility classes for styling; inline styles SHALL only be used when a Tailwind equivalent does not exist.
10. THE Design_System SHALL NOT use bright, neon, or flashy accent colors outside of the defined palette.

---

### Requirement 2: Problem Panel Improvements

**User Story:** As a developer, I want the Problem Panel to be readable and well-structured, so that I can understand the problem clearly without visual clutter.

#### Acceptance Criteria

1. THE Problem_Panel SHALL render the problem title at `text-xl` or `text-2xl` font size with bold weight.
2. THE Problem_Panel SHALL display the difficulty badge as a pill-shaped element using `rounded-full` with the following color mapping:
   - Easy → green text and background tint (`#22c55e`)
   - Medium → yellow text and background tint (`#eab308`)
   - Hard → red text and background tint (`#ef4444`)
3. THE Problem_Panel SHALL render each problem tag as a pill-shaped element using `rounded-full` with small padding and muted styling.
4. THE Problem_Panel SHALL render code blocks within examples inside a dark boxed container using a monospace font with visible contrast against the panel background.
5. THE Problem_Panel SHALL be wrapped in a scrollable container so that long problem statements do not overflow the panel bounds.
6. WHEN the problem data is loading, THE Problem_Panel SHALL display a skeleton loading animation using placeholder elements.

---

### Requirement 3: Editor Panel Improvements

**User Story:** As a developer, I want the Editor Panel to feel like a professional code editor, so that I can write code comfortably and efficiently.

#### Acceptance Criteria

1. THE Editor_Panel SHALL configure the Monaco Editor with the `vs-dark` theme.
2. THE Editor_Panel SHALL display a sticky Toolbar at the top of the panel that remains visible while scrolling the editor.
3. THE Toolbar SHALL contain a language selector dropdown allowing the user to switch between supported languages (C++, Python, Java).
4. THE Editor_Panel SHALL apply a visible border around the editor area using the Design_System border color.
5. THE Editor_Panel SHALL apply a box shadow or elevation effect to visually separate the editor from the background.
6. THE Toolbar SHALL apply smooth CSS transitions on interactive elements (hover, focus states).

---

### Requirement 4: Execution Panel Improvements

**User Story:** As a developer, I want the Execution Panel to clearly display run and submit results, so that I can quickly understand whether my code is correct.

#### Acceptance Criteria

1. THE Execution_Panel SHALL display the Custom Input, and Console Output sections each inside a distinct boxed container with a border and rounded corners.
2. THE Execution_Panel SHALL render output text using `whitespace-pre-wrap` to preserve formatting.
3. THE Execution_Panel SHALL make the output area scrollable when content overflows.
4. WHEN a run or submit result has status "Accepted" or all test cases pass, THE Status_Indicator SHALL display green text and a checkmark icon.
5. WHEN a run or submit result has status "Wrong Answer", THE Status_Indicator SHALL display red text and an X icon.
6. WHEN a run or submit result has status "Runtime Error", THE Status_Indicator SHALL display orange text and a warning icon.
7. THE Execution_Panel SHALL display a copy button adjacent to each output section that copies the output text to the clipboard.
8. WHEN the copy action succeeds, THE Execution_Panel SHALL replace the copy icon with a checkmark icon for 2 seconds before reverting.

---

### Requirement 5: Button Design

**User Story:** As a developer, I want action buttons to be visually distinct and responsive, so that I can identify and interact with them quickly.

#### Acceptance Criteria

1. THE Platform SHALL style all primary action buttons with `rounded-lg` corners and `px-4 py-2` padding.
2. THE Platform SHALL style the Run button with a blue background (`#3b82f6`) and white text.
3. THE Platform SHALL style the Submit button with a green background (`#22c55e`) and white text.
4. WHEN a user hovers over a button, THE Platform SHALL apply a brightness increase effect via a darker hover color variant.
5. WHILE code execution is in progress, THE Platform SHALL disable the Run and Submit buttons and apply a reduced-opacity disabled style.
6. WHILE code execution is in progress, THE Platform SHALL replace the button icon with a spinning loader icon.

---

### Requirement 6: Loading and Execution Feedback

**User Story:** As a developer, I want clear visual feedback during code execution, so that I know the system is processing my request.

#### Acceptance Criteria

1. WHEN code execution begins, THE Execution_Panel SHALL display a centered loading spinner within the output area.
2. WHEN code execution begins, THE Execution_Panel SHALL display a status message such as "Executing on server..." alongside the spinner.
3. WHILE code execution is in progress, THE Platform SHALL disable all interactive controls that could trigger a second execution.
4. WHEN code execution completes, THE Execution_Panel SHALL replace the loading spinner with the result content using a fade-in transition.

---

### Requirement 7: Problem List Page Improvements

**User Story:** As a developer, I want the Problem List page to look polished and be easy to navigate, so that I can find and select problems efficiently.

#### Acceptance Criteria

1. THE Problem_List SHALL apply the Design_System background, surface, border, and typography tokens consistently.
2. THE Problem_List SHALL display a header with the CodeForge DSA logo/wordmark and a branded icon.
3. THE Problem_List SHALL render the problems table inside a rounded, bordered container with row hover effects.
4. THE Problem_List SHALL display difficulty badges using the same pill-style and color mapping defined in Requirement 2.
5. THE Problem_List SHALL display a search input and difficulty filter dropdown with consistent styling matching the Design_System.
6. WHEN no problems match the active search or filter, THE Problem_List SHALL display an empty state message with a descriptive icon.

---

### Requirement 8: Workspace Layout Integrity

**User Story:** As a developer, I want the three-panel Workspace layout to remain stable and functional after the UI upgrade, so that the core coding experience is not disrupted.

#### Acceptance Criteria

1. THE Workspace SHALL maintain the three-panel layout (Problem Panel, Editor Panel, Execution Panel) with proportional widths after all UI changes.
2. THE Workspace SHALL NOT alter any backend API calls, data-fetching logic, or code execution logic.
3. THE Workspace SHALL NOT alter the routing structure or URL parameters.
4. THE Workspace SHALL apply the Design_System background and border tokens to the outer panel containers.
5. THE Workspace SHALL display a navigation header with a back-link to the Problem List page.
