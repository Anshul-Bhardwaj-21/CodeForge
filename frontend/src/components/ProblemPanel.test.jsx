// Feature: premium-dark-theme-ui
import React from 'react';
import { render, screen } from '@testing-library/react';
import * as fc from 'fast-check';
import ProblemPanel from './ProblemPanel';

const makeProblem = (overrides = {}) => ({
  id: 1,
  title: 'Two Sum',
  difficulty: 'Easy',
  tags: ['Array', 'Hash Table'],
  description: 'Given an array of integers.',
  examples: [{ input: '[2,7,11,15]\n9', output: '[0,1]', explanation: 'nums[0] + nums[1] == 9' }],
  constraints: '2 <= nums.length <= 10^4',
  ...overrides,
});

// Property 1: difficulty badge color mapping
describe('Property 1: difficulty badge color mapping', () => {
  it('renders the correct color class for each difficulty', () => {
    fc.assert(
      fc.property(fc.constantFrom('Easy', 'Medium', 'Hard'), (difficulty) => {
        const { container, unmount } = render(<ProblemPanel problem={makeProblem({ difficulty })} />);
        const badge = container.querySelector('span');
        const colorMap = {
          Easy: '#22c55e',
          Medium: '#eab308',
          Hard: '#ef4444',
        };
        const expectedColor = colorMap[difficulty];
        expect(badge.className).toContain(expectedColor);
        unmount();
      }),
      { numRuns: 100 }
    );
  });
});

// Property 2: tag pill shape
describe('Property 2: tag pill shape', () => {
  it('every tag span has rounded-full class', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
        (tags) => {
          const { container, unmount } = render(<ProblemPanel problem={makeProblem({ tags })} />);
          // Tag spans are after the difficulty badge — all spans with rounded-full
          const allSpans = Array.from(container.querySelectorAll('span'));
          // The tag spans (not the difficulty badge) — find spans that contain tag text
          const tagSpans = allSpans.filter((span) => tags.includes(span.textContent));
          expect(tagSpans.length).toBe(tags.length);
          tagSpans.forEach((span) => {
            expect(span.className).toContain('rounded-full');
          });
          unmount();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Unit tests: skeleton loader and scrollable panel
describe('ProblemPanel unit tests', () => {
  it('renders animate-pulse skeleton when problem is null', () => {
    const { container } = render(<ProblemPanel problem={null} />);
    const pulsing = container.querySelector('.animate-pulse');
    expect(pulsing).toBeInTheDocument();
  });

  it('root element has overflow-y-auto when problem is provided', () => {
    const { container } = render(<ProblemPanel problem={makeProblem()} />);
    const root = container.firstChild;
    expect(root.className).toContain('overflow-y-auto');
  });
});
