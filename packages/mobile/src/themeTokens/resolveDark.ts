/** Pure theme resolution (no React Native imports — unit-testable). */

export type ThemeMode = 'dark' | 'light' | 'system';

/** Resolve whether the given mode should use the dark palette. */
export function resolveDark(
  mode: ThemeMode,
  systemScheme?: string | null | undefined,
): boolean {
  if (mode === 'light') return false;
  if (mode === 'dark') return true;
  return systemScheme !== 'light';
}
