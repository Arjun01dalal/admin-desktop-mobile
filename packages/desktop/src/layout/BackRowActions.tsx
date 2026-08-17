import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type BackRowActionsContextValue = {
  actions: ReactNode;
  setActions: (node: ReactNode) => void;
};

const BackRowActionsContext = createContext<BackRowActionsContextValue | null>(
  null,
);

/** Provides a slot rendered beside AppShell's Back button. */
export function BackRowActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);
  const setActions = useCallback((node: ReactNode) => {
    setActionsState(node);
  }, []);
  const value = useMemo(
    () => ({ actions, setActions }),
    [actions, setActions],
  );
  return (
    <BackRowActionsContext.Provider value={value}>
      {children}
    </BackRowActionsContext.Provider>
  );
}

export function useBackRowActionsSlot(): ReactNode {
  return useContext(BackRowActionsContext)?.actions ?? null;
}

/**
 * Registers content into the AppShell Back row (clears on unmount).
 * Render this from a page — returns null in-tree.
 */
export function BackRowActions({ children }: { children: ReactNode }) {
  const setActions = useContext(BackRowActionsContext)?.setActions;
  useLayoutEffect(() => {
    if (!setActions) return;
    setActions(children);
    return () => setActions(null);
  }, [setActions, children]);
  return null;
}
