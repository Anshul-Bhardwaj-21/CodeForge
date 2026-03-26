import { describe, it, expect } from 'vitest';
import {
  computeSummary,
  computeStreaks,
  getRecentSubmissions,
  buildHeatmapData,
  getHeatmapIntensity,
} from './progressStats';

describe('computeSummary', () => {
  it('returns zeros for empty progress', () => {
    expect(computeSummary({})).toEqual({ solved: 0, attempted: 0, totalSubmissions: 0 });
    expect(computeSummary({ problems: {} })).toEqual({ solved: 0, attempted: 0, totalSubmissions: 0 });
  });
});

describe('computeStreaks', () => {
  it('returns { current: 0, longest: 0 } for empty progress', () => {
    expect(computeStreaks({})).toEqual({ current: 0, longest: 0 });
    expect(computeStreaks({ problems: {} })).toEqual({ current: 0, longest: 0 });
  });
});

describe('getRecentSubmissions', () => {
  it('returns all submissions when fewer than 10 exist', () => {
    const progressData = {
      problems: {
        'two-sum': {
          status: 'solved',
          submissions: [
            { submittedAt: '2024-01-01T10:00:00Z', verdict: 'accepted', language: 'javascript', timeTaken: 100 },
            { submittedAt: '2024-01-02T10:00:00Z', verdict: 'wrong_answer', language: 'javascript', timeTaken: 80 },
            { submittedAt: '2024-01-03T10:00:00Z', verdict: 'accepted', language: 'python', timeTaken: 120 },
          ],
        },
      },
    };
    const problems = [{ id: 'two-sum', title: 'Two Sum' }];
    const result = getRecentSubmissions(progressData, problems, 10);
    expect(result).toHaveLength(3);
  });
});

describe('buildHeatmapData', () => {
  it('returns exactly 364 entries for a known today date', () => {
    const today = new Date('2024-06-15');
    const result = buildHeatmapData({}, today);
    expect(result.size).toBe(364);
  });
});

describe('getHeatmapIntensity', () => {
  it('returns correct bucket for boundary values', () => {
    expect(getHeatmapIntensity(0)).toBe(0);
    expect(getHeatmapIntensity(1)).toBe(1);
    expect(getHeatmapIntensity(2)).toBe(2);
    expect(getHeatmapIntensity(3)).toBe(2);
    expect(getHeatmapIntensity(4)).toBe(3);
    expect(getHeatmapIntensity(6)).toBe(3);
    expect(getHeatmapIntensity(7)).toBe(4);
  });
});
