import { describe, expect, it } from 'vitest';
import { mergeTargetParams } from './panelTargetParams';

describe('mergeTargetParams', () => {
  it('parses search query string', () => {
    expect(mergeTargetParams({ search: '?startDate=2026-01-01&type=falcon' })).toEqual({
      startDate: '2026-01-01',
      type: 'falcon',
    });
  });

  it('merges state over search keys', () => {
    expect(
      mergeTargetParams({
        search: 'status=Approved',
        state: { status: 'Pending', endDate: '2026-02-02' },
      }),
    ).toEqual({
      status: 'Pending',
      endDate: '2026-02-02',
    });
  });

  it('handles empty target', () => {
    expect(mergeTargetParams({})).toEqual({});
  });
});
