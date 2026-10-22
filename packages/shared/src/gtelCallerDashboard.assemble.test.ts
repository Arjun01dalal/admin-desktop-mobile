import { describe, expect, it } from 'vitest';
import { assembleGtelCallerDashboard } from './gtelCallerDashboard';

describe('assembleGtelCallerDashboard', () => {
  it('returns empty message when dashboard has no rows', () => {
    const result = assembleGtelCallerDashboard({
      dashBody: { callers: [], totals: {} },
      restrictToAssignedCallers: false,
      roleId: '',
      userId: '',
      empCode: '',
      loginNames: [],
    });
    expect(result.callers).toEqual([]);
    expect(result.emptyMessage).toBe('No dashboard data for selected filters.');
  });

  it('returns head empty message when restricted and no matches', () => {
    const result = assembleGtelCallerDashboard({
      dashBody: {
        callers: [{ name: 'A', empCode: 'E1', total: 1, answered: 0 }],
      },
      allotByRole: [],
      restrictToAssignedCallers: true,
      roleId: 'head',
      userId: 'u1',
      empCode: 'H1',
      loginNames: ['Head Name'],
    });
    expect(result.callers).toEqual([]);
    expect(result.emptyMessage).toBe('No assigned callers for this head.');
  });
});
