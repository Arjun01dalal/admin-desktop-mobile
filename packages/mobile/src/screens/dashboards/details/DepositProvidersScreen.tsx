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
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { CLIENT_NAMES } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

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

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

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

export function DepositProvidersScreen() {
  const canAdd = hasPermission('Add_PayIn_Account');
  const canToggle = hasPermission('Toggle_PayIn_Account');
  const canDelete = hasPermission('Delete_PayIn_Account');
  const canEdit = !hasPermission('Disable_Deposit_Provider_Edit');
  const canUpdateAmount = hasPermission('Update_Deposit_Amount_Edit');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const updatedBy = useMemo(
    () => ({ userId: admin?._id, userName: admin?.name }),
    [admin],
  );

  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
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
  const [listKey, setListKey] = useState<(typeof LIST_FIELDS)[number]['key']>('mid');

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
      { key: 'displayName', label: 'Display Name', width: 130, render: (r) => display(r.displayName) },
      {
        key: 'status',
        label: 'Status',
        width: 80,
        render: (r) => (r.status ? 'Active' : 'Inactive'),
        badge: (r) => (r.status ? '#16a34a' : '#dc2626'),
      },
      { key: 'mid', label: 'MID', width: 140, render: (r) => display(r.mid) },
      { key: 'midArray', label: 'MID List', width: 180, render: (r) => display(r.midArray) },
      { key: 'link', label: 'Link', width: 180, render: (r) => display(r.link) },
      { key: 'upiArray', label: 'UPI List', width: 180, render: (r) => display(r.upiArray) },
      {
        key: 'whatsAppNumbers',
        label: 'WhatsApp Numbers',
        width: 180,
        render: (r) => display(r.whatsAppNumbers),
      },
      {
        key: 'redirectionLink',
        label: 'Redirection Link',
        width: 180,
        render: (r) => display(r.redirectionLink),
      },
      { key: 'states', label: 'Blocked States', width: 180, render: (r) => display(r.stateNotAllowed) },
      { key: 'cities', label: 'Blocked Cities', width: 180, render: (r) => display(r.cityNotAllowed) },
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
            r.updatedOn ? ` · ${formatDisplayDate(r.updatedOn)} ${formatDisplayTime(r.updatedOn)}` : ''
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
        label: 'Add to list',
        onPress: () => {
          setListRow(sheetRow);
          setListKey('mid');
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

  const submitListAdd = useCallback(async () => {
    if (!listRow) return;
    const value = inputValue.trim();
    if (!value) {
      setModalMsg('Value is required');
      return;
    }
    setBusy(true);
    setModalMsg('');
    try {
      let err: string | null;
      if (listKey === 'mid') {
        err = await run('depositProviders.updateMidArray', { _id: listRow._id, midArray: [value] });
      } else if (listKey === 'upi') {
        err = await run('depositProviders.updateUpiArray', { _id: listRow._id, upiArray: [value] });
      } else if (listKey === 'whatsapp') {
        err = await run('depositProviders.updateWhatsappNumbers', {
          _id: listRow._id,
          whatsAppNumbers: [value],
        });
      } else if (listKey === 'city') {
        err = await run('depositProviders.updateBonusAndClients', {
          _id: listRow._id,
          cityNotAllowed: {
            cities: value.split(',').map((s) => s.trim()).filter(Boolean),
            action: 'add',
          },
          updatedBy,
        });
      } else {
        err = await run('depositProviders.updateBonusAndClients', {
          _id: listRow._id,
          stateNotAllowed: {
            states: value.split(',').map((s) => s.trim()).filter(Boolean),
            action: 'add',
          },
          updatedBy,
        });
      }
      if (err) {
        setModalMsg(err);
        return;
      }
      setListRow(null);
      setInputValue('');
    } finally {
      setBusy(false);
    }
  }, [listRow, listKey, inputValue, run, updatedBy]);

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
  ) => (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.backdropTouch} />
        </TouchableWithoutFeedback>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {title}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
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
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Deposit Providers</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate} · {filtered.length.toLocaleString('en-IN')} providers
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

      <DataTable
        columns={columns.filter((c) => ['idx', 'name', 'displayName', 'status', 'order'].includes(c.key))}
        rows={filtered}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No deposit providers"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row to see all details"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        imageUri={sheetRow?.gatewayImage || sheetRow?.displayImage || undefined}
        fields={
          sheetRow
            ? columns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
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
                }))
            : []
        }
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Generic input modal (order / instant payout) */}
      {renderModalShell(inputModal !== null, inputModal?.title || '', () => setInputModal(null), (
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
        </View>
      ))}

      {/* Edit field modal */}
      {renderModalShell(editRow !== null, `Edit field — ${editRow?.name || ''}`, () => setEditRow(null), (
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
        </View>
      ))}

      {/* Add-to-list modal */}
      {renderModalShell(listRow !== null, `Add to list — ${listRow?.name || ''}`, () => setListRow(null), (
        <View>
          <View style={styles.chipsWrap}>
            {LIST_FIELDS.map((f) => (
              <TouchableOpacity
                key={f.key}
                style={[styles.chip, listKey === f.key && styles.chipActive]}
                onPress={() => setListKey(f.key)}
              >
                <Text style={[styles.chipText, listKey === f.key && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput
            style={styles.modalInput}
            value={inputValue}
            onChangeText={setInputValue}
            placeholder={
              listKey === 'city' || listKey === 'state'
                ? 'Comma-separated values…'
                : 'Value to add…'
            }
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[styles.submitBtn, busy && styles.btnDisabled]}
            disabled={busy}
            onPress={() => void submitListAdd()}
          >
            <Text style={styles.submitText}>{busy ? 'Adding…' : 'Add'}</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Amount modal */}
      {renderModalShell(
        amountRow !== null,
        `Update amount — ${amountRow?.name || ''}`,
        () => setAmountRow(null),
        (
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
          </View>
        ),
      )}

      {/* Bonus modal */}
      {renderModalShell(
        bonusRow !== null,
        `Update bonus — ${bonusRow?.name || ''}`,
        () => setBonusRow(null),
        (
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
          </View>
        ),
      )}

      {/* Add provider modal */}
      {renderModalShell(addOpen, 'Add deposit provider', () => setAddOpen(false), (
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
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  searchRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing(3) },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
  },
  headerBtns: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  headerBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  headerBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  headerBtnAlt: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(4),
  },
  headerBtnAltText: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(1.5),
    paddingHorizontal: spacing(3),
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.foreground, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginTop: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  backdropTouch: { flex: 1 },
  modalSheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.md * 2,
    borderTopRightRadius: radius.md * 2,
    padding: spacing(4),
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: spacing(2),
  },
  modalClose: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginTop: spacing(2.5),
  },
  submitBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    marginTop: spacing(4),
  },
  btnDisabled: { opacity: 0.5 },
  submitText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 14 },
  modalMsg: { color: colors.destructive, fontSize: 12, marginTop: spacing(2) },
});
