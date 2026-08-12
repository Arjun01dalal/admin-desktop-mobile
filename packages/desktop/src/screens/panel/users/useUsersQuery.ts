import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import { DEFAULT_ITEMS_PER_PAGE } from '@/utils/pagination';
import { todayIstYmd, unpackGlobalsPayload } from './toolbarHelpers';
import type { UserType } from './constants';
import {
  EMPTY_USER_FILTERS,
  actionForType,
  buildPayloadForType,
  buildUserFilter,
  empCodesEqual,
  excludeDumped,
  filterListByLoginEmpCode,
  filterSearchByEmpCode,
  hasOtherUserSearch,
  resolveSearchEmpCode,
  unpackByType,
  type UserFilters,
  type UserRow,
} from './utils';

export type UsersAdmin = {
  _id?: string;
  name?: string;
  mobile?: string;
  empCode?: string;
  Role_ID?: string;
  clientName?: string | string[];
  allotedApps?: string | string[];
  accessibleStates?: string[];
  appWithState?: Record<string, string[]>;
  extensionId?: string[] | string;
  serverId?: string | number;
};

type Params = {
  allottedApps: string | string[] | undefined;
  accessibleStates: string[];
  loginEmpCode: string;
  appsKey: string;
  adminAppWithState?: Record<string, string[]>;
  isCaller: boolean;
  canViewSubAdmin: boolean;
  canViewUserType: boolean;
};

export function useUsersQuery({
  allottedApps,
  accessibleStates,
  loginEmpCode,
  appsKey,
  adminAppWithState,
  isCaller,
  canViewSubAdmin,
  canViewUserType,
}: Params) {
  const typeOptions = useMemo(() => {
    // Match laxminarayan Users select options (permission + caller gates)
    const values: UserType[] = [];
    if (canViewUserType) values.push('User');
    if (canViewSubAdmin) values.push('Sub_Admin');
    if (!isCaller) {
      values.push('Todays_Active', 'Active_User');
    }
    values.push(
      'Non_Performing_User',
      'In_Active_Deposit',
      'Non_Performing_Active_User',
    );
    if (!isCaller) values.push('LAXMI_999_Users');

    // Fallback: always allow User so the page is never empty
    if (values.length === 0) values.push('User');

    return values.map((value) => ({ value, label: value }));
  }, [canViewSubAdmin, canViewUserType, isCaller]);

  const [userType, setUserType] = useState<UserType>('User');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(DEFAULT_ITEMS_PER_PAGE);
  const [clientName, setClientName] = useState('');
  const [playedIn, setPlayedIn] = useState('');
  const [uniqueUser, setUniqueUser] = useState(false);
  const [draft, setDraft] = useState<UserFilters>(EMPTY_USER_FILTERS);
  const [applied, setApplied] = useState<UserFilters>(EMPTY_USER_FILTERS);

  const [rows, setRows] = useState<UserRow[]>([]);
  const [dialerData, setDialerData] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const deferredRows = useDeferredValue(rows);
  const isClientPagedType = userType === 'Non_Performing_Active_User';
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage) || 1);
  const tableRows = useMemo(() => {
    // API returns the full list (no pageNo) — paginate on the client.
    if (!isClientPagedType) return deferredRows;
    const start = (page - 1) * itemsPerPage;
    return deferredRows.slice(start, start + itemsPerPage);
  }, [deferredRows, isClientPagedType, page, itemsPerPage]);

  // Keep selection on allowed types (caller / permission gates)
  useEffect(() => {
    if (!typeOptions.some((opt) => opt.value === userType)) {
      setUserType('User');
    }
  }, [typeOptions, userType]);

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const isNonPerfActive = userType === 'Non_Performing_Active_User';
        const applyEmpRules =
          userType === 'User' ||
          userType === 'Non_Performing_User' ||
          isNonPerfActive;
        // Non_Performing_Active only searches by empCode (laxminarayan always passes false)
        const otherSearch = isNonPerfActive
          ? false
          : hasOtherUserSearch(applied, clientName, playedIn);
        let empResolved: Extract<
          ReturnType<typeof resolveSearchEmpCode>,
          { ok: true }
        > = { ok: true };

        if (applyEmpRules) {
          const resolved = resolveSearchEmpCode(
            applied.empCode,
            loginEmpCode,
            otherSearch,
          );
          if (!resolved.ok) {
            toast.error(resolved.message);
            setRows([]);
            setTotal(0);
            return;
          }
          empResolved = resolved;
        }

        const filter = buildUserFilter(
          userType,
          applied,
          clientName,
          playedIn,
          uniqueUser,
          applyEmpRules ? empResolved : undefined,
        );

        const payload = buildPayloadForType(userType, {
          pageNo,
          itemsPerPage,
          filter,
          startDate,
          endDate,
          allottedApps: userType === 'User' ? undefined : allottedApps,
          appWithState:
            userType === 'User' || userType === 'Sub_Admin'
              ? undefined
              : adminAppWithState,
          selectedClientName: clientName || undefined,
          activeUserStart: applied.activeUserStart || undefined,
          activeUserEnd: applied.activeUserEnd || undefined,
        });

        const res = await secureApi(actionForType(userType), payload);
        if (!isCurrent(gen)) return;
        if (!res.ok) {
          toast.error(res.message || 'Failed to load users');
          return;
        }

        const parsed = unpackByType(userType, res.data);
        let list = parsed.rows;

        if (userType === 'User') {
          list = excludeDumped(list);
        }

        const trimmedEmp = String(applied.empCode || '').trim();
        if (applyEmpRules && loginEmpCode) {
          if (empResolved.allowOwnAndDefault || empResolved.matchDefault) {
            list = filterSearchByEmpCode(list, loginEmpCode, empResolved);
          } else if (empResolved.apiEmpCode) {
            list = filterListByLoginEmpCode(list, empResolved.apiEmpCode);
          } else {
            list = filterListByLoginEmpCode(list, loginEmpCode);
          }
        } else if (isNonPerfActive && !loginEmpCode && trimmedEmp) {
          // Admin without login empCode: API may ignore filter — match client-side
          list = list.filter((row) =>
            empCodesEqual(row.empCode, trimmedEmp),
          );
        }

        if (accessibleStates.length > 0) {
          list = list.filter((row: UserRow) =>
            accessibleStates.includes(String(row.state || '').toLowerCase()),
          );
        }

        // Match reference: dialer/bot source tracks the current loaded table.
        setRows(list);
        setDialerData(list);
        setTotal(Number(parsed.total) || list.length);
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      accessibleStates,
      adminAppWithState,
      allottedApps,
      applied,
      begin,
      clientName,
      end,
      endDate,
      isCurrent,
      itemsPerPage,
      loginEmpCode,
      next,
      page,
      playedIn,
      startDate,
      uniqueUser,
      userType,
    ],
  );

  useEffect(() => {
    // Non_Performing_Active_User has no server pagination — fetch once per filter set.
    void load(isClientPagedType ? 1 : page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isClientPagedType ? 0 : page,
    isClientPagedType ? 0 : itemsPerPage,
    userType,
    applied,
    clientName,
    playedIn,
    uniqueUser,
    startDate,
    endDate,
    appsKey,
  ]);

  const setDraftField = useCallback(
    (key: keyof UserFilters) => (value: string) =>
      setDraft((prev) => ({ ...prev, [key]: value })),
    [],
  );

  const search = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  /** Count only — do not replace dialer source (list load owns dialerData). */
  const loadGlobals = useCallback(async () => {
    const from = startDate && endDate ? startDate : todayIstYmd();
    const to = startDate && endDate ? endDate : todayIstYmd();
    const res = await secureApi('users.getGlobalsCount', {
      startDate: from,
      endDate: to,
    });
    if (!res.ok) return 0;
    let items = unpackGlobalsPayload(res.data);
    if (accessibleStates.length > 0) {
      items = items.filter((row) =>
        accessibleStates.includes(String(row.state || '').toLowerCase()),
      );
    }
    return items.length;
  }, [accessibleStates, endDate, startDate]);

  const handleApply = useCallback(() => {
    setApplied(draft);
    setPage(1);
  }, [draft]);

  return {
    typeOptions,
    userType,
    setUserType,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    page,
    setPage,
    itemsPerPage,
    setItemsPerPage,
    clientName,
    setClientName,
    playedIn,
    setPlayedIn,
    uniqueUser,
    setUniqueUser,
    draft,
    setDraft,
    applied,
    rows,
    setRows,
    dialerData,
    setDialerData,
    total,
    loading,
    totalPages,
    tableRows,
    isClientPagedType,
    load,
    loadGlobals,
    search,
    setDraftField,
    handleApply,
  };
}
