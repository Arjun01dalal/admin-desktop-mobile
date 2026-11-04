import { describe, expect, it } from 'vitest';
import { bifurcationQueryKey } from './bifurcationTypes';

describe('bifurcationQueryKey smoke', () => {
  it('is stable for identical date params', () => {
    const a = bifurcationQueryKey({
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      clientName: '',
    });
    const b = bifurcationQueryKey({
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      clientName: '',
    });
    expect(a).toEqual(b);
    expect(a[0]).toBe('withdrawals');
    expect(a[1]).toBe('playedBifurcation');
  });
});
