import { describe, expect, it } from 'vitest';
import { formatDate, formatPercent, formatUsd, formatUsdWhole, humanize } from './format';

describe('format helpers', () => {
  it('formats cents as USD', () => {
    expect(formatUsd(123456)).toBe('$1,234.56');
    expect(formatUsd(0)).toBe('$0.00');
    expect(formatUsd(-500)).toBe('-$5.00');
  });

  it('formats cents as whole USD', () => {
    expect(formatUsdWhole(123456)).toBe('$1,235');
  });

  it('formats percentages with one decimal', () => {
    expect(formatPercent(33.333)).toBe('33.3%');
  });

  it('formats dates in UTC', () => {
    expect(formatDate(new Date('2026-03-01T23:30:00Z'))).toBe('2026-03-01');
    expect(formatDate(null)).toBe('—');
  });

  it('humanizes enum values', () => {
    expect(humanize('MEETING_SET')).toBe('Meeting set');
    expect(humanize('A')).toBe('A');
  });
});
