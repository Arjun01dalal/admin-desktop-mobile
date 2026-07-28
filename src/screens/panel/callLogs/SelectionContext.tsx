import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CallLogRow } from './types';

type CallLogsSelectionValue = {
  selectedSids: Set<string>;
  allSelected: boolean;
  indeterminate: boolean;
  toggleRow: (callSid: string) => void;
  toggleAll: () => void;
  clearSelection: () => void;
  selectedRows: CallLogRow[];
};

const CallLogsSelectionContext = createContext<CallLogsSelectionValue | null>(null);

export function CallLogsSelectionProvider({
  calls,
  children,
}: {
  calls: CallLogRow[];
  children: ReactNode;
}) {
  const [selectedSids, setSelectedSids] = useState<Set<string>>(() => new Set());

  const clearSelection = useCallback(() => {
    setSelectedSids(new Set());
  }, []);

  const toggleRow = useCallback((callSid: string) => {
    if (!callSid) return;
    setSelectedSids((prev) => {
      const next = new Set(prev);
      if (next.has(callSid)) next.delete(callSid);
      else next.add(callSid);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedSids((prev) => {
      const ids = calls.map((c) => String(c.call_sid || '')).filter(Boolean);
      if (prev.size > 0 && prev.size === ids.length) return new Set();
      return new Set(ids);
    });
  }, [calls]);

  const value = useMemo<CallLogsSelectionValue>(() => {
    const selectable = calls.map((c) => String(c.call_sid || '')).filter(Boolean);
    const allSelected =
      selectable.length > 0 && selectedSids.size === selectable.length;
    const indeterminate = selectedSids.size > 0 && !allSelected;
    const selectedRows = calls.filter((c) =>
      selectedSids.has(String(c.call_sid || '')),
    );
    return {
      selectedSids,
      allSelected,
      indeterminate,
      toggleRow,
      toggleAll,
      clearSelection,
      selectedRows,
    };
  }, [calls, selectedSids, toggleRow, toggleAll, clearSelection]);

  return (
    <CallLogsSelectionContext.Provider value={value}>
      {children}
    </CallLogsSelectionContext.Provider>
  );
}

export function useCallLogsSelection() {
  const ctx = useContext(CallLogsSelectionContext);
  if (!ctx) {
    throw new Error(
      'useCallLogsSelection must be used inside CallLogsSelectionProvider',
    );
  }
  return ctx;
}
