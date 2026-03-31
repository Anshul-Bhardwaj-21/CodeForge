// Feature: premium-dark-theme-ui
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProblemList from './ProblemList';

vi.mock('../utils/api', () => ({
  getProblems: vi.fn(),
  getProgress: vi.fn().mockResolvedValue({ problems: {} }),
}));

import { getProblems } from '../utils/api';

const sampleProblems = [
  { id: 1, title: 'Two Sum', difficulty: 'Easy', tags: ['Array', 'Hash Table'] },
  { id: 2, title: 'Add Two Numbers', difficulty: 'Medium', tags: ['Linked List'] },
  { id: 3, title: 'Median of Two Sorted Arrays', difficulty: 'Hard', tags: ['Array', 'Binary Search'] },
];

const renderProblemList = () =>
  render(
    <MemoryRouter>
      <ProblemList />
    </MemoryRouter>
  );

describe('ProblemList unit tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows "No problems found" when getProblems returns empty array', async () => {
    getProblems.mockResolvedValue([]);
    renderProblemList();
    await waitFor(() => {
      expect(screen.getByText(/No problems found/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when search matches nothing', async () => {
    getProblems.mockResolvedValue(sampleProblems);
    renderProblemList();
    await waitFor(() => {
      expect(screen.getByText(/Two Sum/i)).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText(/Search problems or tags/i);
    fireEvent.change(searchInput, { target: { value: 'xyznonexistent' } });
    await waitFor(() => {
      expect(screen.getByText(/No problems found/i)).toBeInTheDocument();
    });
  });

  it('difficulty badges have rounded-full class', async () => {
    getProblems.mockResolvedValue(sampleProblems);
    const { container } = renderProblemList();
    await waitFor(() => {
      expect(screen.getByText(/Two Sum/i)).toBeInTheDocument();
    });
    // Find all difficulty badge spans
    const badges = Array.from(container.querySelectorAll('span')).filter((span) =>
      ['Easy', 'Medium', 'Hard'].includes(span.textContent)
    );
    expect(badges.length).toBeGreaterThan(0);
    badges.forEach((badge) => {
      expect(badge.className).toContain('rounded-full');
    });
  });
});
