import { startTransition, useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { secureApi } from '@/api/secureClient';
import { useRequestGeneration } from '@/hooks/useRequestGeneration';
import type { NewRegistersAdmin, UserRow, UsersListResponse } from './types';

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
};

/** Normalize numeric emp codes so "21" and "021" match. */
function normalizeEmpCode(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!s) return '';
  if (/^\d+$/.test(s)) return s.padStart(3, '0');
  return s;
}

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
    const empCode = normalizeEmpCode(admin?.empCode);
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
      // Login has empCode → only own records (same as laxminarayan)
      empCode: empCode || undefined,
    };

    if (f.selectedState.length > 0) {
      filter.state = f.selectedState;
    }

    return Object.fromEntries(
      Object.entries(filter).filter(([, v]) => v !== undefined && v !== ''),
    );
  }, [columnFilters, admin?.empCode]);

  const load = useCallback(
    async (pageNo = page) => {
      const gen = next();
      begin();
      setLoading(true);
      try {
        const empCode = normalizeEmpCode(admin?.empCode);
        const payload: Record<string, unknown> = {
          itemsPerPage,
          pageNo,
          filter: buildFilter(),
          startDate,
          endDate,
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
        // Prefer `items` (same as laxminarayan fetchUserGetAll) over `users`
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
        // Client-side guard if API returns all even when empCode is sent
        if (empCode) {
          list = list.filter(
            (row) => normalizeEmpCode(row.empCode) === empCode,
          );
        }
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
      admin?.empCode,
      buildFilter,
      columnFilters.showEmptyRecord,
      isCurrent,
      next,
      begin,
      end,
    ],
  );

  useEffect(() => {
    void load(page);
  }, [page, itemsPerPage, columnFilters.showEmptyRecord]); // eslint-disable-line react-hooks/exhaustive-deps

  return { rows, total, loading, load };
}
