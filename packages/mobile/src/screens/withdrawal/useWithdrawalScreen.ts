/** State, data loading, and actions for the withdrawal screen. */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { appCodeForName } from '@astro/shared';
import { secureApi } from '../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../auth/permissions';
import { colors } from '../../theme';
import { type DataTableColumn } from '../../dashboards/ui/DataTable';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../utils/dates';
import { shareCsvFile } from '../../utils/shareCsv';
import type { SheetDownloadFilter } from '../../utils/sheetDownloadAudit';
import { getCachedEmpCodeNameMap, getEmpCodeNameMap } from '../../utils/empCodeNameCache';
import { BOT_CHECK_HIDDEN_STATUSES, GATEWAY_OPTIONS } from './constants';
import {
  bothChecksOk,
  buildUpiQuery,
  canRejectRow,
  canShowApproveAction,
  checkOf,
  checksAllowedFor,
  display,
  extractBeneficiaryAccounts,
  fmtAmount,
  isTerminal,
  listOf,
  notify,
  num,
  unpack,
  pagesOf,
  parseSummary,
  requireGeo,
  statusColor,
  totalUsersOf,
  type Rec,
  type Summary,
} from './helpers';
import type { SheetAction } from '../dashboards/details/RowDetailSheet';

type Admin = {
  _id?: string;
  userId?: string;
  name?: string;
  clientName?: string;
  allotedApps?: string;
};

type Mid = { label: string; mid: string; gateway: string };
type StatusModal = { row: Rec; status: string };
type ApproveTarget = { row: Rec | null; bulk: boolean };

export function useWithdrawalScreen() {
  const admin = useMemo(() => getSessionUser() as Admin | null, []);
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [status, setStatus] = useState('');
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [searchField, setSearchField] = useState('userName');
  const [searchDraft, setSearchDraft] = useState('');
  const [applied, setApplied] = useState({ field: 'userName', text: '' });
  const [rows, setRows] = useState<Rec[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary>([]);
  const [msg, setMsg] = useState('');
  const [empCodeNameMap, setEmpCodeNameMap] = useState<Record<string, string>>(() =>
    getCachedEmpCodeNameMap(),
  );

  const [selected, setSelected] = useState<Rec | null>(null);
  const [midReportRow, setMidReportRow] = useState<Rec | null>(null);
  const [midReportOpen, setMidReportOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [statusModal, setStatusModal] = useState<StatusModal | null>(null);
  const [modalErr, setModalErr] = useState('');
  const [remark, setRemark] = useState('');
  const [gateway, setGateway] = useState('');
  const [mid, setMid] = useState('');
  const [gateways, setGateways] = useState<string[]>([]);
  const [mids, setMids] = useState<Mid[]>([]);
  const [validationRow, setValidationRow] = useState<Rec | null>(null);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkSel, setBulkSel] = useState<Record<string, Rec>>({});
  const [bulkManualOpen, setBulkManualOpen] = useState(false);
  const [qrRow, setQrRow] = useState<Rec | null>(null);
  const qrRef = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const [defaultGateway, setDefaultGateway] = useState('');
  const [approveTarget, setApproveTarget] = useState<ApproveTarget | null>(null);
  const [provider, setProvider] = useState('');
  const [sheetOtp, setSheetOtp] = useState<{ open: boolean; filter: SheetDownloadFilter }>({
    open: false,
    filter: { type: 'Withdrawal Sheet' },
  });
  const sheetAfterOtp = useRef<(() => void | Promise<boolean>) | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sortChecked, setSortChecked] = useState(false);
  const [bankAmtDraft, setBankAmtDraft] = useState('');
  const [bankAmt, setBankAmt] = useState('');
  const [midFilter, setMidFilter] = useState('');
  const [midFilterOpen, setMidFilterOpen] = useState(false);
  const [beneOpen, setBeneOpen] = useState(false);
  const [beneBanks, setBeneBanks] = useState<string[]>([]);
  const [beneInitial, setBeneInitial] = useState<string[]>([]);
  const [beneInput, setBeneInput] = useState('');
  const [beneBusy, setBeneBusy] = useState(false);
  const [addBeneRow, setAddBeneRow] = useState<Rec | null>(null);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [addBeneExisting, setAddBeneExisting] = useState<string[]>([]);
  const [addBeneSelected, setAddBeneSelected] = useState<string[]>([]);
  const [addBeneSearch, setAddBeneSearch] = useState('');
  const [addBeneBusy, setAddBeneBusy] = useState(false);
  const openMidReport = useCallback((row: Rec) => {
    setMidReportRow(row);
    setMidReportOpen(true);
  }, []);

  const perms = useMemo(
    () => ({
      actions: hasPermission(Permissions.withdrawals_button),
      checksDisabled: hasPermission(Permissions.Disable_Withdrawals_Check),
      reject: hasPermission(Permissions.View_Reject),
      reverse: hasPermission(Permissions.View_Reverse),
      showAll: hasPermission(Permissions.show_all_withdrawal),
      showMobile:
        hasPermission(Permissions.show_mobile) && !hasPermission('contact_visibility_none'),
      download: hasPermission(Permissions.Download_Withdrawal),
    }),
    [],
  );

  useEffect(() => {
    let active = true;
    void getEmpCodeNameMap().then((map) => {
      if (active) setEmpCodeNameMap(map);
    });
    return () => {
      active = false;
    };
  }, []);

  const formatEmpCode = useCallback(
    (r: Rec) => {
      const code = String(r.empCode || '').trim();
      const name = code ? empCodeNameMap[code] : '';
      return name ? `${code} (${name})` : display(r.empCode);
    },
    [empCodeNameMap],
  );

  const txnIdOf = useCallback((r: Rec) => String(r.transactionId ?? r.orderId ?? ''), []);

  const load = useCallback(async () => {
    setLoading(true);
    setMsg('');
    try {
      const filter: Rec = {};
      if (status) filter.status = status;
      if (status === 'IN PROGRESS' && !perms.showAll && admin?.name) filter.name = admin.name;
      if (applied.text.trim()) filter[applied.field] = applied.text.trim();
      if (sortChecked) filter.sort = true;
      if (bankAmt.trim()) filter.bankAmt = bankAmt.trim();
      if (midFilter) filter.mid = midFilter;
      const payload: Rec = {
        type: 'withdrawal',
        itemsPerPage: pageSize,
        pageNo: page,
        filter,
        startDate,
        endDate,
      };
      const app = admin?.clientName || admin?.allotedApps;
      if (app) payload.app = app;
      const res = await secureApi('withdrawals.transactions', payload);
      if (!res.ok) {
        setMsg(res.message || 'Failed to load refunds');
        setRows([]);
        setTotalPages(1);
        setTotalUsers(0);
        return;
      }
      setRows(listOf(res.data));
      setTotalPages(pagesOf(res.data));
      setTotalUsers(totalUsersOf(res.data));
    } finally {
      setLoading(false);
    }
  }, [
    admin,
    status,
    applied,
    pageSize,
    page,
    startDate,
    endDate,
    perms.showAll,
    sortChecked,
    bankAmt,
    midFilter,
  ]);

  const loadSummary = useCallback(async () => {
    const res = await secureApi('withdrawals.fundRequest', { startDate, endDate });
    if (res.ok) setSummary(parseSummary(res.data));
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);
  useFocusEffect(
    useCallback(() => {
      void load();
      void loadSummary();
    }, [load, loadSummary]),
  );

  useEffect(() => {
    void (async () => {
      const [midRes, gwRes] = await Promise.all([
        secureApi('withdrawals.mids', {}),
        secureApi('withdrawals.payoutAccounts', {}),
      ]);
      if (midRes.ok) {
        const list = listOf(midRes.data) as {
          mid?: string | number;
          name?: string;
          paymentGatewayName?: string;
        }[];
        setMids(
          list
            .filter((m) => m.mid !== undefined && m.mid !== null)
            .map((m) => ({
              label: `${m.paymentGatewayName || m.name || '—'} - ${m.mid}`,
              mid: String(m.mid),
              gateway: String(m.paymentGatewayName || m.name || ''),
            })),
        );
      }
      if (gwRes.ok) {
        const list = listOf(gwRes.data) as { name?: string }[];
        setGateways(
          Array.from(new Set(list.map((g) => g?.name).filter((n): n is string => Boolean(n)))),
        );
        if (list[0]?.name) setDefaultGateway(list[0].name);
      }
    })();
  }, []);

  const afterAction = useCallback(() => {
    setSelected(null);
    setStatusModal(null);
    setQrRow(null);
    setApproveTarget(null);
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  const doLock = useCallback(
    async (r: Rec, lock: boolean) => {
      setSelected(null);
      setActionBusy(true);
      try {
        let res;
        if (lock) {
          const geo = await requireGeo();
          if (!geo) {
            notify('Location Information Missing');
            return;
          }
          res = await secureApi('withdrawals.lock', {
            transactionId: txnIdOf(r),
            updatedBy: {
              name: admin?.name || '',
              userId: admin?.userId || admin?._id || '',
              status: 'true',
              date: new Date().toISOString(),
              ...geo,
            },
          });
        } else {
          res = await secureApi('withdrawals.unlock', { transactionId: txnIdOf(r) });
        }
        if (!res.ok) {
          notify(res.message || 'Action failed');
          return;
        }
        notify(lock ? 'Locked' : 'Unlocked');
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction, txnIdOf],
  );

  const doCheck = useCallback(
    async (r: Rec, check: 'first' | 'second', ok: boolean) => {
      setSelected(null);
      setActionBusy(true);
      try {
        const geo = await requireGeo();
        if (!geo) {
          notify('Location Information Missing');
          return;
        }
        const res = await secureApi('withdrawals.check', {
          transactionId: txnIdOf(r),
          check,
          updatedBy: {
            name: admin?.name || '',
            userId: admin?.userId || admin?._id || '',
            status: String(ok),
            ...geo,
          },
        });
        if (!res.ok) {
          notify(res.message || 'Check failed');
          return;
        }
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction, txnIdOf],
  );

  const doStatusUpdate = useCallback(
    async (
      r: Rec,
      newStatus: string,
      reasonText: string,
      gw: string,
      midSel: string,
      providerSel?: string,
    ) => {
      const needsRemark = newStatus !== 'Approved';
      const needsGateway = !['Approved', 'Reverse', 'Rejected', 'on hold'].includes(newStatus);
      if (needsRemark && !reasonText.trim()) {
        setModalErr('Remark is required');
        return;
      }
      if (needsGateway && (!gw || !midSel)) {
        setModalErr('Gateway and MID are required');
        return;
      }
      setModalErr('');
      setStatusModal(null);
      setSelected(null);
      setActionBusy(true);
      try {
        const geo = await requireGeo();
        if (!geo) {
          notify('Location Information Missing');
          return;
        }
        const payload: Rec = {
          transactionId: txnIdOf(r),
          reason: newStatus === 'Approved' ? reasonText.trim() || 'Approved' : reasonText.trim(),
          dp_id: r.dp_id,
          updatedBy: {
            name: admin?.name || '',
            _id: admin?._id || admin?.userId || '',
            status: newStatus,
            ...geo,
          },
        };
        if (needsGateway || newStatus === 'Approved') {
          const providerName = gw || providerSel || defaultGateway;
          if (providerName) payload.withdrewalProviderName = providerName;
        }
        if (needsGateway) {
          if (gw) payload.gatewayName = gw;
          if (midSel) payload.mid = midSel;
        }
        const res = await secureApi('withdrawals.statusUpdate', payload);
        if (!res.ok) {
          notify(res.message || 'Status update failed');
          return;
        }
        notify(`Status updated: ${newStatus}`);
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction, defaultGateway, txnIdOf],
  );

  const qrQuery = useMemo(() => (qrRow ? buildUpiQuery(qrRow) : ''), [qrRow]);
  const openUpiApp = useCallback(
    async (app: 'phonepe' | 'gpay') => {
      if (!qrQuery) return;
      const url = app === 'phonepe' ? `phonepe://pay?${qrQuery}` : `tez://upi/pay?${qrQuery}`;
      try {
        await Linking.openURL(url);
      } catch {
        notify(app === 'phonepe' ? 'PhonePe app not found' : 'GPay app not found');
      }
    },
    [qrQuery],
  );

  const downloadQr = useCallback(() => {
    const svg = qrRef.current;
    if (!svg) return;
    svg.toDataURL((base64) => {
      void (async () => {
        try {
          const uri = `${FileSystem.cacheDirectory}refund-qr-${Date.now()}.png`;
          await FileSystem.writeAsStringAsync(uri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save QR' });
          } else {
            notify('Sharing not available on this device');
          }
        } catch {
          notify('Could not save QR');
        }
      })();
    });
  }, []);

  const shareCsv = useCallback(async (fileName: string, headers: string[], data: string[][]) => {
    const esc = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...data].map((line) => line.map(esc).join(',')).join('\n');
    return shareCsvFile(`${fileName}-${Date.now()}.csv`, csv);
  }, []);
  const cell = (v: unknown) => (v === undefined || v === null ? '' : String(v));
  const downloadData = useCallback(
    () =>
      shareCsv(
        'Withdrawal_Data',
        [
          'Sr No',
          'Date',
          'accountHolderName',
          'Name (send to bank)',
          'bankName',
          'city',
          'state',
          'status',
          'dp_id',
          'transactionId',
          'Acc No',
          'Amount',
          'userBankName',
          'ifscCode',
        ],
        rows.map((r, i) => [
          String(i + 1),
          r.createdOn ? formatDisplayDate(String(r.createdOn)) : '',
          cell(r.accountHolderName),
          cell(r.beneficiaryAccount ?? r.accountHolderName),
          cell(r.bankName),
          cell(r.city),
          cell(r.state),
          cell(r.status),
          cell(r.dp_id),
          cell(r.transactionId),
          cell(r.accountNo),
          cell(r.amount),
          cell(r.userBankName),
          cell(r.ifscCode),
        ]),
      ),
    [rows, shareCsv],
  );
  const downloadPayok = useCallback(
    () =>
      shareCsv(
        'pay_ok_sheet',
        ['Bank Name (IFSC)', 'Bank Account', 'Amount(INR)', 'Phone Number', 'AccountName', 'Email'],
        rows.map((r) => [
          cell(r.ifscCode),
          cell(r.accountNo),
          cell(r.amount),
          cell(r.userMobile ?? r.mobile),
          cell(r.accountHolderName),
          cell(r.email),
        ]),
      ),
    [rows, shareCsv],
  );
  const downloadYesBank = useCallback(
    () =>
      shareCsv(
        'yes_bank_sheet',
        ['Sr No', 'Name', 'Transfer Type', 'Acc No', 'Amount', 'IFSC', 'Phone No', 'Remarks'],
        rows.map((r, i) => [
          String(i + 1),
          cell(r.accountHolderName),
          'NEFT',
          cell(r.accountNo),
          cell(r.amount),
          cell(r.ifscCode),
          cell(r.userMobile ?? r.mobile),
          cell(r.transactionId),
        ]),
      ),
    [rows, shareCsv],
  );

  const loadAvailableBanks = useCallback(async (): Promise<string[]> => {
    const res = await secureApi('withdrawals.availableBanks', {});
    const obj = res.ok ? unpack(res.data) : {};
    const banks = Array.isArray(obj.availableBanks)
      ? (obj.availableBanks as string[]).filter(Boolean)
      : [];
    setAvailableBanks(banks);
    return banks;
  }, []);
  const openBeneModal = useCallback(async () => {
    setBeneBusy(true);
    setBeneOpen(true);
    setBeneInput('');
    try {
      const banks = await loadAvailableBanks();
      setBeneBanks(banks);
      setBeneInitial(banks);
    } finally {
      setBeneBusy(false);
    }
  }, [loadAvailableBanks]);
  const openAddBene = useCallback(
    async (r: Rec) => {
      setSelected(null);
      setAddBeneSearch('');
      setAddBeneSelected([]);
      setAddBeneExisting(extractBeneficiaryAccounts(r));
      setAddBeneBusy(true);
      setTimeout(() => setAddBeneRow(r), 350);
      try {
        await loadAvailableBanks();
      } finally {
        setAddBeneBusy(false);
      }
    },
    [loadAvailableBanks],
  );
  const submitAddBene = useCallback(async () => {
    if (!addBeneRow) return;
    if (addBeneSelected.length === 0) {
      notify('Select at least one bank');
      return;
    }
    const userId = String(addBeneRow.dp_id ?? addBeneRow.userId ?? '');
    const transactionId = txnIdOf(addBeneRow);
    if (!userId || !transactionId) {
      notify('Missing user or transaction id');
      return;
    }
    setAddBeneBusy(true);
    try {
      const addRes = await secureApi('withdrawals.addBeneficiary', {
        userId,
        bankAccountName: addBeneSelected,
      });
      if (!addRes.ok) {
        notify(addRes.message || 'Failed to add beneficiary');
        return;
      }
      const syncRes = await secureApi('withdrawals.syncBeneficiary', { transactionId });
      if (!syncRes.ok) {
        notify(syncRes.message || 'Added but sync failed');
        return;
      }
      setAddBeneRow(null);
      notify('Beneficiary updated');
      afterAction();
    } finally {
      setAddBeneBusy(false);
    }
  }, [addBeneRow, addBeneSelected, afterAction, txnIdOf]);
  const saveBeneBanks = useCallback(async () => {
    const norm = (s: string) => s.trim().toLowerCase();
    setBeneBusy(true);
    try {
      if (beneInitial.length === 0) {
        const res = await secureApi('withdrawals.createAvailableBanks', {
          availableBanks: beneBanks,
        });
        if (!res.ok) {
          notify(res.message || 'Failed to create banks');
          return;
        }
      } else {
        const added = beneBanks.filter((b) => !beneInitial.some((i) => norm(i) === norm(b)));
        const removed = beneInitial.filter((b) => !beneBanks.some((c) => norm(c) === norm(b)));
        if (!added.length && !removed.length) {
          setBeneOpen(false);
          notify('No changes to save');
          return;
        }
        for (const [action, names] of [
          ['add', added],
          ['remove', removed],
        ] as const) {
          if (!names.length) continue;
          const res = await secureApi('withdrawals.updateAvailableBanks', { action, names });
          if (!res.ok) {
            notify(res.message || `Failed to ${action} banks`);
            return;
          }
        }
      }
      setBeneOpen(false);
      notify('Available banks updated successfully');
    } finally {
      setBeneBusy(false);
    }
  }, [beneBanks, beneInitial]);

  const bulkIds = useMemo(() => Object.keys(bulkSel), [bulkSel]);
  const clearBulk = useCallback(() => {
    setBulkSel({});
    setBulkMode(false);
  }, []);
  const doBulk = useCallback(
    async (kind: 'lock' | 'unlock' | 'approve', providerSel?: string) => {
      const rowsSel = Object.values(bulkSel);
      if (rowsSel.length === 0) {
        notify('No refunds selected');
        return;
      }
      setActionBusy(true);
      try {
        let res;
        if (kind === 'unlock') {
          res = await secureApi('withdrawals.bulkUnlock', {
            transactionId: rowsSel.map(txnIdOf),
          });
        } else {
          const geo = await requireGeo();
          if (!geo) {
            notify('Location Information Missing');
            return;
          }
          if (kind === 'lock') {
            res = await secureApi('withdrawals.bulkLock', {
              transactionId: rowsSel.map(txnIdOf),
              updatedBy: {
                name: admin?.name || '',
                userId: admin?._id || admin?.userId || '',
                status: 'true',
                date: new Date().toISOString(),
                ...geo,
              },
            });
          } else {
            res = await secureApi('withdrawals.bulkApprove', {
              transactionId: rowsSel.map((r) => ({
                transactionId: txnIdOf(r),
                updatedBy: { name: admin?.name || '', status: 'Approved', _id: admin?._id || '' },
              })),
              withdrewalProviderName: providerSel || gateway || defaultGateway,
              state: geo.state,
              city: geo.city,
              lat: geo.lat,
              long: geo.long,
            });
          }
        }
        if (!res.ok) {
          notify(res.message || 'Bulk action failed');
          return;
        }
        notify(
          kind === 'lock'
            ? 'Bulk Lock successfully'
            : kind === 'unlock'
              ? 'Bulk UnLock successfully'
              : 'Bulk Approved successfully',
        );
        clearBulk();
        afterAction();
      } finally {
        setActionBusy(false);
      }
    },
    [admin, afterAction, bulkSel, clearBulk, defaultGateway, gateway, txnIdOf],
  );
  const doBulkManual = useCallback(async () => {
    const rowsSel = Object.values(bulkSel);
    if (rowsSel.length === 0) {
      notify('No refunds selected');
      return;
    }
    if (!gateway || !mid) {
      setModalErr('Gateway and MID are required');
      return;
    }
    setModalErr('');
    setBulkManualOpen(false);
    setActionBusy(true);
    try {
      const geo = await requireGeo();
      if (!geo) {
        notify('Location Information Missing');
        return;
      }
      const res = await secureApi('withdrawals.bulkManualApprove', {
        state: geo.state,
        city: geo.city,
        lat: geo.lat,
        long: geo.long,
        gatewayName: gateway,
        mid,
        transactionId: rowsSel.map((r) => ({
          transactionId: txnIdOf(r),
          name: admin?.name || '',
          _id: admin?._id || '',
        })),
      });
      if (!res.ok) {
        notify(res.message || 'Bulk manual approve failed');
        return;
      }
      notify('Bulk Manual Approved successfully');
      clearBulk();
      afterAction();
    } finally {
      setActionBusy(false);
    }
  }, [admin, afterAction, bulkSel, clearBulk, gateway, mid, txnIdOf]);
  const confirmBulk = useCallback(
    (kind: 'lock' | 'unlock' | 'approve') => {
      const n = bulkIds.length;
      if (n === 0) {
        Alert.alert('No refunds selected', 'Bulk mode me cards pe tap karke select karo.');
        return;
      }
      if (kind === 'approve') {
        setProvider(defaultGateway);
        setModalErr('');
        setApproveTarget({ row: null, bulk: true });
        return;
      }
      const label = kind === 'lock' ? 'Lock' : 'Unlock';
      Alert.alert(`Bulk ${label}?`, `You are about to ${label.toLowerCase()} ${n} refund(s).`, [
        { text: 'Cancel', style: 'cancel' },
        { text: label, onPress: () => void doBulk(kind) },
      ]);
    },
    [bulkIds.length, defaultGateway, doBulk],
  );

  const confirmLock = useCallback(
    (r: Rec, lock: boolean) => {
      setSelected(null);
      setTimeout(
        () =>
          Alert.alert(
            lock ? 'Lock refund?' : 'Unlock refund?',
            `You are ${lock ? 'locking' : 'unlocking'} this refund of ₹${fmtAmount(r.amount)}.`,
            [
              { text: 'Cancel', style: 'cancel' },
              { text: lock ? 'Lock' : 'Unlock', onPress: () => void doLock(r, lock) },
            ],
          ),
        450,
      );
    },
    [doLock],
  );
  const openStatusModal = useCallback((r: Rec, statusName: string) => {
    setRemark('');
    setGateway('');
    setMid('');
    setModalErr('');
    setSelected(null);
    setTimeout(() => setStatusModal({ row: r, status: statusName }), 350);
  }, []);
  const openBotReport = useCallback((r: Rec) => {
    setSelected(null);
    setTimeout(() => setValidationRow(r), Platform.OS === 'ios' ? 350 : 80);
  }, []);

  const navigation = useNavigation<{ navigate: (name: string, params?: object) => void }>();
  const sheetActions = useCallback(
    (r: Rec): SheetAction[] => {
      const acts: SheetAction[] = [];
      if (r.dp_id) {
        acts.push({
          label: 'Show User Details',
          tone: 'default',
          onPress: () => {
            setSelected(null);
            navigation.navigate('/user-report', {
              userId: String(r.dp_id),
              userName: String(r.accountHolderName ?? r.userName ?? ''),
            });
          },
        });
      }
      if (perms.actions) {
        acts.push({ label: 'Add Bene', tone: 'primary', onPress: () => void openAddBene(r) });
      }
      if (r.validationCheckedAt && !BOT_CHECK_HIDDEN_STATUSES.has(String(r.status || ''))) {
        acts.push({
          label: `Bot Report (${num(r.passedPoints)}/${num(r.totalPoints)})`,
          tone: 'default',
          onPress: () => openBotReport(r),
        });
      }
      const checkFirst = checkOf(r, 'checkBy');
      const checkSecond = checkOf(r, 'crossCheckBy');
      const checksAllowed = checksAllowedFor(r, perms.checksDisabled);
      if (!checkFirst && checksAllowed) {
        acts.push(
          { label: 'Check ✓', tone: 'primary', onPress: () => void doCheck(r, 'first', true) },
          { label: 'Check ✗', tone: 'warning', onPress: () => void doCheck(r, 'first', false) },
        );
      }
      if (!checkSecond && checksAllowed && Boolean(checkFirst?.status)) {
        acts.push(
          {
            label: 'Cross Check ✓',
            tone: 'primary',
            onPress: () => void doCheck(r, 'second', true),
          },
          {
            label: 'Cross Check ✗',
            tone: 'warning',
            onPress: () => void doCheck(r, 'second', false),
          },
        );
      }
      if (!perms.actions) return acts;
      if (bothChecksOk(r)) {
        if (r.status === 'Lock' || r.status === 'IN PROGRESS') {
          acts.push({ label: 'Unlock', tone: 'warning', onPress: () => confirmLock(r, false) });
        } else if (!isTerminal(r)) {
          acts.push({ label: 'Lock', tone: 'primary', onPress: () => confirmLock(r, true) });
        }
      }
      if (canShowApproveAction(r)) {
        acts.push({
          label: 'Approve',
          tone: 'primary',
          onPress: () => {
            setProvider(defaultGateway);
            setModalErr('');
            setSelected(null);
            setTimeout(() => setApproveTarget({ row: r, bulk: false }), 350);
          },
        });
        acts.push({
          label: 'Manual Approved',
          tone: 'primary',
          onPress: () => openStatusModal(r, 'Manual Approved'),
        });
        acts.push({
          label: 'QR Code',
          tone: 'primary',
          onPress: () => {
            setGateway('');
            setMid('');
            setModalErr('');
            setSelected(null);
            setTimeout(() => setQrRow(r), 350);
          },
        });
        acts.push({
          label: 'On Hold',
          tone: 'warning',
          onPress: () => openStatusModal(r, 'on hold'),
        });
      }
      if (canRejectRow(r)) {
        if (perms.reject) {
          acts.push({
            label: 'Reject',
            tone: 'warning',
            onPress: () => openStatusModal(r, 'Rejected'),
          });
        }
        if (perms.reverse) {
          acts.push({
            label: 'Reverse',
            tone: 'warning',
            onPress: () => openStatusModal(r, 'Reverse'),
          });
        }
      }
      return acts;
    },
    [
      confirmLock,
      defaultGateway,
      doCheck,
      navigation,
      openAddBene,
      openBotReport,
      openStatusModal,
      perms,
    ],
  );

  const catalogMids = useMemo(
    () => mids.map((m) => String(m.mid ?? '').trim()).filter(Boolean),
    [mids],
  );
  const gatewayOptions = useMemo(() => {
    const known = new Set(GATEWAY_OPTIONS.map((g) => g.value.toLowerCase()));
    const excluded = ['zappay', 'wasabi'];
    return [
      ...GATEWAY_OPTIONS,
      ...gateways
        .filter(
          (g) => !known.has(g.toLowerCase()) && !excluded.some((x) => g.toLowerCase().includes(x)),
        )
        .map((g) => ({ value: g, label: g })),
    ];
  }, [gateways]);

  const columns = useMemo<DataTableColumn<Rec>[]>(
    () => [
      {
        key: 'name',
        label: 'User Name',
        width: 130,
        render: (r) => display(r.accountHolderName ?? r.userName ?? r.name),
      },
      { key: 'amount', label: 'Amount', width: 90, render: (r) => fmtAmount(r.amount ?? r.Amount) },
      { key: 'empCode', label: 'Emp Code', width: 90, render: formatEmpCode },
      {
        key: 'app',
        label: 'App',
        width: 80,
        render: (r) => display(appCodeForName(String(r.clientName || '')) || r.clientName),
      },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        color: (r) => statusColor(r.status),
        render: (r) => display(r.status),
      },
      {
        key: 'mobile',
        label: 'Mobile',
        width: 110,
        render: (r) => (perms.showMobile ? display(r.userMobile ?? r.mobile) : '••••••••'),
      },
      { key: 'state', label: 'State', width: 100, render: (r) => display(r.state) },
      { key: 'city', label: 'City', width: 100, render: (r) => display(r.city) },
      {
        key: 'bank',
        label: 'User Bank',
        width: 120,
        render: (r) => display(r.userBankName ?? r.bankName),
      },
      { key: 'winIn', label: 'Win In', width: 80, render: (r) => display(r.playedGames) },
      {
        key: 'txn',
        label: 'Transaction Id',
        width: 150,
        render: (r) => display(r.orderId ?? r.transactionId),
      },
      { key: 'dp', label: 'DP Id', width: 120, render: (r) => display(r.dp_id) },
      { key: 'accountNo', label: 'Account No', width: 130, render: (r) => display(r.accountNo) },
      { key: 'ifsc', label: 'IFSC', width: 110, render: (r) => display(r.ifscCode ?? r.ifsc) },
      {
        key: 'commission',
        label: 'Commission',
        width: 90,
        render: (r) => fmtAmount(r.commissionAmount),
      },
      {
        key: 'provider',
        label: 'Provider',
        width: 120,
        render: (r) =>
          String(r.status || '').toLowerCase() === 'approved'
            ? display(r.withdrewalProviderName ?? r.paymentGatewayName)
            : '—',
      },
      {
        key: 'mid',
        label: 'MID',
        width: 100,
        render: (r) => (String(r.status || '').toLowerCase() === 'approved' ? display(r.mid) : '—'),
      },
      {
        key: 'checkBot',
        label: 'Check By Bot',
        width: 100,
        render: (r) =>
          r.validationCheckedAt ? `${num(r.passedPoints)}/${num(r.totalPoints)}` : '—',
        color: (r) =>
          r.validationCheckedAt
            ? Number(r.passedPoints) >= 13
              ? colors.success
              : colors.destructive
            : undefined,
      },
      {
        key: 'lockBy',
        label: 'Lock By',
        width: 110,
        render: (r) => {
          const l = r.lockBy as Rec | undefined;
          return l && typeof l === 'object' ? display(l.name) : display(l);
        },
      },
      {
        key: 'checkBy',
        label: 'Check By',
        width: 120,
        render: (r) => {
          const c = checkOf(r, 'checkBy');
          return c
            ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}`
            : '—';
        },
      },
      {
        key: 'crossCheckBy',
        label: 'Cross Check By',
        width: 130,
        render: (r) => {
          const c = checkOf(r, 'crossCheckBy');
          return c
            ? `${c.status === 'true' || c.status === true ? 'OK' : 'Not OK'} · ${display(c.name)}`
            : '—';
        },
      },
      {
        key: 'updatedBy',
        label: 'Updated By',
        width: 130,
        render: (r) => {
          const a = r.action as Rec | undefined;
          return a && typeof a === 'object'
            ? `${display(a.status)} · ${display(a.name)}`
            : display(a);
        },
      },
      { key: 'pnlBefore', label: 'PnL Before', width: 100, render: (r) => display(r.pnl) },
      {
        key: 'pnlAfter',
        label: 'PnL After',
        width: 100,
        render: (r) => display(r.afterWithdrawalPnl),
      },
      {
        key: 'date',
        label: 'Date',
        width: 100,
        render: (r) => (r.createdOn ? formatDisplayDate(String(r.createdOn)) : '—'),
      },
      {
        key: 'time',
        label: 'Time',
        width: 90,
        render: (r) => (r.createdOn ? formatDisplayTime(String(r.createdOn)) : '—'),
      },
    ],
    [formatEmpCode, perms.showMobile],
  );

  const requestSheetDownload = useCallback(
    (filter: SheetDownloadFilter, run: () => void | Promise<boolean>) => {
      sheetAfterOtp.current = run;
      setSheetOtp({ open: true, filter });
    },
    [],
  );
  const setStatusFilter = useCallback((value: string) => {
    setStatus(value);
    setPage(1);
  }, []);
  const refresh = useCallback(() => {
    void load();
    void loadSummary();
  }, [load, loadSummary]);

  return {
    admin,
    rows,
    summary,
    loading,
    msg,
    perms,
    columns,
    selected,
    setSelected,
    sheetActions,
    midReportRow,
    midReportOpen,
    openMidReport,
    setMidReportRow,
    setMidReportOpen,
    catalogMids,
    validationRow,
    setValidationRow,
    bulkManualOpen,
    setBulkManualOpen,
    actionBusy,
    bulkIds,
    gateways,
    gateway,
    setGateway,
    mids,
    mid,
    setMid,
    modalErr,
    setModalErr,
    doBulkManual,
    addBeneRow,
    addBeneBusy,
    setAddBeneRow,
    addBeneSelected,
    setAddBeneSelected,
    addBeneSearch,
    setAddBeneSearch,
    availableBanks,
    addBeneExisting,
    submitAddBene,
    beneOpen,
    setBeneOpen,
    beneBusy,
    beneInput,
    setBeneInput,
    beneBanks,
    setBeneBanks,
    saveBeneBanks,
    approveTarget,
    setApproveTarget,
    provider,
    setProvider,
    doBulk,
    doStatusUpdate,
    qrRow,
    setQrRow,
    qrQuery,
    qrRef,
    openUpiApp,
    downloadQr,
    gatewayOptions,
    statusModal,
    setStatusModal,
    remark,
    setRemark,
    toolsOpen,
    setToolsOpen,
    sortChecked,
    setSortChecked,
    bankAmtDraft,
    setBankAmtDraft,
    bankAmt,
    setBankAmt,
    midFilter,
    setMidFilter,
    midFilterOpen,
    setMidFilterOpen,
    openBeneModal,
    downloadData,
    downloadPayok,
    downloadYesBank,
    draftStart,
    draftEnd,
    setDraftStart,
    setDraftEnd,
    setStartDate,
    setEndDate,
    setPage,
    pageSize,
    setPageSize,
    searchField,
    setSearchField,
    searchDraft,
    setSearchDraft,
    setApplied,
    status,
    setStatus: setStatusFilter,
    requestSheetDownload,
    bulkMode,
    bulkSel,
    setBulkSel,
    clearBulk,
    setBulkMode,
    confirmBulk,
    openBotReport,
    openAddBene,
    doCheck,
    txnIdOf,
    totalPages,
    totalUsers,
    page,
    sheetOtp,
    setSheetOtp,
    sheetAfterOtp,
    refresh,
  };
}
