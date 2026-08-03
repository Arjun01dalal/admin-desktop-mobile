import { createContext, useContext, type ReactNode } from 'react';

/**
 * One helper for per-feature table filter contexts.
 * Keeps the same Provider / useFilters shape everywhere.
 */
export function createTableFiltersContext<T>(displayName: string) {
  const Context = createContext<T | null>(null);
  Context.displayName = displayName;

  function Provider({ value, children }: { value: T; children: ReactNode }) {
    return <Context.Provider value={value}>{children}</Context.Provider>;
  }
  Provider.displayName = `${displayName}Provider`;

  function useFilters(): T {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error(`use${displayName} must be used inside ${displayName}Provider`);
    }
    return ctx;
  }

  return { Provider, useFilters, Context };
}
