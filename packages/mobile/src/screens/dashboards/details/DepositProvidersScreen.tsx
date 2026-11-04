/**
 * Deposit Providers — mobile port of desktop DepositProvidersPage.
 * depositProviders.list { startDate, endDate }. Row tap opens a popup with all
 * fields, provider image and every action: toggle, delete, edit fields, add to
 * MID/UPI/WhatsApp/City/State lists, set order, update amounts and bonus.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CLIENT_NAMES,
  DEPOSIT_PROVIDER_EXTRA_STATES,
  INDIA_STATES,
  buildCityNotAllowedPayload,
  buildStateNotAllowedPayload,
  buildWhatsappRedirectionLink,
  normalizeStringList,
  parseRedirectionMobile,
  splitListInput,
} from '@astro/shared';
import { colors, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './DepositProvidersScreen.styles';
import { display } from '../../../utils/display';

const STATE_OPTIONS = [...INDIA_STATES, ...DEPOSIT_PROVIDER_EXTRA_STATES];

function formatList(value: unknown): string {
  const list = normalizeStringList(value);
  return list.length ? list.join(', ') : '—';
}

type Row = {
  _id?: string;
  name?: string;
  displayName?: string;
  displayImage?: string;
  gatewayImage?: string;
  mid?: string;
  midArray?: string[];
  link?: string;
  upiArray?: string[];
  redirectionLink?: string;
  whatsAppNumbers?: string[];
  stateNotAllowed?: string[];
  cityNotAllowed?: string[];
  stateUpdatedBy?: { userName?: string };
  PaymentType?: string;
  paymentType?: string;
  status?: boolean;
  order?: number | string;
  orderUpdatedBy?: { userName?: string; remark?: string };
  updatedBy?: { userName?: string };
  updatedOn?: string;
  clientName?: string[];
  bonus?: { percentage?: number; text?: string; tiers?: unknown[] };
  bonusStatus?: boolean;
  amtUpdatedBy?: { userName?: string };
  [key: string]: unknown;
};

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  for (const key of ['payload', 'items', 'data']) {
    const v = obj[key];
    if (Array.isArray(v)) return v as T[];
    if (v && typeof v === 'object') {
      const inner = (v as Record<string, unknown>).items;
      if (Array.isArray(inner)) return inner as T[];
    }
  }
  return [];
}

// Single-value edit fields via depositProviders.updateMidNameLink.
const EDIT_FIELDS = [
  { key: 'displayName', label: 'Display name' },
  { key: 'name', label: 'Name' },
  { key: 'mid', label: 'MID' },
  { key: 'link', label: 'Link' },
  { key: 'gatewayImage', label: 'Gateway image URL' },
] as const;

// List-add targets.
const LIST_FIELDS = [
  { key: 'mid', label: 'MID list' },
  { key: 'upi', label: 'UPI list' },
  { key: 'whatsapp', label: 'WhatsApp numbers' },
  { key: 'city', label: 'Blocked cities' },
  { key: 'state', label: 'Blocked states' },
] as const;

type ListKey = (typeof LIST_FIELDS)[number]['key'];

function listValuesForKey(row: Row | null, key: ListKey): string[] {
  if (!row) return [];
  if (key === 'mid') return normalizeStringList(row.midArray?.length ? row.midArray : row.mid);
  if (key === 'upi') return normalizeStringList(row.upiArray?.length ? row.upiArray : row.link);
  if (key === 'whatsapp') return normalizeStringList(row.whatsAppNumbers);
  if (key === 'city') return normalizeStringList(row.cityNotAllowed);
  return normalizeStringList(row.stateNotAllowed);
}

export function DepositProvidersScreen() {
  const insets = useSafeAreaInsets();
  const modalBottomPad = Math.max(insets.bottom, spacing(3)) + spacing(4);
  const canAdd = hasPermission('Add_PayIn_Account');
  const canAddMid = hasPermission('show_add_provider_btn');
  const canToggle = hasPermission('Toggle_PayIn_Account');
  const canDelete = hasPermission('Delete_PayIn_Account');
  const canEdit = !hasPermission('Disable_Deposit_Provider_Edit');
  const canUpdateAmount = hasPermission('Update_Deposit_Amount_Edit');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const updatedBy = useMemo(() => ({ userId: admin?._id, userName: admin?.name }), [admin]);

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  // Laxmi: first getAllDash uses {}; dates only after Apply (faster).
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [searchText, setSearchText] = useState('');
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const genRef = useRef(0);

  // Generic single-input modal state.
  type InputModal = {
    title: string;
    placeholder: string;
    initial?: string;
    keyboardNumeric?: boolean;
    secondPlaceholder?: string;
    onSubmit: (value: string, second: string) => Promise<string | null>;
  };
  const [inputModal, setInputModal] = useState<InputModal | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [inputSecond, setInputSecond] = useState('');
  const [inputSaving, setInputSaving] = useState(false);
  const [inputMsg, setInputMsg] = useState('');

  // Field-chooser modals (edit field / add to list) keep the active row + selected key.
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editKey, setEditKey] = useState<(typeof EDIT_FIELDS)[number]['key']>('displayName');
  const [listRow, setListRow] = useState<Row | null>(null);
  const [listKey, setListKey] = useState<ListKey>('mid');
  const [stateDraft, setStateDraft] = useState<string[]>([]);

  // Amount modal.
  const [amountRow, setAmountRow] = useState<Row | null>(null);
  const [minAmt, setMinAmt] = useState('');
  const [maxAmt, setMaxAmt] = useState('');
  const [amountApp, setAmountApp] = useState('All');

  // Bonus modal.
  const [bonusRow, setBonusRow] = useState<Row | null>(null);
  const [bonusPercent, setBonusPercent] = useState('');
  const [bonusText, setBonusText] = useState('');
  const [bonusStatus, setBonusStatus] = useState(false);

  // Add provider modal.
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({
    name: '',
    link: '',
    PaymentType: '',
    mid: '',
    displayName: '',
    displayImage: '',
    redirectionLink: '',
    gatewayType: '',
  });

  const [busy, setBusy] = useState(false);
  const [modalMsg, setModalMsg] = useState('');

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      const res = await secureApi<unknown>('depositProviders.list', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load deposit providers');
        setRows([]);
        return;
      }
      const list = asList<Row>(res.data);
      list.sort((a, b) => Number(Boolean(b.status)) - Number(Boolean(a.status)));
      setSheetRow(null);
      setRows(list);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    void load();
  }, [load]);

  // Keep manage-list modal in sync after reload without closing it.
  useEffect(() => {
    if (!listRow?._id) return;
    const fresh = rows.find((r) => r._id === listRow._id);
    if (!fresh) return;
    setListRow(fresh);
    if (listKey === 'state') {
      setStateDraft(normalizeStringList(fresh.stateNotAllowed));
    }
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps -- sync from reload only

  const run = useCallback(
    async (action: string, payload: Record<string, unknown>): Promise<string | null> => {
      const res = await secureApi<unknown>(action, payload);
      if (!res.ok) return res.message || 'Request failed';
      void load();
      return null;
    },
    [load],
  );

  const filtered = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.name, r.displayName, r.mid, r.link, r.redirectionLink]
        .map((v) => String(v || '').toLowerCase())
        .some((v) => v.includes(q)),
    );
  }, [rows, searchText]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'name', label: 'Gateway', width: 130, render: (r) => display(r.name) },
      {
        key: 'displayName',
        label: 'Display Name',
        width: 130,
        render: (r) => display(r.displayName),
      },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => (r.status ? 'Active' : 'Inactive'),
        badge: (r) => (r.status ? '#16a34a' : '#dc2626'),
      },
      { key: 'mid', label: 'MID', width: 140, render: (r) => display(r.mid) },
      { key: 'midArray', label: 'MID List', width: 180, render: (r) => formatList(r.midArray) },
      { key: 'link', label: 'Link', width: 180, render: (r) => display(r.link) },
      { key: 'upiArray', label: 'UPI List', width: 180, render: (r) => formatList(r.upiArray) },
      {
        key: 'whatsAppNumbers',
        label: 'WhatsApp Numbers',
        width: 180,
        render: (r) => formatList(r.whatsAppNumbers),
      },
      {
        key: 'redirectionLink',
        label: 'Redirection Link',
        width: 180,
        render: (r) => display(r.redirectionLink),
      },
      {
        key: 'states',
        label: 'Blocked States',
        width: 180,
        render: (r) => formatList(r.stateNotAllowed),
      },
      {
        key: 'cities',
        label: 'Blocked Cities',
        width: 180,
        render: (r) => formatList(r.cityNotAllowed),
      },
      {
        key: 'stateUpdatedBy',
        label: 'State Updated By',
        width: 130,
        render: (r) => display(r.stateUpdatedBy?.userName),
      },
      {
        key: 'paymentType',
        label: 'Payment Type',
        width: 120,
        render: (r) => display(r.PaymentType || r.paymentType),
      },
      {
        key: 'enableBy',
        label: 'Enabled By',
        width: 160,
        render: (r) =>
          `${display(r.updatedBy?.userName)}${
            r.updatedOn
              ? ` · ${formatDisplayDate(r.updatedOn)} ${formatDisplayTime(r.updatedOn)}`
              : ''
          }`,
      },
      { key: 'order', label: 'Order', width: 70, align: 'center', render: (r) => display(r.order) },
      {
        key: 'orderUpdatedBy',
        label: 'Order Updated By',
        width: 160,
        render: (r) =>
          r.orderUpdatedBy
            ? `${display(r.orderUpdatedBy.userName)}${
                r.orderUpdatedBy.remark ? ` (${r.orderUpdatedBy.remark})` : ''
              }`
            : '—',
      },
      { key: 'apps', label: 'Apps', width: 160, render: (r) => display(r.clientName) },
      {
        key: 'bonus',
        label: 'Bonus',
        width: 160,
        render: (r) =>
          r.bonus
            ? `${r.bonus.percentage ?? 0}%${r.bonus.text ? ` · ${r.bonus.text}` : ''} · ${
                r.bonusStatus ? 'On' : 'Off'
              }`
            : '—',
      },
      {
        key: 'amtUpdatedBy',
        label: 'Amount Updated By',
        width: 140,
        render: (r) => display(r.amtUpdatedBy?.userName),
      },
    ],
    [],
  );

  const openInput = useCallback((modal: InputModal) => {
    setInputModal(modal);
    setInputValue(modal.initial || '');
    setInputSecond('');
    setInputMsg('');
  }, []);

  const submitInput = useCallback(async () => {
    if (!inputModal) return;
    const value = inputValue.trim();
    if (!value) {
      setInputMsg('Value is required');
      return;
    }
    setInputSaving(true);
    setInputMsg('');
    try {
      const err = await inputModal.onSubmit(value, inputSecond.trim());
      if (err) {
        setInputMsg(err);
        return;
      }
      setInputModal(null);
    } finally {
      setInputSaving(false);
    }
  }, [inputModal, inputValue, inputSecond]);

  const sheetActions: SheetAction[] = [];
  if (sheetRow) {
    if (canToggle) {
      sheetActions.push({
        label: sheetRow.status ? 'Disable' : 'Enable',
        tone: sheetRow.status ? 'warning' : 'primary',
        onPress: () => {
          const next = !sheetRow.status;
          Alert.alert(
            next ? 'Enable provider' : 'Disable provider',
            `${next ? 'Enable' : 'Disable'} ${sheetRow.name || 'this provider'}?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: next ? 'Enable' : 'Disable',
                style: next ? 'default' : 'destructive',
                onPress: () => {
                  void (async () => {
                    const err = await run('depositProviders.update', {
                      _id: sheetRow._id,
                      status: next,
                      name: sheetRow.name,
                      updatedBy,
                    });
                    if (err) setError(err);
                    setSheetRow(null);
                  })();
                },
              },
            ],
          );
        },
      });
    }
    if (canEdit) {
      sheetActions.push({
        label: 'Edit field',
        onPress: () => {
          setEditRow(sheetRow);
          setEditKey('displayName');
          setInputValue(String(sheetRow.displayName ?? ''));
          setModalMsg('');
          setSheetRow(null);
        },
      });
      sheetActions.push({
        label: 'Manage list',
        onPress: () => {
          setListRow(sheetRow);
          setListKey('mid');
          setStateDraft(normalizeStringList(sheetRow.stateNotAllowed));
          setInputValue('');
          setModalMsg('');
          setSheetRow(null);
        },
      });
    }
    sheetActions.push({
      label: 'Set order',
      onPress: () => {
        const row = sheetRow;
        setSheetRow(null);
        openInput({
          title: `Set order — ${row.name || ''}`,
          placeholder: 'Order number…',
          initial: row.order !== undefined && row.order !== null ? String(row.order) : '',
          keyboardNumeric: true,
          secondPlaceholder: 'Remark…',
          onSubmit: async (value, second) => {
            const order = Number(value);
            if (!Number.isFinite(order)) return 'Enter a valid order number';
            return run('depositProviders.updateOrder', {
              _id: row._id,
              order,
              orderUpdatedBy: { ...updatedBy, remark: second },
            });
          },
        });
      },
    });
    if (canUpdateAmount) {
      sheetActions.push({
        label: 'Update amount',
        onPress: () => {
          setAmountRow(sheetRow);
          setMinAmt('');
          setMaxAmt('');
          setAmountApp('All');
          setModalMsg('');
          setSheetRow(null);
        },
      });
    }
    sheetActions.push({
      label: 'Update bonus',
      onPress: () => {
        setBonusRow(sheetRow);
        setBonusPercent(String(sheetRow.bonus?.percentage ?? ''));
        setBonusText(String(sheetRow.bonus?.text ?? ''));
        setBonusStatus(Boolean(sheetRow.bonusStatus));
        setModalMsg('');
        setSheetRow(null);
      },
    });
    if (canDelete) {
      sheetActions.push({
        label: 'Delete',
        tone: 'warning',
        onPress: () => {
          Alert.alert('Delete provider', `Delete ${sheetRow.name || 'this provider'}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  const err = await run('depositProviders.delete', { _id: sheetRow._id });
                  if (err) setError(err);
                  setSheetRow(null);
                })();
              },
            },
          ]);
        },
      });
    }
  }

  const submitEditField = useCallback(async () => {
    if (!editRow) return;
    const value = inputValue.trim();
    if (!value) {
      setModalMsg('Value is required');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      const err = await run('depositProviders.updateMidNameLink', {
        _id: editRow._id,
        [editKey]: value,
      });
      if (err) {
        setModalMsg(err);
        return;
      }
      setEditRow(null);
      setInputValue('');
    } finally {
      setBusy(false);
    }
  }, [editRow, editKey, inputValue, run]);

  const patchListRow = useCallback((patch: Partial<Row>) => {
    setListRow((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const submitListAdd = useCallback(async () => {
    if (!listRow?._id) return;

    // Blocked states: multi-select + Submit (admin Deposit_Withdraw_Providers parity).
    if (listKey === 'state') {
      const states = normalizeStringList(stateDraft);
      setBusy(true);
      setModalMsg('');
      try {
        const err = await run('depositProviders.updateBonusAndClients', {
          _id: listRow._id,
          stateNotAllowed: buildStateNotAllowedPayload(states, 'add'),
          updatedBy,
        });
        if (err) {
          setModalMsg(err);
          return;
        }
        patchListRow({ stateNotAllowed: states });
        setModalMsg('States updated');
      } finally {
        setBusy(false);
      }
      return;
    }

    if (listKey === 'mid' && !canAddMid) {
      setModalMsg('No permission to add MID');
      return;
    }

    const value = inputValue.trim();
    if (!value) {
      setModalMsg('Value is required');
      return;
    }
    const additions = listKey === 'city' ? splitListInput(value) : [value];
    if (!additions.length) {
      setModalMsg('Value is required');
      return;
    }
    const existing = listValuesForKey(listRow, listKey);
    const dup = additions.find((v) => existing.some((x) => x.toLowerCase() === v.toLowerCase()));
    if (dup) {
      setModalMsg(`"${dup}" already exists`);
      return;
    }

    setBusy(true);
    setModalMsg('');
    try {
      let err: string | null;
      if (listKey === 'mid') {
        err = await run('depositProviders.updateMidArray', {
          _id: listRow._id,
          midArray: additions,
        });
        if (!err) {
          // Best-effort activate (admin CitySelector updateRecoredInDB).
          void secureApi('depositProviders.updateMidNameLink', {
            _id: listRow._id,
            mid: additions[0],
          });
          patchListRow({
            midArray: normalizeStringList([...(listRow.midArray || []), ...additions]),
            mid: additions[0],
          });
        }
      } else if (listKey === 'upi') {
        err = await run('depositProviders.updateUpiArray', {
          _id: listRow._id,
          upiArray: additions,
        });
        if (!err) {
          void secureApi('depositProviders.updateMidNameLink', {
            _id: listRow._id,
            link: additions[0],
          });
          patchListRow({
            upiArray: normalizeStringList([...(listRow.upiArray || []), ...additions]),
            link: additions[0],
          });
        }
      } else if (listKey === 'whatsapp') {
        err = await run('depositProviders.updateWhatsappNumbers', {
          _id: listRow._id,
          whatsAppNumbers: additions,
        });
        if (!err) {
          const redirectionLink = buildWhatsappRedirectionLink(additions[0]);
          void secureApi('depositProviders.updateMidNameLink', {
            _id: listRow._id,
            redirectionLink,
          });
          patchListRow({
            whatsAppNumbers: normalizeStringList([
              ...(listRow.whatsAppNumbers || []),
              ...additions,
            ]),
            redirectionLink,
          });
        }
      } else {
        err = await run('depositProviders.updateBonusAndClients', {
          _id: listRow._id,
          cityNotAllowed: buildCityNotAllowedPayload(additions, 'add'),
          updatedBy,
        });
        if (!err) {
          patchListRow({
            cityNotAllowed: normalizeStringList([
              ...(listRow.cityNotAllowed || []),
              ...additions,
            ]),
          });
        }
      }
      if (err) {
        setModalMsg(err);
        return;
      }
      setInputValue('');
      setModalMsg('Added');
    } finally {
      setBusy(false);
    }
  }, [listRow, listKey, inputValue, stateDraft, run, updatedBy, patchListRow, canAddMid]);

  const submitListRemoveMid = useCallback(
    async (mid: string) => {
      if (!listRow?._id || !mid.trim()) return;
      setBusy(true);
      setModalMsg('');
      try {
        const err = await run('depositProviders.removeMidArray', {
          _id: listRow._id,
          midArray: [mid.trim()],
          updatedBy,
        });
        if (err) {
          setModalMsg(err);
          return;
        }
        // Keep modal open but refresh the visible row from latest list after reload.
        setListRow((prev) => {
          if (!prev) return prev;
          const next = (prev.midArray || []).filter((m) => String(m) !== mid.trim());
          return { ...prev, midArray: next };
        });
        void load();
      } finally {
        setBusy(false);
      }
    },
    [listRow, run, updatedBy, load],
  );

  const submitAmount = useCallback(async () => {
    if (!amountRow) return;
    const min = Number(minAmt);
    const max = Number(maxAmt);
    if (!minAmt.trim() || !maxAmt.trim() || !Number.isFinite(min) || !Number.isFinite(max)) {
      setModalMsg('Enter valid min and max amounts');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      const apps =
        amountApp === 'All'
          ? amountRow.clientName && amountRow.clientName.length
            ? amountRow.clientName
            : [...CLIENT_NAMES]
          : [amountApp];
      for (const appName of apps) {
        const res = await secureApi<unknown>('depositProviders.updateGatewayAmt', {
          appName,
          mid: amountRow.mid,
          minDeposit: min,
          maxDeposit: max,
          amtUpdatedBy: updatedBy,
        });
        if (!res.ok) {
          setModalMsg(`${appName}: ${res.message || 'failed'}`);
          return;
        }
      }
      setAmountRow(null);
      void load();
    } finally {
      setBusy(false);
    }
  }, [amountRow, minAmt, maxAmt, amountApp, updatedBy, load]);

  const submitBonus = useCallback(async () => {
    if (!bonusRow) return;
    setBusy(true);
    setModalMsg('');
    try {
      const err = await run('depositProviders.updateBonusAndClients', {
        _id: bonusRow._id,
        bonus: {
          percentage: Number(bonusPercent) || 0,
          text: bonusText,
          tiers: bonusRow.bonus?.tiers || [],
        },
        bonusStatus,
        updatedBy,
      });
      if (err) {
        setModalMsg(err);
        return;
      }
      setBonusRow(null);
    } finally {
      setBusy(false);
    }
  }, [bonusRow, bonusPercent, bonusText, bonusStatus, run, updatedBy]);

  const submitAdd = useCallback(async () => {
    if (!addForm.name.trim()) {
      setModalMsg('Gateway name is required');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      const err = await run('depositProviders.create', {
        name: addForm.name.trim(),
        link: addForm.link.trim(),
        status: false,
        PaymentType: addForm.PaymentType.trim(),
        mid: addForm.mid.trim(),
        state: [],
        displayName: addForm.displayName.trim(),
        displayImage: addForm.displayImage.trim(),
        redirectionLink: addForm.redirectionLink.trim(),
        gatewayType: addForm.gatewayType.trim(),
      });
      if (err) {
        setModalMsg(err);
        return;
      }
      setAddOpen(false);
    } finally {
      setBusy(false);
    }
  }, [addForm, run]);

  const renderModalShell = (
    visible: boolean,
    title: string,
    onClose: () => void,
    children: React.ReactNode,
    opts?: { raise?: boolean },
  ) => (
    <Modal
      visible={visible}
      transparent
      animationType={opts?.raise ? 'fade' : 'slide'}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={[styles.backdrop, opts?.raise && styles.backdropCentered]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={opts?.raise ? styles.backdropTouchFill : styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View
          style={[
            styles.modalSheet,
            opts?.raise && styles.modalSheetRaised,
            { paddingBottom: modalBottomPad },
          ]}
        >
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            showsVerticalScrollIndicator={false}
            style={{ maxHeight: opts?.raise ? 480 : 420 }}
            contentContainerStyle={{ paddingBottom: spacing(2) }}
            keyboardShouldPersistTaps="handled"
          >
            {children}
            {modalMsg ? <Text style={styles.modalMsg}>{modalMsg}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Deposit Providers</Text>
      <Text style={styles.sub}>
        {startDate && endDate ? `${startDate} → ${endDate}` : 'All dates'} ·{' '}
        {filtered.length.toLocaleString('en-IN')} providers
      </Text>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
        }}
      />

      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search gateway / display / MID / link…"
          placeholderTextColor={colors.muted}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={styles.headerBtns}>
        {canAdd ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => {
              setAddForm({
                name: '',
                link: '',
                PaymentType: '',
                mid: '',
                displayName: '',
                displayImage: '',
                redirectionLink: '',
                gatewayType: '',
              });
              setModalMsg('');
              setAddOpen(true);
            }}
          >
            <Text style={styles.headerBtnText}>+ Add provider</Text>
          </TouchableOpacity>
        ) : null}
        {canAdd ? (
          <TouchableOpacity
            style={styles.headerBtnAlt}
            onPress={() =>
              openInput({
                title: 'Instant Payout clone',
                placeholder: 'Name…',
                secondPlaceholder: 'MID…',
                onSubmit: async (value, second) => {
                  if (!second) return 'MID is required';
                  return run('depositProviders.cloneIntentPay', { name: value, mid: second });
                },
              })
            }
          >
            <Text style={styles.headerBtnAltText}>Instant Payout</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && filtered.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && filtered.length === 0 ? (
        <Text style={styles.hint}>No deposit providers</Text>
      ) : null}

      <View style={styles.list}>
        {filtered.map((row, index) => {
          const active = Boolean(row.status);
          return (
            <TouchableOpacity
              key={`row-${index}-${String(row._id ?? '')}`}
              style={styles.card}
              activeOpacity={0.75}
              onPress={() => setSheetRow(row)}
            >
              <View style={styles.cardHeader}>
                <Text style={styles.cardIndex}>#{index + 1}</Text>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {display(row.name)}
                </Text>
                <Text style={[styles.statusPill, active ? styles.statusOn : styles.statusOff]}>
                  {active ? 'Active' : 'Inactive'}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  Display: {display(row.displayName)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  Order: {display(row.order)}
                </Text>
              </View>
              <View style={styles.cardSplitRow}>
                <Text style={styles.cardSplitLeft} numberOfLines={1}>
                  MID: {display(row.mid)}
                </Text>
                <Text style={styles.cardSplitRight} numberOfLines={1}>
                  {display(row.PaymentType || row.paymentType)}
                </Text>
              </View>
              <Text style={styles.cardHint}>Tap card for details & actions</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        imageUri={sheetRow?.gatewayImage || sheetRow?.displayImage || undefined}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => {
                  const listKeys = {
                    midArray: sheetRow.midArray,
                    upiArray: sheetRow.upiArray,
                    whatsAppNumbers: sheetRow.whatsAppNumbers,
                    states: sheetRow.stateNotAllowed,
                    cities: sheetRow.cityNotAllowed,
                  } as const;
                  const listSource =
                    c.key in listKeys
                      ? listKeys[c.key as keyof typeof listKeys]
                      : undefined;
                  const listItems =
                    listSource !== undefined ? normalizeStringList(listSource) : undefined;
                  return {
                    label: c.label,
                    value: c.render(sheetRow, 0),
                    multiline: [
                      'midArray',
                      'upiArray',
                      'whatsAppNumbers',
                      'states',
                      'cities',
                      'link',
                      'redirectionLink',
                    ].includes(c.key),
                    ...(listItems && listItems.length > 0
                      ? { listItems, listPreviewCount: 3 }
                      : null),
                  };
                })
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Generic input modal (order / instant payout) */}
      {renderModalShell(
        inputModal !== null,
        inputModal?.title || '',
        () => setInputModal(null),
        <View>
          <TextInput
            style={styles.modalInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={inputModal?.placeholder}
            placeholderTextColor={colors.muted}
            keyboardType={inputModal?.keyboardNumeric ? 'numeric' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {inputModal?.secondPlaceholder ? (
            <TextInput
              style={styles.modalInput}
              value={inputSecond}
              onChangeText={setInputSecond}
              placeholder={inputModal.secondPlaceholder}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ) : null}
          <TouchableOpacity
            style={[styles.submitBtn, inputSaving && styles.btnDisabled]}
            disabled={inputSaving}
            onPress={() => void submitInput()}
          >
            <Text style={styles.submitText}>{inputSaving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
          {inputMsg ? <Text style={styles.modalMsg}>{inputMsg}</Text> : null}
        </View>,
      )}

      {/* Edit field modal */}
      {renderModalShell(
        editRow !== null,
        `Edit field — ${editRow?.name || ''}`,
        () => setEditRow(null),
        <View>
          <View style={styles.chipsWrap}>
            {EDIT_FIELDS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, editKey === f.key && styles.chipActive]}
                onPress={() => {
                  setEditKey(f.key);
                  setInputValue(String((editRow as Record<string, unknown> | null)?.[f.key] ?? ''));
                }}
              >
                <Text style={[styles.chipText, editKey === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.modalInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder="New value…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void submitEditField()}
          >
            <Text style={styles.submitText}>{busy ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>,
      )}

      {/* Manage-list modal (MID / UPI / WhatsApp / City / State) */}
      {renderModalShell(
        listRow !== null,
        `Manage list — ${listRow?.name || ''}`,
        () => setListRow(null),
        <View>
          <View style={styles.chipsWrap}>
            {LIST_FIELDS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, listKey === f.key && styles.chipActive]}
                onPress={() => {
                  setListKey(f.key);
                  setModalMsg('');
                  setInputValue('');
                  if (f.key === 'state' && listRow) {
                    setStateDraft(normalizeStringList(listRow.stateNotAllowed));
                  }
                }}
              >
                <Text style={[styles.chipText, listKey === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {listKey === 'state' ? (
            <View style={{ gap: spacing(1.5), marginTop: spacing(2) }}>
              <Text style={styles.chipText}>
                Selected: {stateDraft.length ? stateDraft.join(', ') : 'none'}
              </Text>
              <View style={styles.chipsWrap}>
                {STATE_OPTIONS.map((state) => {
                  const active = stateDraft.includes(state);
                  return (
                    <TouchableOpacity
                      key={state}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() =>
                        setStateDraft((prev) =>
                          prev.includes(state)
                            ? prev.filter((s) => s !== state)
                            : [...prev, state],
                        )
                      }
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {state}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ) : (
            <View style={{ gap: spacing(1.5), marginTop: spacing(2) }}>
              {listValuesForKey(listRow, listKey).length === 0 ? (
                <Text style={styles.chipText}>No items yet</Text>
              ) : (
                listValuesForKey(listRow, listKey).map((item) => {
                  const isMid = listKey === 'mid';
                  const isWhatsapp = listKey === 'whatsapp';
                  const isUpi = listKey === 'upi';
                  const activeMobile = parseRedirectionMobile(listRow?.redirectionLink);
                  const isActive = isMid
                    ? String(listRow?.mid || '') === item
                    : isUpi
                      ? String(listRow?.link || '') === item
                      : isWhatsapp
                        ? activeMobile === item ||
                          activeMobile === parseRedirectionMobile(item)
                        : false;
                  const canEnable = isMid || isUpi || isWhatsapp;
                  return (
                    <View key={item} style={styles.midRow}>
                      {canEnable ? (
                        <TouchableOpacity
                          style={[styles.midEnableBtn, isActive && styles.midEnableBtnActive]}
                          disabled={busy || isActive}
                          onPress={() => {
                            void (async () => {
                              setBusy(true);
                              setModalMsg('');
                              try {
                                const payload: Record<string, unknown> = { _id: listRow!._id };
                                if (isMid) payload.mid = item;
                                else if (isUpi) payload.link = item;
                                else payload.redirectionLink = buildWhatsappRedirectionLink(item);
                                const err = await run(
                                  'depositProviders.updateMidNameLink',
                                  payload,
                                );
                                if (err) {
                                  setModalMsg(err);
                                  return;
                                }
                                patchListRow(
                                  isMid
                                    ? { mid: item }
                                    : isUpi
                                      ? { link: item }
                                      : { redirectionLink: buildWhatsappRedirectionLink(item) },
                                );
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                        >
                          <Text
                            style={[styles.midEnableText, isActive && styles.midEnableTextActive]}
                          >
                            {isActive ? 'Active' : 'Enable'}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      {isMid ? (
                        <TouchableOpacity
                          style={styles.midDeleteBtn}
                          disabled={busy}
                          onPress={() => void submitListRemoveMid(item)}
                        >
                          <Text style={styles.midDeleteText}>Delete</Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={styles.midName} numberOfLines={2}>
                        {item}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          )}

          {listKey !== 'state' && (listKey !== 'mid' || canAddMid) ? (
            <TextInput
              style={styles.modalInput}
              value={inputValue}
              onChangeText={setInputValue}
              placeholder={
                listKey === 'city'
                  ? 'City (comma-separated)…'
                  : listKey === 'mid'
                    ? 'MID to add…'
                    : listKey === 'whatsapp'
                      ? 'Mobile number…'
                      : 'Value to add…'
              }
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType={listKey === 'whatsapp' ? 'phone-pad' : 'default'}
            />
          ) : null}
          {listKey === 'state' || listKey !== 'mid' || canAddMid ? (
            <TouchableOpacity
              style={[styles.submitBtn, busy && styles.btnDisabled]}
              disabled={busy}
              onPress={() => void submitListAdd()}
            >
              <Text style={styles.submitText}>
                {busy
                  ? listKey === 'state'
                    ? 'Saving…'
                    : 'Adding…'
                  : listKey === 'state'
                    ? 'Submit states'
                    : 'Add'}
              </Text>
            </TouchableOpacity>
          ) : null}
          {modalMsg ? <Text style={styles.modalMsg}>{modalMsg}</Text> : null}
        </View>,
      )}

      {/* Amount modal */}
      {renderModalShell(
        amountRow !== null,
        `Update amount — ${amountRow?.name || ''}`,
        () => setAmountRow(null),
        <View>
          <View style={styles.chipsWrap}>
            {['All', ...CLIENT_NAMES].map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.chip, amountApp === name && styles.chipActive]}
                onPress={() => setAmountApp(name)}
              >
                <Text style={[styles.chipText, amountApp === name && styles.chipTextActive]}>
                  {name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.modalInput}
            value={minAmt}
            onChangeText={setMinAmt}
            placeholder="Min deposit…"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.modalInput}
            value={maxAmt}
            onChangeText={setMaxAmt}
            placeholder="Max deposit…"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
          />
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void submitAmount()}
          >
            <Text style={styles.submitText}>{busy ? 'Updating…' : 'Update amount'}</Text>
          </TouchableOpacity>
        </View>,
        { raise: true },
      )}

      {/* Bonus modal */}
      {renderModalShell(
        bonusRow !== null,
        `Update bonus — ${bonusRow?.name || ''}`,
        () => setBonusRow(null),
        <View>
          <TextInput
            style={styles.modalInput}
            value={bonusPercent}
            onChangeText={setBonusPercent}
            placeholder="Bonus percentage…"
            placeholderTextColor={colors.muted}
            keyboardType="numeric"
          />
          <TextInput
            style={styles.modalInput}
            value={bonusText}
            onChangeText={setBonusText}
            placeholder="Bonus text…"
            placeholderTextColor={colors.muted}
          />
          <View style={styles.chipsWrap}>
            {[
              { label: 'Bonus On', value: true },
              { label: 'Bonus Off', value: false },
            ].map((o) => (
              <TouchableOpacity
                key={o.label}
                style={[styles.chip, bonusStatus === o.value && styles.chipActive]}
                onPress={() => setBonusStatus(o.value)}
              >
                <Text style={[styles.chipText, bonusStatus === o.value && styles.chipTextActive]}>
                  {o.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void submitBonus()}
          >
            <Text style={styles.submitText}>{busy ? 'Updating…' : 'Update bonus'}</Text>
          </TouchableOpacity>
        </View>,
      )}

      {/* Add provider modal */}
      {renderModalShell(
        addOpen,
        'Add deposit provider',
        () => setAddOpen(false),
        <View>
          {(
            [
              ['name', 'Gateway name *'],
              ['displayName', 'Display name'],
              ['mid', 'MID'],
              ['link', 'Link'],
              ['PaymentType', 'Payment type'],
              ['displayImage', 'Display image URL'],
              ['redirectionLink', 'Redirection link'],
              ['gatewayType', 'Gateway type'],
            ] as [keyof typeof addForm, string][]
          ).map(([key, label]) => (
            <TextInput
              key={key}
              style={styles.modalInput}
              value={addForm[key]}
              onChangeText={(v) => setAddForm((f) => ({ ...f, [key]: v }))}
              placeholder={label}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
            />
          ))}
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void submitAdd()}
          >
            <Text style={styles.submitText}>{busy ? 'Adding…' : 'Add provider'}</Text>
          </TouchableOpacity>
        </View>,
        { raise: true },
      )}
    </ScrollView>
  );
}

