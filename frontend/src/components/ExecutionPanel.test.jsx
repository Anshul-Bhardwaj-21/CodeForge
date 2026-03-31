// Feature: premium-dark-theme-ui
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import * as fc from 'fast-check';
import ExecutionPanel from './ExecutionPanel';

import { runCode, submitCode } from '../utils/api';

vi.mock('../utils/api', () => ({
  runCode: vi.fn(),
  submitCode: vi.fn(),
}));

// Mock clipboard
Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  writable: true,
});

const defaultProps = {
  problemId: '1',
  language: 'cpp',
  code: 'int main(){}',
  customInput: '',
  setCustomInput: vi.fn(),
  outputData: null,
  setOutputData: vi.fn(),
  submitResult: null,
  setSubmitResult: vi.fn(),
  isLoading: false,
  setIsLoading: vi.fn(),
};

// Property 3: output text whitespace-pre-wrap
describe('Property 3: output text whitespace-pre-wrap', () => {
  it('all <pre> elements have whitespace-pre-wrap class', () => {
    fc.assert(
      fc.property(fc.string(), (output) => {
        const { container, unmount } = render(
          <ExecutionPanel
            {...defaultProps}
            outputData={{ status: 'success', output }}
          />
        );
        const preElements = container.querySelectorAll('pre');
        preElements.forEach((pre) => {
          expect(pre.className).toContain('whitespace-pre-wrap');
        });
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// Property 4: button hover variants present
describe('Property 4: button hover variants present', () => {
  it('Run and Submit buttons always have correct hover classes', () => {
    fc.assert(
      fc.property(fc.constant(null), () => {
        const { container, unmount } = render(<ExecutionPanel {...defaultProps} />);
        const buttons = container.querySelectorAll('button');
        const runBtn = Array.from(buttons).find((b) => b.textContent.includes('Run'));
        const submitBtn = Array.from(buttons).find((b) => b.textContent.includes('Submit'));
        expect(runBtn.className).toContain('hover:bg-[#2563eb]');
        expect(submitBtn.className).toContain('hover:bg-[#16a34a]');
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// Property 5: all controls disabled during loading (triggered by clicking Run)
describe('Property 5: all interactive controls disabled during loading', () => {
  it('Run and Submit buttons are disabled and have disabled:opacity-50 while a run is in progress', async () => {
    // Make runCode hang so we can inspect the loading state
    runCode.mockImplementation(() => new Promise(() => {}));

    const { container } = render(<ExecutionPanel {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const runBtn = Array.from(buttons).find((b) => b.textContent.includes('Run'));
    const submitBtn = Array.from(buttons).find((b) => b.textContent.includes('Submit'));

    // Before clicking — buttons should be enabled
    expect(runBtn).not.toBeDisabled();

    fireEvent.click(runBtn);

    // After clicking — both buttons should be disabled
    await waitFor(() => {
      expect(runBtn).toBeDisabled();
      expect(submitBtn).toBeDisabled();
    });

    expect(runBtn.className).toContain('disabled:opacity-50');
    expect(submitBtn.className).toContain('disabled:opacity-50');
  });
});

// Property 6: status indicator correctness
describe('Property 6: status indicator correctness', () => {
  it('shows correct status text and color for each result type', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('success_run', 'wrong_answer', 'runtime_error'),
        (scenario) => {
          let props = { ...defaultProps };

          if (scenario === 'success_run') {
            props = { ...props, outputData: { status: 'success', output: 'ok' } };
          } else if (scenario === 'wrong_answer') {
            props = { ...props, submitResult: { passed: 0, total: 1, details: [] } };
          } else {
            props = { ...props, outputData: { status: 'error', error: 'oops' } };
          }

          const { container, unmount } = render(<ExecutionPanel {...props} />);

          if (scenario === 'success_run') {
            expect(screen.getByText('Accepted')).toBeInTheDocument();
            const acceptedEl = screen.getByText('Accepted').closest('div');
            expect(acceptedEl.className).toContain('text-[#22c55e]');
          } else if (scenario === 'wrong_answer') {
            expect(screen.getByText('Wrong Answer')).toBeInTheDocument();
            const wrongEl = screen.getByText('Wrong Answer').closest('div');
            expect(wrongEl.className).toContain('text-[#ef4444]');
          } else {
            expect(screen.getByText('Runtime Error')).toBeInTheDocument();
            const errorEl = screen.getByText('Runtime Error').closest('div');
            expect(errorEl.className).toContain('text-[#f97316]');
          }

          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests: loading spinner+message, fade-in on result, copy button toggle
describe('ExecutionPanel unit tests', () => {
  it('shows animate-spin spinner and "Executing on server..." when Run is clicked', async () => {
    runCode.mockImplementation(() => new Promise(() => {}));
    const { container } = render(<ExecutionPanel {...defaultProps} />);
    const buttons = container.querySelectorAll('button');
    const runBtn = Array.from(buttons).find((b) => b.textContent.includes('Run'));
    fireEvent.click(runBtn);
    await waitFor(() => {
      expect(container.querySelector('.animate-spin')).toBeInTheDocument();
      expect(screen.getByText('Executing on server...')).toBeInTheDocument();
    });
  });

  it('result container has animate-in and fade-in classes when outputData is present', () => {
    const { container } = render(
      <ExecutionPanel
        {...defaultProps}
        outputData={{ status: 'success', output: 'hello' }}
      />
    );
    const animatedDiv = container.querySelector('.animate-in.fade-in');
    expect(animatedDiv).toBeInTheDocument();
  });

  it('copy button toggles to Check icon (text-[#22c55e]) and back after 2s', async () => {
    vi.useFakeTimers();
    const { container } = render(
      <ExecutionPanel
        {...defaultProps}
        outputData={{ status: 'success', output: 'some output text' }}
      />
    );

    // Copy button should be present
    const copyBtn = container.querySelector('button[title="Copy to clipboard"]');
    expect(copyBtn).toBeInTheDocument();

    // Click copy button
    fireEvent.click(copyBtn);

    // Check icon should appear (text-[#22c55e] on the svg/icon)
    const checkIcon = container.querySelector('.text-\\[\\#22c55e\\]');
    expect(checkIcon).toBeInTheDocument();

    // Advance timers by 2000ms
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Copy icon should be back (no text-[#22c55e] on the icon)
    const checkIconAfter = container.querySelector('button[title="Copy to clipboard"] .text-\\[\\#22c55e\\]');
    expect(checkIconAfter).not.toBeInTheDocument();

    vi.useRealTimers();
  });
});
