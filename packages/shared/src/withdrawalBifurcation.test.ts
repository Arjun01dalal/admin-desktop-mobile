import { describe, expect, it } from 'vitest';
import {
  BIFURCATION_MAX_RANGE_DAYS,
  bifurcationResultToCsv,
  formatBifurcationCompact,
  formatPlayedCode,
  formatPlayedLabel,
  getBifurcationSummary,
  parseBifurcationResult,
  sortBifurcationChartData,
  toBifurcationChartData,
  validateBifurcationDateRange,
  type BifurcationRow,
} from './withdrawalBifurcation';

describe('formatPlayedLabel / formatPlayedCode', () => {
  it('maps E/C/S combinations', () => {
    expect(formatPlayedCode('ec')).toBe('EC');
    expect(formatPlayedLabel('EC')).toBe('Exchange + Casino');
    expect(formatPlayedLabel('NONE')).toBe('None');
    expect(formatPlayedLabel('')).toBe('—');
  });
});

describe('formatBifurcationCompact', () => {
  it('formats amount in Indian compact units', () => {
    expect(formatBifurcationCompact(1480953, 'amount')).toBe('14.8L');
    expect(formatBifurcationCompact(1_50_00_000, 'amount')).toBe('1.5Cr');
    expect(formatBifurcationCompact(2000, 'amount')).toBe('2K');
  });

  it('formats count compactly', () => {
    expect(formatBifurcationCompact(1500, 'count')).toBe('1.5K');
    expect(formatBifurcationCompact(42, 'count')).toBe('42');
  });
});

describe('parseBifurcationResult', () => {
  it('parses bifurcation + statusTotals envelopes', () => {
    const parsed = parseBifurcationResult({
      bifurcation: [
        {
          played: 'E',
          totalAmount: 100,
          totalCount: 2,
          approved: { amount: 80, count: 1 },
        },
      ],
      statusTotals: {
        approved: { amount: 80, count: 1 },
        pending: { amount: 20, count: 1 },
        totalAmount: 100,
        totalCount: 2,
      },
    });
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].played).toBe('E');
    expect(parsed.rows[0].approved?.amount).toBe(80);
    expect(parsed.statusTotals?.totalAmount).toBe(100);
    expect(parsed.statusTotals?.pending?.count).toBe(1);
  });

  it('accepts items[] and totals alias', () => {
    const parsed = parseBifurcationResult({
      items: [{ played: 'C', totalAmount: 50, count: 3 }],
      totals: { approved: { amount: 50, count: 3 } },
    });
    expect(parsed.rows[0].totalCount).toBe(3);
    expect(parsed.statusTotals?.approved?.amount).toBe(50);
  });
});

describe('getBifurcationSummary', () => {
  it('prefers explicit status total fields', () => {
    const summary = getBifurcationSummary(
      [{ played: 'E', totalAmount: 10, totalCount: 1 }],
      { totalAmount: 99, totalCount: 7, approved: { amount: 1, count: 1 } },
    );
    expect(summary).toEqual({ totalAmount: 99, totalCount: 7 });
  });

  it('falls back to row sums', () => {
    const rows: BifurcationRow[] = [
      { played: 'E', totalAmount: 10, totalCount: 1 },
      { played: 'C', totalAmount: 5, totalCount: 2 },
    ];
    expect(getBifurcationSummary(rows, null)).toEqual({ totalAmount: 15, totalCount: 3 });
  });
});

describe('chart data helpers', () => {
  it('maps rows and sorts descending by metric', () => {
    const data = toBifurcationChartData([
      { played: 'C', totalAmount: 100, totalCount: 9, approved: { amount: 100, count: 9 } },
      { played: 'E', totalAmount: 500, totalCount: 2, approved: { amount: 500, count: 2 } },
    ]);
    expect(data[0].code).toBe('C');
    expect(data[0].segments.length).toBeGreaterThan(0);
    expect(sortBifurcationChartData(data, 'amount').map((d) => d.code)).toEqual(['E', 'C']);
    expect(sortBifurcationChartData(data, 'count').map((d) => d.code)).toEqual(['C', 'E']);
  });
});

describe('validateBifurcationDateRange', () => {
  it('rejects missing, order, and oversized ranges', () => {
    expect(validateBifurcationDateRange('', '2026-01-02').ok).toBe(false);
    expect(validateBifurcationDateRange('2026-01-10', '2026-01-01').code).toBe('order');
    expect(
      validateBifurcationDateRange('2026-01-01', '2026-04-01', BIFURCATION_MAX_RANGE_DAYS).code,
    ).toBe('range');
    expect(validateBifurcationDateRange('2026-01-01', '2026-01-15').ok).toBe(true);
  });
});

describe('bifurcationResultToCsv', () => {
  it('includes headers and status totals footer', () => {
    const csv = bifurcationResultToCsv(
      [{ played: 'E', totalAmount: 10, totalCount: 1, approved: { amount: 10, count: 1 } }],
      { approved: { amount: 10, count: 1 }, totalAmount: 10, totalCount: 1 },
    );
    expect(csv).toContain('Played');
    expect(csv).toContain('Exchange');
    expect(csv).toContain('STATUS TOTALS');
  });
});

describe('bifurcation smoke pipeline', () => {
  it('validates → parses → charts → exports', () => {
    const dates = validateBifurcationDateRange('2026-10-01', '2026-10-07');
    expect(dates.ok).toBe(true);
    const parsed = parseBifurcationResult({
      bifurcation: [
        { played: 'E', totalAmount: 200, totalCount: 2, approved: { amount: 200, count: 2 } },
        { played: 'C', totalAmount: 50, totalCount: 5, pending: { amount: 50, count: 5 } },
      ],
      statusTotals: { totalAmount: 250, totalCount: 7 },
    });
    const chart = sortBifurcationChartData(toBifurcationChartData(parsed.rows), 'amount');
    expect(chart[0].code).toBe('E');
    const csv = bifurcationResultToCsv(parsed.rows, parsed.statusTotals);
    expect(csv.split('\n').length).toBeGreaterThan(2);
    expect(getBifurcationSummary(parsed.rows, parsed.statusTotals).totalAmount).toBe(250);
  });
});
