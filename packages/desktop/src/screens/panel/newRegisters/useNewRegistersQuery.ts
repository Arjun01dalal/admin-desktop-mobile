import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import type {
  ActiveStatusFilter,
  NewRegistrationFilter,
  NewRegistersAdmin,
  UserRow,
  UsersListResponse,
} from './types';

export type NewRegistersQueryFilters = {
  searchName: string;
  searchDpId: string;
  userComesFrom: string;
  searchBalance: string;
  appClientName: string;
  searchPlayInStatus: string;
  searchAccNo: string;
  searchAadharNo: string;
  searchEmail: string;
  searchCity: string;
  selectedState: string[];
  searchReferred: string;
  searchReferralCodeUser: string;
  searchMobile: string;
  showEmptyRecord: boolean;
  /** Match admin-panel-domains NewRegisterUsers toolbar filters. */
  activeStatus: ActiveStatusFilter;
  newRegistration: NewRegistrationFilter;
  otherState: boolean;
  nonPerforming: boolean;
};

export function useNewRegistersQuery(
  admin: NewRegistersAdmin | null | undefined,
  page: number,
  itemsPerPage: number,
  startDate: string,
  endDate: string,
  columnFilters: NewRegistersQueryFilters,
) {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const { next, isCurrent, begin, end } = useRequestGeneration();

  const buildFilter = useCallback(() => {
    const f = columnFilters;
    const filter: Record<string, unknown> = {
      name: f.searchName || undefined,
      _id: f.searchDpId || undefined,
      userComesFrom: f.userComesFrom || undefined,
      balance: f.searchBalance ? Number(f.searchBalance) || undefined : undefined,
      clientName: f.appClientName || undefined,
      played: f.searchPlayInStatus || undefined,
      accountNumber: f.searchAccNo || undefined,
      aadhaarNumber: f.searchAadharNo || undefined,
      email: f.searchEmail || undefined,
      city: f.searchCity || undefined,
      referredCode: f.searchReferred || undefined,
      referralCodeUser: f.searchReferralCodeUser || undefined,
      mobile: f.searchMobile || undefined,
    };

    // Match reference: Other State clears multi-select and sends state:"other"
    if (f.otherState) {
      filter.state = 'other';
    } else if (f.selectedState.length > 0) {
      filter.state = f.selectedState;
    }

    if (f.activeStatus === 'Active') filter.active = true;
    else if (f.activeStatus === 'InActive') filter.active = false;

    if (f.nonPerforming) filter.nonPerforming = true;

    // empCode filter intentionally omitted — same as reference (commented out).

    return Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined && v !== ''),
    );
  }, [columnFilters]);

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const payload: Record<string, unknown> = {
          itemsPerPage,
          pageNo,
          filter: buildFilter(),
          startDate,
          endDate,
          // Top-level flag — admin-panel-domains NewRegisterUsers
          newRegistration: columnFilters.newRegistration === 'True',
        };

        if (admin?.clientName || admin?.allotedApps) {
          payload.app = admin.clientName || admin.allotedApps;
        }

        const res = await secureApi<UsersListResponse>('users.getAll', payload);
        if (!isCurrent(gen)) return;

        if (!res.ok) {
          toast.error(res.message || 'Failed to load users');
          return;
        }

        const data = (res.data || {}) as UsersListResponse & {
          payload?: UsersListResponse;
        };
        const nested =
          data.payload &&
          typeof data.payload === 'object' &&
          !Array.isArray(data.payload)
            ? data.payload
            : data;
        let list: UserRow[] = Array.isArray(res.data)
          ? (res.data as UserRow[])
          : nested.items ||
            nested.users ||
            data.items ||
            data.users ||
            [];

        if (columnFilters.showEmptyRecord) {
          list = list.filter(
            (row) =>
              !row.activeUser &&
              !(row as { lastActivity?: unknown }).lastActivity,
          );
        }

        // accessibleStates client filter (reference parity)
        const states =
          admin?.accessibleStates?.map((s) => String(s).toLowerCase()) ?? [];
        if (states.length > 0) {
          list = list.filter((item) =>
            states.includes(String(item?.state || '').toLowerCase()),
          );
        }

        // Empty userComesFrom last
        list = [...list].sort((a, b) => {
          const aEmpty = !String(a.userComesFrom || '').trim();
          const bEmpty = !String(b.userComesFrom || '').trim();
          if (aEmpty === bEmpty) return 0;
          return aEmpty ? 1 : -1;
        });

        const apiTotal = Number(
          nested.total ?? nested.count ?? data.total ?? data.count ?? 0,
        );
        startTransition(() => {
          setRows(list);
          setTotal(apiTotal || list.length);
        });
      } finally {
        end();
        if (isCurrent(gen)) setLoading(false);
      }
    },
    [
      page,
      itemsPerPage,
      startDate,
      endDate,
      admin?.clientName,
      admin?.allotedApps,
      admin?.accessibleStates,
      buildFilter,
      columnFilters.showEmptyRecord,
      columnFilters.newRegistration,
      isCurrent,
      next,
      begin,
      end,
    ],
  );

  useEffect(() => {
    void load(page);
  }, [
    page,
    itemsPerPage,
    columnFilters.showEmptyRecord,
    columnFilters.activeStatus,
    columnFilters.newRegistration,
    columnFilters.otherState,
    columnFilters.nonPerforming,
  ]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, total, loading, load };
}
