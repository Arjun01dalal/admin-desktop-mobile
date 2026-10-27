import { describe, expect, it } from 'vitest';
import { parseSubAdminOptions, parseSubAdminsFromByRole } from './dailyAccountReport';

describe('parseSubAdminsFromByRole', () => {
  it('flattens byRole.subAdmins and skips blocked', () => {
    const options = parseSubAdminsFromByRole({
      byRole: [
        {
          roleName: 'Caller',
          subAdmins: [
            { _id: 'a1', name: 'Alice', empCode: '100' },
            { _id: 'a2', name: 'Blocked', block: true },
          ],
        },
        {
          roleName: 'Manager',
          subAdmins: [{ _id: 'a1', name: 'Alice Dup' }, { _id: 'b1', name: 'Bob' }],
        },
      ],
    });
    expect(options.map((o) => o.id).sort()).toEqual(['a1', 'b1']);
    expect(options.find((o) => o.id === 'a1')?.name).toBe('Alice');
  });
});

describe('parseSubAdminOptions', () => {
  it('reads payload.items', () => {
    const options = parseSubAdminOptions({
      payload: { items: [{ _id: 'x1', name: 'X', Block: false }] },
    });
    expect(options).toHaveLength(1);
    expect(options[0].id).toBe('x1');
  });

  it('reads users array envelopes', () => {
    const options = parseSubAdminOptions({
      users: [{ _id: 'u1', Name: 'Uma' }],
    });
    expect(options).toHaveLength(1);
    expect(options[0].name).toBe('Uma');
  });
});
