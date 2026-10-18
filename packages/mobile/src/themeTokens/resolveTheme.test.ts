import { describe, expect, it } from 'vitest';
import { resolveDark } from './resolveDark';

describe('resolveDark', () => {
  it('forces light / dark modes', () => {
    expect(resolveDark('light', 'dark')).toBe(false);
    expect(resolveDark('dark', 'light')).toBe(true);
  });

  it('follows system scheme', () => {
    expect(resolveDark('system', 'light')).toBe(false);
    expect(resolveDark('system', 'dark')).toBe(true);
    expect(resolveDark('system', null)).toBe(true);
  });
});
