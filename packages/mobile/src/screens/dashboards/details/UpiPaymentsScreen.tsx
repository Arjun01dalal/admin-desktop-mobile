/**
 * UPI Payments — port of desktop UpiPaymentsPage.
 * Two tabs: Notifications (upiPayments.notifications) and Requests
 * (upiPayments.transactions with paymentGatewayName 'upi-payment').
 * Pending notification edit, pending request Approve (addCoin) and
 * Change amount (Deposit_Pensil) actions from the row popup.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
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
import { pickPageSizes, CLIENT_NAMES, asPaged } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import type { DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type NotifRow = {
  _id?: string;
  title?: string;
  clientName?: string;
  text?: string;
  mid?: string;
  updatedOn?: string;
  reason?: string;
  updatedByName?: string;
  status?: string;
  [key: string]: unknown;
};

type ReqRow = {
  _id?: string;
  userId?: string;
  userName?: string;
  userMobile?: string;
  clientName?: string;
  amount?: number | string;
  orderId?: string;
  userState?: string;
  userCity?: string;
  userBankName?: string;
  paymentGatewayName?: string;
  mid?: string;
  status?: string;
  updatedBy?: { name?: string };
  createdOn?: string;
  [key: string]: unknown;
};

type Gateway = { _id?: string; name?: string; mid?: string };

type Tab = 'notifications' | 'requests';

const PAGE_SIZE_OPTIONS = pickPageSizes([10, 25, 50, 100]);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function statusBadge(status: unknown): string | undefined {
  const s = String(status || '').toLowerCase();
  if (s === 'approved' || s === 'success') return '#16a34a';
  if (s === 'pending') return '#d97706';
  if (s === 'processing') return '#2563eb';
  if (s === 'hold') return '#7c3aed';
  if (s === 'failed' || s === 'rejected') return '#dc2626';
  return undefined;
}

function dt(value: unknown): string {
  return value ? `${formatDisplayDate(String(value))} ${formatDisplayTime(String(value))}` : '—';
}

export function UpiPaymentsScreen() {
  const canEditDeposit = hasPermission('Deposit_Pensil');
  const canShowMobile = hasPermission('show_mobile');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);

  const [tab, setTab] = useState<Tab>('notifications');
  const [draftStart, setDraftStart] = useState(todayIST());
  const [draftEnd, setDraftEnd] = useState(todayIST());
  const [startDate, setStartDate] = useState(todayIST());
  const [endDate, setEndDate] = useState(todayIST());
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Gateways (mid filter for requests).
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [gatewayMid, setGatewayMid] = useState('');

  // Notifications state.
  const [notifRows, setNotifRows] = useState<NotifRow[]>([]);
  const [notifPage, setNotifPage] = useState(1);
  const [notifTotalPages, setNotifTotalPages] = useState(1);
  const [notifTotal, setNotifTotal] = useState(0);
  const [notifSheet, setNotifSheet] = useState<NotifRow | null>(null);

  // Requests state.
  const [reqRows, setReqRows] = useState<ReqRow[]>([]);
  const [reqPage, setReqPage] = useState(1);
  const [reqTotalPages, setReqTotalPages] = useState(1);
  const [reqSheet, setReqSheet] = useState<ReqRow | null>(null);

  // Notification edit modal.
  const [notifEdit, setNotifEdit] = useState<NotifRow | null>(null);
  const [notifStatus, setNotifStatus] = useState('');
  const [notifClient, setNotifClient] = useState('');
  const [notifUserId, setNotifUserId] = useState('');
  const [notifRemark, setNotifRemark] = useState('');
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifMsg, setNotifMsg] = useState('');

  // Approve modal.
  const [approveItem, setApproveItem] = useState<ReqRow | null>(null);
  const [approveReason, setApproveReason] = useState('');
  const [approveSaving, setApproveSaving] = useState(false);
  const [approveMsg, setApproveMsg] = useState('');

  // Change amount modal.
  const [amountItem, setAmountItem] = useState<ReqRow | null>(null);
  const [newAmount, setNewAmount] = useState('');
  const [amountSaving, setAmountSaving] = useState(false);
  const [amountMsg, setAmountMsg] = useState('');

  const genRef = useRef(0);

  useEffect(() => {
    void (async () => {
      const res = await secureApi<unknown>('upiPayments.gateways', {});
      if (!res.ok) return;
      const raw = res.data as { items?: Gateway[]; payload?: { items?: Gateway[] } } | Gateway[];
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.items)
          ? raw.items
          : Array.isArray(raw?.payload?.items)
            ? raw.payload.items
            : [];
      setGateways(list.filter((g) => String(g.name || '').toLowerCase() === 'upi-payment'));
    })();
  }, []);

  const loadNotifications = useCallback(
    async (gen: number) => {
      const res = await secureApi<unknown>('upiPayments.notifications', {
        itemsPerPage: pageSize,
        pageNo: notifPage,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load notifications');
        setNotifRows([]);
        setNotifTotalPages(1);
        setNotifTotal(0);
        return;
      }
      const parsed = asPaged<NotifRow>(res.data);
      setNotifSheet(null);
      setNotifRows(parsed.rows);
      setNotifTotalPages(Math.max(1, parsed.totalPages ?? 1));
      setNotifTotal(parsed.total ?? parsed.rows.length);
    },
    [pageSize, notifPage, startDate, endDate],
  );

  const loadRequests = useCallback(
    async (gen: number) => {
      const filter: Record<string, unknown> = { paymentGatewayName: 'upi-payment' };
      if (gatewayMid) filter.mid = gatewayMid;
      const res = await secureApi<unknown>('upiPayments.transactions', {
        type: 'deposit',
        itemsPerPage: pageSize,
        pageNo: reqPage,
        filter,
        startDate: startDate || todayIST(),
        endDate: endDate || todayIST(),
      });
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load UPI requests');
        setReqRows([]);
        setReqTotalPages(1);
        return;
      }
      const parsed = asPaged<ReqRow>(res.data);
      setReqSheet(null);
      // Desktop hides failed rows.
      setReqRows(parsed.rows.filter((r) => String(r.status || '').toLowerCase() !== 'failed'));
      setReqTotalPages(Math.max(1, parsed.totalPages ?? 1));
    },
    [pageSize, reqPage, gatewayMid, startDate, endDate],
  );

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'notifications') await loadNotifications(gen);
      else await loadRequests(gen);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [tab, loadNotifications, loadRequests]);

  useEffect(() => {
    void load();
  }, [load]);

  const submitNotifEdit = useCallback(async () => {
    if (!notifEdit?._id) return;
    if (!notifStatus || !notifClient || !notifUserId.trim() || !notifRemark.trim()) {
      setNotifMsg('Status, app, user ID and remark are all required');
      return;
    }
    setNotifSaving(true);
    setNotifMsg('');
    try {
      const res = await secureApi<unknown>('upiPayments.changeNotification', {
        _id: notifEdit._id,
        clientName: notifClient,
        status: notifStatus,
        remark: notifRemark,
        updatedByName: admin?.name,
        userId: notifUserId.trim(),
      });
      if (!res.ok) {
        setNotifMsg(res.message || 'Failed to update notification');
        return;
      }
      setNotifEdit(null);
      void load();
    } finally {
      setNotifSaving(false);
    }
  }, [notifEdit, notifStatus, notifClient, notifUserId, notifRemark, admin, load]);

  const submitApprove = useCallback(async () => {
    if (!approveItem) return;
    if (!approveReason) {
      setApproveMsg('Select a reason');
      return;
    }
    setApproveSaving(true);
    setApproveMsg('');
    try {
      const res = await secureApi<unknown>('upiPayments.addCoin', {
        userId: approveItem.userId,
        balance: approveItem.amount,
        updatedBy: { name: admin?.name, _id: admin?._id },
        reason: approveReason,
        remark: `Deposite failure of ${approveItem.userName} through ${approveItem.paymentGatewayName} pay with order id ${approveItem.orderId} and mobile no ${approveItem.userMobile ?? ''}`,
        tag: 'credit',
        orderId: approveItem.orderId,
      });
      if (!res.ok) {
        setApproveMsg(res.message || 'Failed to approve deposit');
        return;
      }
      setApproveItem(null);
      void load();
    } finally {
      setApproveSaving(false);
    }
  }, [approveItem, approveReason, admin, load]);

  const submitAmount = useCallback(async () => {
    if (!amountItem) return;
    const amt = Number(newAmount);
    if (!newAmount.trim() || !Number.isFinite(amt) || amt <= 0) {
      setAmountMsg('Enter a valid amount');
      return;
    }
    setAmountSaving(true);
    setAmountMsg('');
    try {
      const res = await secureApi<unknown>('upiPayments.changeAmount', {
        userId: amountItem.userId,
        transactionId: amountItem.orderId,
        amount: amt,
        paymentGatewayName: amountItem.paymentGatewayName,
      });
      if (!res.ok) {
        setAmountMsg(res.message || 'Failed to change amount');
        return;
      }
      setAmountItem(null);
      void load();
    } finally {
      setAmountSaving(false);
    }
  }, [amountItem, newAmount, load]);

  const notifColumns = useMemo<DataTableColumn<NotifRow>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((notifPage - 1) * pageSize + i + 1),
      },
      { key: 'title', label: 'Title', width: 140, render: (r) => display(r.title) },
      { key: 'clientName', label: 'App', width: 90, render: (r) => display(r.clientName) },
      { key: 'text', label: 'Text', width: 220, render: (r) => display(r.text) },
      { key: 'mid', label: 'MID', width: 120, render: (r) => display(r.mid) },
      { key: 'updatedOn', label: 'Updated On', width: 150, render: (r) => dt(r.updatedOn) },
      { key: 'reason', label: 'Mis Match Info', width: 160, render: (r) => display(r.reason) },
      { key: 'updatedByName', label: 'Updated By', width: 120, render: (r) => display(r.updatedByName) },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        render: (r) => display(r.status),
        badge: (r) => statusBadge(r.status),
      },
    ],
    [notifPage, pageSize],
  );

  const reqColumns = useMemo<DataTableColumn<ReqRow>[]>(
    () => [
      {
        key: 'idx',
        label: '#',
        width: 44,
        render: (_r, i) => String((reqPage - 1) * pageSize + i + 1),
      },
      { key: 'userName', label: 'Name', width: 120, render: (r) => display(r.userName) },
      {
        key: 'userMobile',
        label: 'Mobile',
        width: 110,
        render: (r) => (canShowMobile ? display(r.userMobile) : r.userMobile ? '**********' : '—'),
      },
      { key: 'clientName', label: 'App', width: 90, render: (r) => display(r.clientName) },
      { key: 'amount', label: 'Amount', width: 90, align: 'right', render: (r) => display(r.amount) },
      { key: 'orderId', label: 'Transaction ID', width: 180, render: (r) => display(r.orderId) },
      { key: 'userState', label: 'State', width: 110, render: (r) => display(r.userState) },
      { key: 'userCity', label: 'City', width: 110, render: (r) => display(r.userCity) },
      { key: 'userBankName', label: 'Bank', width: 130, render: (r) => display(r.userBankName) },
      {
        key: 'gateway',
        label: 'Gateway',
        width: 160,
        render: (r) => `${display(r.paymentGatewayName)}${r.mid ? ` - ${r.mid}` : ''}`,
      },
      {
        key: 'status',
        label: 'Status',
        width: 100,
        render: (r) => display(r.status),
        badge: (r) => statusBadge(r.status),
      },
      { key: 'updatedByName', label: 'Updated By', width: 120, render: (r) => display(r.updatedBy?.name) },
      { key: 'createdOn', label: 'Created On', width: 150, render: (r) => dt(r.createdOn) },
    ],
    [reqPage, pageSize, canShowMobile],
  );

  const notifActions: SheetAction[] = [];
  if (notifSheet && String(notifSheet.status || '').toLowerCase() === 'pending') {
    notifActions.push({
      label: 'Update notification',
      tone: 'primary',
      onPress: () => {
        setNotifEdit(notifSheet);
        setNotifStatus('');
        setNotifClient(String(notifSheet.clientName || ''));
        setNotifUserId('');
        setNotifRemark('');
        setNotifMsg('');
        setNotifSheet(null);
      },
    });
  }

  const reqActions: SheetAction[] = [];
  if (reqSheet && canEditDeposit) {
    const st = String(reqSheet.status || '').toLowerCase();
    if (st === 'pending' || st === 'processing') {
      reqActions.push(
        {
          label: 'Approve deposit',
          tone: 'primary',
          onPress: () => {
            setApproveItem(reqSheet);
            setApproveReason('');
            setApproveMsg('');
            setReqSheet(null);
          },
        },
        {
          label: 'Change amount',
          onPress: () => {
            setAmountItem(reqSheet);
            setNewAmount(String(reqSheet.amount ?? ''));
            setAmountMsg('');
            setReqSheet(null);
          },
        },
      );
    }
  }

  const page = tab === 'notifications' ? notifPage : reqPage;
  const totalPages = tab === 'notifications' ? notifTotalPages : reqTotalPages;
  const setPage = tab === 'notifications' ? setNotifPage : setReqPage;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>UPI Payments</Text>
      <Text style={styles.sub}>
        {startDate} → {endDate}
        {tab === 'notifications' ? ` · Notifications: ${notifTotal.toLocaleString('en-IN')}` : ''}
      </Text>

      <View style={styles.tabsRow}>
        {(
          [
            { key: 'notifications', label: 'Notifications' },
            { key: 'requests', label: 'Requests' },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.tabBtn, tab === t.key && styles.tabBtnActive]}
            onPress={() => setTab(t.key)}
          >
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <DetailFilterBar
        startDate={draftStart}
        endDate={draftEnd}
        loading={loading}
        onStartDateChange={setDraftStart}
        onEndDateChange={setDraftEnd}
        onApply={() => {
          setStartDate(draftStart);
          setEndDate(draftEnd);
          setNotifPage(1);
          setReqPage(1);
        }}
      />

      {tab === 'requests' && gateways.length > 0 ? (
        <View style={styles.chipsRow}>
          <Text style={styles.chipsLabel}>Gateway:</Text>
          {[{ mid: '', label: 'All' }, ...gateways.map((g) => ({ mid: g.mid || '', label: g.mid || '—' }))].map(
            (g) => (
              <TouchableOpacity
                key={g.label}
                style={[styles.chip, gatewayMid === g.mid && styles.chipActive]}
                onPress={() => {
                  if (gatewayMid !== g.mid) {
                    setGatewayMid(g.mid);
                    setReqPage(1);
                  }
                }}
              >
                <Text style={[styles.chipText, gatewayMid === g.mid && styles.chipTextActive]}>
                  {g.label}
                </Text>
              </TouchableOpacity>
            ),
          )}
        </View>
      ) : null}

      <View style={styles.chipsRow}>
        <Text style={styles.chipsLabel}>Per page:</Text>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              if (pageSize !== n) {
                setPageSize(n);
                setNotifPage(1);
                setReqPage(1);
              }
            }}
          >
            <Text style={[styles.chipText, pageSize === n && styles.chipTextActive]}>{n}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {tab === 'notifications' ? (
        <>
          {loading && notifRows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
          {!loading && notifRows.length === 0 ? (
            <Text style={styles.hint}>No notifications</Text>
          ) : null}
          <View style={styles.list}>
            {notifRows.map((row, index) => {
              const badge = statusBadge(row.status);
              return (
                <TouchableOpacity
                  key={`row-${index}-${String(row._id ?? '')}`}
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() => setNotifSheet(row)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>
                      #{(notifPage - 1) * pageSize + index + 1}
                    </Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {display(row.title)}
                    </Text>
                    <Text
                      style={[
                        styles.statusPill,
                        badge ? { color: badge, backgroundColor: `${badge}22` } : styles.statusNeutral,
                      ]}
                    >
                      {display(row.status)}
                    </Text>
                  </View>
                  <View style={styles.cardSplitRow}>
                    <Text style={styles.cardSplitLeft} numberOfLines={1}>
                      App: {display(row.clientName)}
                    </Text>
                    <Text style={styles.cardSplitRight} numberOfLines={1}>
                      MID: {display(row.mid)}
                    </Text>
                  </View>
                  <Text style={styles.cardHint}>Tap card for details & actions</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : (
        <>
          {loading && reqRows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
          {!loading && reqRows.length === 0 ? (
            <Text style={styles.hint}>No UPI requests</Text>
          ) : null}
          <View style={styles.list}>
            {reqRows.map((row, index) => {
              const badge = statusBadge(row.status);
              return (
                <TouchableOpacity
                  key={`row-${index}-${String(row._id || row.orderId || '')}`}
                  style={styles.card}
                  activeOpacity={0.75}
                  onPress={() => setReqSheet(row)}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.cardIndex}>#{(reqPage - 1) * pageSize + index + 1}</Text>
                    <Text style={styles.cardTitle} numberOfLines={1}>
                      {display(row.userName)}
                    </Text>
                    <Text
                      style={[
                        styles.statusPill,
                        badge ? { color: badge, backgroundColor: `${badge}22` } : styles.statusNeutral,
                      ]}
                    >
                      {display(row.status)}
                    </Text>
                  </View>
                  <View style={styles.cardSplitRow}>
                    <Text style={styles.cardSplitLeft} numberOfLines={1}>
                      Amount: {display(row.amount)}
                    </Text>
                    <Text style={styles.cardSplitRight} numberOfLines={1}>
                      App: {display(row.clientName)}
                    </Text>
                  </View>
                  <Text style={styles.cardHint}>Tap card for details & actions</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      <RowDetailSheet
        visible={notifSheet !== null}
        title={notifSheet ? display(notifSheet.title) : ''}
        fields={
          notifSheet
            ? notifColumns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({
                  label: c.label,
                  value: c.render(notifSheet, 0),
                  multiline: c.key === 'text' || c.key === 'reason',
                }))
            : []
        }
        actions={notifActions}
        onClose={() => setNotifSheet(null)}
      />

      <RowDetailSheet
        visible={reqSheet !== null}
        title={reqSheet ? display(reqSheet.userName) : ''}
        fields={
          reqSheet
            ? reqColumns
                .filter((c) => c.key !== 'idx')
                .map<SheetField>((c) => ({ label: c.label, value: c.render(reqSheet, 0) }))
            : []
        }
        actions={reqActions}
        onClose={() => setReqSheet(null)}
      />

      {/* Notification edit modal */}
      <Modal
        visible={notifEdit !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setNotifEdit(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setNotifEdit(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Update notification
              </Text>
              <TouchableOpacity
                onPress={() => setNotifEdit(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Status</Text>
              <View style={styles.chipsWrap}>
                {['Approved', 'Failed', 'Hold'].map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[styles.chip, notifStatus === s && styles.chipActive]}
                    onPress={() => setNotifStatus(s)}
                  >
                    <Text style={[styles.chipText, notifStatus === s && styles.chipTextActive]}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>App</Text>
              <View style={styles.chipsWrap}>
                {CLIENT_NAMES.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={[styles.chip, notifClient === name && styles.chipActive]}
                    onPress={() => setNotifClient(name)}
                  >
                    <Text style={[styles.chipText, notifClient === name && styles.chipTextActive]}>
                      {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.modalLabel}>User ID</Text>
              <TextInput
                style={styles.modalInput}
                value={notifUserId}
                onChangeText={setNotifUserId}
                placeholder="User ID…"
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Text style={styles.modalLabel}>Remark</Text>
              <TextInput
                style={styles.modalInput}
                value={notifRemark}
                onChangeText={setNotifRemark}
                placeholder="Remark…"
                placeholderTextColor={colors.muted}
              />
              <TouchableOpacity
                style={[styles.submitBtn, notifSaving && styles.btnDisabled]}
                disabled={notifSaving}
                onPress={() => void submitNotifEdit()}
              >
                <Text style={styles.submitText}>{notifSaving ? 'Saving…' : 'Update'}</Text>
              </TouchableOpacity>
              {notifMsg ? <Text style={styles.modalMsg}>{notifMsg}</Text> : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Approve modal */}
      <Modal
        visible={approveItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setApproveItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setApproveItem(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Manual settle Transaction
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setApproveItem(null);
                  setApproveReason('');
                  setApproveMsg('');
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.modalLabel}>Amount</Text>
            <Text style={styles.modalNote}>
              ₹{approveItem?.amount ?? '—'}
            </Text>
            <Text style={styles.modalLabel}>Select Reason</Text>
            <View style={styles.chipsWrap}>
              {['Deposit Failure', 'deposit-manual'].map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, approveReason === r && styles.chipActive]}
                  onPress={() => setApproveReason(r)}
                >
                  <Text style={[styles.chipText, approveReason === r && styles.chipTextActive]}>
                    {r}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.modalLabel}>Remark</Text>
            <Text style={styles.modalNote}>
              {approveItem
                ? `Deposite failure of ${approveItem.userName} through ${approveItem.paymentGatewayName} pay with order id ${approveItem.orderId} and mobile no ${approveItem.userMobile ?? ''}`
                : ''}
            </Text>
            <TouchableOpacity
              style={[styles.submitBtn, approveSaving && styles.btnDisabled]}
              disabled={approveSaving}
              onPress={() => void submitApprove()}
            >
              <Text style={styles.submitText}>{approveSaving ? 'Submitting…' : 'Submit'}</Text>
            </TouchableOpacity>
            {approveMsg ? <Text style={styles.modalMsg}>{approveMsg}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change amount modal */}
      <Modal
        visible={amountItem !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setAmountItem(null)}
      >
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={() => setAmountItem(null)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle} numberOfLines={1}>
                Change amount{amountItem ? ` — ${amountItem.userName}` : ''}
              </Text>
              <TouchableOpacity
                onPress={() => setAmountItem(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              value={newAmount}
              onChangeText={setNewAmount}
              placeholder="New amount…"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <TouchableOpacity
              style={[styles.submitBtn, (amountSaving || !newAmount.trim()) && styles.btnDisabled]}
              disabled={amountSaving || !newAmount.trim()}
              onPress={() => void submitAmount()}
            >
              <Text style={styles.submitText}>{amountSaving ? 'Saving…' : 'Update'}</Text>
            </TouchableOpacity>
            {amountMsg ? <Text style={styles.modalMsg}>{amountMsg}</Text> : null}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View style={styles.pager}>
        <Text
          style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
          onPress={() => page > 1 && setPage((p) => p - 1)}
        >
          ‹ Prev
        </Text>
        <Text style={styles.pagerLabel}>
          Page {page} / {totalPages}
        </Text>
        <Text
          style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
          onPress={() => page < totalPages && setPage((p) => p + 1)}
        >
          Next ›
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 12, marginTop: spacing(1) },
  tabsRow: { flexDirection: 'row', marginTop: spacing(3), gap: spacing(2) },
  tabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  tabBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  tabText: { color: colors.foreground, fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: colors.primaryForeground },
  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(3),
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    marginTop: spacing(1.5),
  },
  chipsLabel: { color: colors.muted, fontSize: 12 },
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
  hint: { color: colors.muted, marginTop: spacing(3), marginBottom: spacing(2) },
  list: { gap: spacing(2), marginTop: spacing(3) },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
    gap: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    marginBottom: spacing(1),
  },
  cardIndex: {
    color: colors.primaryForeground,
    backgroundColor: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 1,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  cardTitle: {
    color: colors.foreground,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    minWidth: 0,
  },
  statusPill: {
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: spacing(1.5),
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
    maxWidth: '36%',
  },
  statusNeutral: { color: colors.muted, backgroundColor: 'rgba(148,163,184,0.18)' },
  cardSplitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing(2),
    paddingVertical: 1,
  },
  cardSplitLeft: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    textAlign: 'left',
  },
  cardSplitRight: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    flexShrink: 0,
    maxWidth: '48%',
    textAlign: 'right',
  },
  cardHint: { color: colors.muted, fontSize: 10, marginTop: spacing(1) },
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
  modalLabel: { color: colors.muted, fontSize: 12, marginTop: spacing(3) },
  modalNote: { color: colors.muted, fontSize: 13, marginTop: spacing(2) },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
    fontSize: 14,
    marginTop: spacing(2),
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
  pager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing(4),
  },
  pagerBtn: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(3),
  },
  pagerLabel: { color: colors.muted, fontSize: 13 },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
});
