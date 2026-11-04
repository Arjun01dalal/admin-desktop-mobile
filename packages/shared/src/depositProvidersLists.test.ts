import { describe, expect, it } from 'vitest';
import {
  buildCityNotAllowedPayload,
  buildStateNotAllowedPayload,
  buildWhatsappRedirectionLink,
  matchListOption,
  normalizeStringList,
  parseRedirectionMobile,
  splitListInput,
} from './depositProvidersLists';

describe('normalizeStringList', () => {
  it('keeps plain string arrays', () => {
    expect(normalizeStringList(['Mumbai', 'Delhi'])).toEqual(['Mumbai', 'Delhi']);
  });

  it('parses nested cities / states payloads', () => {
    expect(normalizeStringList({ cities: ['Pune', 'Nagpur'] })).toEqual(['Pune', 'Nagpur']);
    expect(normalizeStringList({ states: ['Goa'] })).toEqual(['Goa']);
  });

  it('splits comma strings and dedupes case-insensitively', () => {
    expect(normalizeStringList('Goa, goa, Kerala')).toEqual(['Goa', 'Kerala']);
  });

  it('reads name/value objects', () => {
    expect(normalizeStringList([{ name: 'A' }, { value: 'B' }])).toEqual(['A', 'B']);
  });
});

describe('payload builders', () => {
  it('builds city / state updateBonusAndClients shapes', () => {
    expect(buildCityNotAllowedPayload([' a ', 'b'], 'add')).toEqual({
      cities: ['a', 'b'],
      action: 'add',
    });
    expect(buildStateNotAllowedPayload(['Goa'], 'add')).toEqual({
      states: ['Goa'],
      action: 'add',
    });
  });

  it('splits comma input', () => {
    expect(splitListInput('Mumbai, Pune')).toEqual(['Mumbai', 'Pune']);
  });
});

describe('redirection mobile helpers', () => {
  it('parses wa.me links and strips 91 for 10-digit mobiles', () => {
    expect(parseRedirectionMobile('https://wa.me/919876543210')).toBe('9876543210');
    expect(parseRedirectionMobile('https://wa.me/9876543210')).toBe('9876543210');
  });

  it('builds wa.me links', () => {
    expect(buildWhatsappRedirectionLink('9876543210')).toBe('https://wa.me/9876543210');
  });

  it('matches options by digit suffix', () => {
    expect(matchListOption('9876543210', ['+91 9876543210'])).toBe('+91 9876543210');
  });
});
