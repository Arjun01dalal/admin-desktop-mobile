import { describe, expect, it } from 'vitest';
import {
  parseGatewayUpisResponse,
  parseTypeSettings,
  readTypeActiveFlag,
  setTypeSettingActive,
} from './gatewayMid';

describe('readTypeActiveFlag', () => {
  it('reads booleans and status tokens', () => {
    expect(readTypeActiveFlag(true)).toBe(true);
    expect(readTypeActiveFlag('stopped')).toBe(false);
    expect(readTypeActiveFlag('running')).toBe(true);
    expect(readTypeActiveFlag({ action: 'stop' })).toBe(true);
    expect(readTypeActiveFlag({ action: 'start' })).toBe(false);
  });
});

describe('parseTypeSettings', () => {
  it('parses array and map shapes', () => {
    expect(parseTypeSettings([{ type: 'whatsapp', isActive: true }])).toEqual([
      { type: 'whatsapp', isActive: true },
    ]);
    expect(parseTypeSettings({ telegram: false, 'upi-payment': 'running' })).toEqual([
      { type: 'telegram', isActive: false },
      { type: 'upi-payment', isActive: true },
    ]);
  });
});

describe('parseGatewayUpisResponse typeSettings', () => {
  it('returns typeSettings from payload root', () => {
    const parsed = parseGatewayUpisResponse({
      gateways: [{ name: 'g1', upis: [{ mid: 'm1', type: 'whatsapp' }] }],
      types: ['whatsapp'],
      typeSettings: [{ type: 'whatsapp', isActive: true }],
    });
    expect(parsed.typeSettings).toEqual([{ type: 'whatsapp', isActive: true }]);
    expect(parsed.types).toEqual(['whatsapp']);
    expect(parsed.rows).toHaveLength(1);
  });
});

describe('setTypeSettingActive', () => {
  it('updates or inserts type setting', () => {
    expect(setTypeSettingActive([{ type: 'a', isActive: false }], 'a', true)).toEqual([
      { type: 'a', isActive: true },
    ]);
    expect(setTypeSettingActive([], 'b', true)).toEqual([{ type: 'b', isActive: true }]);
  });
});
