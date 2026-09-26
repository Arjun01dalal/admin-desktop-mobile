/**
 * Withdrawal action workflows: lookups, lock/check/status/bulk/QR/Add Bene/BeneList.
 * Shared by WithdrawalScreen (via useWithdrawalScreen) and ActiveUserWithdrawalScreen.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {
  buildBenePendingOptions,
  normalizeBeneAccountCountSummary,
  type BenePendingOption,
} from '@astro/shared/beneficiaryAccountCounts';
import { secureApi } from '../../api/client';
import { getSessionUser, hasPermission, Permissions } from '../../auth/permissions';
import { BOT_CHECK_HIDDEN_STATUSES, GATEWAY_OPTIONS } from './constants';
import {
  bothChecksOk,
  buildUpiQuery,
  canRejectRow,
  canShowApproveAction,
  checkOf,
  checksAllowedFor,
  extractBeneficiaryAccounts,
  fmtAmount,
  isTerminal,
  listOf,
  notify,
  num,
  unpack,
  requireGeo,
  type Rec,
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

export type UseWithdrawalActionsOptions = {
  onRefresh: () => void;
};

export function useWithdrawalActions({ onRefresh }: UseWithdrawalActionsOptions) {
  const admin = useMemo(() => getSessionUser() as Admin | null, []);

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
  const [beneOpen, setBeneOpen] = useState(false);
  const [beneBanks, setBeneBanks] = useState<string[]>([]);
  const [beneInitial, setBeneInitial] = useState<string[]>([]);
  const [beneInput, setBeneInput] = useState('');
  const [beneBusy, setBeneBusy] = useState(false);
  const [addBeneRow, setAddBeneRow] = useState<Rec | null>(null);
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [beneAccOptions, setBeneAccOptions] = useState<BenePendingOption[]>([]);
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

  const txnIdOf = useCallback((r: Rec) => String(r.transactionId ?? r.orderId ?? ''), []);

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
    onRefresh();
  }, [onRefresh]);

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

  const loadAvailableBanks = useCallback(async (): Promise<string[]> => {
    const [bankRes, countRes] = await Promise.all([
      secureApi('withdrawals.availableBanks', {}),
      secureApi('withdrawals.beneficiaryAccountsUserCount', {}),
    ]);
    const obj = bankRes.ok ? unpack(bankRes.data) : {};
    const banks = Array.isArray(obj.availableBanks)
      ? (obj.availableBanks as string[]).filter(Boolean)
      : [];
    setAvailableBanks(banks);
    const countItems = countRes.ok
      ? normalizeBeneAccountCountSummary(countRes.data).items
      : [];
    setBeneAccOptions(buildBenePendingOptions(banks, countItems));
    return banks;
  }, []);

  useEffect(() => {
    void loadAvailableBanks();
  }, [loadAvailableBanks]);

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
      void loadAvailableBanks();
    } finally {
      setBeneBusy(false);
    }
  }, [beneBanks, beneInitial, loadAvailableBanks]);

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

  return {
    admin,
    perms,
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
    beneAccOptions,
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
    openBeneModal,
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
  };
}
