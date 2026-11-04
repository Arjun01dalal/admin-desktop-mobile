import { describe, expect, it } from 'vitest';
import { parseNaradAskBlocks } from './naradAskMarkdown';

describe('parseNaradAskBlocks', () => {
  it('parses intro text + markdown table', () => {
    const answer = [
      'Here is the withdrawal approved rate per caller for the last 10 days (2024-10-22 to 2024-11-01):',
      '',
      '| Caller Name | EmpCode | Total Requests | Approved | Approval Rate (%) |',
      '|---|---|---|---|---|',
      '| Kiara | 9608010119 | 23 | 11 | 47.83 |',
      '| Riddhi | 9608010113 | 22 | 9 | 40.91 |',
      '| NEHA | 9608010109 | 14 | 3 | 21.43 |',
    ].join('\n');

    const blocks = parseNaradAskBlocks(answer);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: 'text',
      text: 'Here is the withdrawal approved rate per caller for the last 10 days (2024-10-22 to 2024-11-01):',
    });
    expect(blocks[1].type).toBe('table');
    if (blocks[1].type === 'table') {
      expect(blocks[1].headers).toEqual([
        'Caller Name',
        'EmpCode',
        'Total Requests',
        'Approved',
        'Approval Rate (%)',
      ]);
      expect(blocks[1].rows[0]).toEqual(['Kiara', '9608010119', '23', '11', '47.83']);
      expect(blocks[1].rows).toHaveLength(3);
    }
  });

  it('returns plain text when no table', () => {
    expect(parseNaradAskBlocks('Hello world')).toEqual([{ type: 'text', text: 'Hello world' }]);
  });
});
