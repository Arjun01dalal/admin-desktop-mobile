/**
 * Coin Permission — mobile port of the web panel's Add_Roles_And_Responsibilities
 * page (opened from the Coin Permission button on Roles & Responsibilities).
 *
 * users.getSubAdmins { itemPerPage, pageNo, filter?{name,mobile} } lists sub-admins.
 * Row tap opens the detail sheet with the same actions as desktop:
 *  - Add/Remove coin role       → subadmin.updateCoinRoles { _id:[id], type }
 *  - Add/Remove Coin Permission → subadmin.removeCoinPermission { _id, status }
 *  - Edit Coin Limit            → reports.addCoin { _id, coin, coinUpdatedBy }
 *  - Block / Un Block (remark)  → ops.blockCaller { _id, Role_ID, status, blockReason }
 *  - Add/Remove App (allowlisted Role_IDs only) → subadmin.updateAppHeads { userId, app, type }
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
import { pickPageSizes, asPaged, CLIENT_NAMES } from '@astro/shared';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { formatDisplayDate } from '../../../utils/dates';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id: string;
  name?: string;
  mobile?: string;
  email?: string;
  Role_ID?: string;
  coinLimit?: number | string;
  block?: boolean;
  showCoins?: boolean;
  showRemoveCoin?: boolean;
  allotedApps?: string[];
  createdOn?: string;
  updatedOn?: string;
  [key: string]: unknown;
};

const PAGE_SIZE_OPTIONS = pickPageSizes([20, 25, 50, 75, 100]);
// Same Role_ID allowlist the web panel uses for the Edit Apps "Add" button.
const EDIT_APPS_ADD_ROLE_IDS = new Set([
  '6a33c137a6558491e0d20464',
  '64f710d9a2ab78980020c5fb',
]);

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

export function CoinPermissionScreen({ onBack }: { onBack: () => void }) {
  const user = useMemo(() => getSessionUser(), []);
  // Same gate as the web panel's Coin Permission button (defensive re-check here).
  const canView = hasPermission('Add_Coin_Permission', user);
  const canAddApps = EDIT_APPS_ADD_ROLE_IDS.has(String(user?.Role_ID || ''));

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchName, setSearchName] = useState('');
  const [searchMob, setSearchMob] = useState('');
  const [applied, setApplied] = useState<{ name: string; mobile: string }>({ name: '', mobile: '' });
  const [rows, setRows] = useState<Row[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const genRef = useRef(0);

  // Edit Coin Limit modal
  const [coinOpen, setCoinOpen] = useState(false);
  const [coinValue, setCoinValue] = useState('');
  const [coinUserId, setCoinUserId] = useState('');

  // Block / Un Block remark modal
  const [blockOpen, setBlockOpen] = useState(false);
  const [blockRemark, setBlockRemark] = useState('');
  const [blockTarget, setBlockTarget] = useState<Row | null>(null);

  // Add / Remove App modal
  const [appOpen, setAppOpen] = useState(false);
  const [appMode, setAppMode] = useState<'add' | 'remove'>('add');
  const [appTarget, setAppTarget] = useState<Row | null>(null);
  const [appSelected, setAppSelected] = useState('');

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = { itemPerPage: pageSize, pageNo: page };
      const filter: Record<string, string> = {};
      if (applied.name.trim()) filter.name = applied.name.trim();
      if (applied.mobile.trim()) filter.mobile = applied.mobile.trim();
      if (Object.keys(filter).length > 0) payload.filter = filter;
      const res = await secureApi<unknown>('users.getSubAdmins', payload);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load sub-admins');
        setRows([]);
        setTotalPages(1);
        return;
      }
      const paged = asPaged<Row>(res.data);
      setSheetRow(null);
      setRows(paged.rows);
      setTotalPages(Math.max(1, paged.totalPages));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [page, pageSize, applied]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  const search = useCallback(() => {
    setApplied({ name: searchName, mobile: searchMob });
    setPage(1);
  }, [searchName, searchMob]);

  const runMutation = useCallback(
    async (fn: () => Promise<{ ok: boolean; message?: string }>, successMsg?: string) => {
      setBusy(true);
      try {
        const res = await fn();
        if (!res.ok) {
          Alert.alert(res.message || 'Request failed');
          return false;
        }
        if (successMsg) Alert.alert(successMsg);
        setSheetRow(null);
        void load();
        return true;
      } finally {
        setBusy(false);
      }
    },
    [load],
  );

  // Add / Remove coin role (single row — same endpoint desktop uses for bulk)
  const handleCoinRole = useCallback(
    (row: Row, type: 'add' | 'remove') => {
      void runMutation(() =>
        secureApi<unknown>('subadmin.updateCoinRoles', { _id: [row._id], type }),
      );
    },
    [runMutation],
  );

  const handleRemovePermission = useCallback(
    (row: Row) => {
      void runMutation(
        () =>
          secureApi<unknown>('subadmin.removeCoinPermission', {
            _id: row._id,
            status: !row.showRemoveCoin,
          }),
        row.showRemoveCoin ? 'Coin permission removed' : 'Coin permission added',
      );
    },
    [runMutation],
  );

  const submitCoin = useCallback(() => {
    if (!coinValue.trim()) {
      Alert.alert('Please enter coin');
      return;
    }
    setCoinOpen(false);
    void runMutation(
      () =>
        secureApi<unknown>('reports.addCoin', {
          _id: coinUserId,
          coin: coinValue.trim(),
          coinUpdatedBy: { _id: user?._id, name: user?.name, coin: coinValue.trim() },
        }),
      'Coin limit is updated',
    );
  }, [coinUserId, coinValue, runMutation, user]);

  const submitBlock = useCallback(() => {
    if (!blockRemark.trim()) {
      Alert.alert('Please enter remark');
      return;
    }
    const row = blockTarget;
    if (!row) return;
    setBlockOpen(false);
    void runMutation(() =>
      secureApi<unknown>('ops.blockCaller', {
        _id: row._id,
        Role_ID: row.Role_ID,
        status: !row.block,
        blockReason: blockRemark.trim(),
      }),
    );
  }, [blockTarget, blockRemark, runMutation]);

  const submitApp = useCallback(() => {
    const row = appTarget;
    if (!row || !appSelected) {
      Alert.alert(`Please select an app to ${appMode}`);
      return;
    }
    setAppOpen(false);
    void runMutation(() =>
      secureApi<unknown>('subadmin.updateAppHeads', {
        userId: row._id,
        app: appSelected,
        type: appMode,
      }),
    );
  }, [appTarget, appSelected, appMode, runMutation]);

  const columns = useMemo<DataTableColumn<Row>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String((page - 1) * pageSize + i + 1) },
      { key: 'name', label: 'Name', width: 140, render: (r) => display(r.name) },
      { key: 'mobile', label: 'Mobile No', width: 120, render: (r) => display(r.mobile) },
      { key: 'coinLimit', label: 'Coins Limit', width: 90, align: 'right', render: (r) => display(r.coinLimit) },
      { key: 'email', label: 'Email', width: 190, render: (r) => display(r.email) },
      { key: 'roleId', label: 'Role Id', width: 190, render: (r) => display(r.Role_ID) },
      { key: 'status', label: 'Status', width: 90, render: (r) => (r.block ? 'Blocked' : 'Active') },
      { key: 'coinRole', label: 'Coin Role', width: 90, render: (r) => (r.showCoins === true ? 'Added' : '—') },
      {
        key: 'removePerm',
        label: 'Remove Coin Permission',
        width: 160,
        render: (r) => (r.showRemoveCoin === true ? 'Yes' : 'No'),
      },
      { key: 'createdOn', label: 'Created On', width: 150, render: (r) => (r.createdOn ? formatDisplayDate(r.createdOn) : '—') },
      { key: 'updatedOn', label: 'Last Activity', width: 150, render: (r) => (r.updatedOn ? formatDisplayDate(r.updatedOn) : '—') },
      {
        key: 'apps',
        label: 'Current Apps',
        width: 220,
        render: (r) => (r.allotedApps && r.allotedApps.length > 0 ? r.allotedApps.join(', ') : '—'),
      },
    ],
    [page, pageSize],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return columns
      .filter((c) => c.key !== 'idx')
      .map<SheetField>((c) => ({
        label: c.label,
        value: c.render(sheetRow, 0),
        multiline: c.key === 'apps' || c.key === 'email' || c.key === 'roleId',
      }));
  }, [sheetRow, columns]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    const row = sheetRow;
    if (!row) return [];
    const actions: SheetAction[] = [];
    actions.push(
      row.showCoins === true
        ? { label: 'Remove Coin Role', tone: 'warning', disabled: busy, onPress: () => handleCoinRole(row, 'remove') }
        : { label: 'Add Coin Role', tone: 'primary', disabled: busy, onPress: () => handleCoinRole(row, 'add') },
    );
    actions.push({
      label: row.showRemoveCoin === true ? 'Remove Permission' : 'Add Permission',
      tone: row.showRemoveCoin === true ? 'warning' : 'default',
      disabled: busy,
      onPress: () => handleRemovePermission(row),
    });
    actions.push({
      label: 'Edit Coin Limit',
      tone: 'default',
      disabled: busy,
      onPress: () => {
        setCoinUserId(row._id);
        setCoinValue('');
        setCoinOpen(true);
      },
    });
    actions.push({
      label: row.block === true ? 'Un Block' : 'Block',
      tone: 'warning',
      disabled: busy,
      onPress: () => {
        setBlockTarget(row);
        setBlockRemark('');
        setBlockOpen(true);
      },
    });
    if (canAddApps) {
      actions.push({
        label: 'Add App',
        tone: 'default',
        disabled: busy,
        onPress: () => {
          setAppTarget(row);
          setAppMode('add');
          setAppSelected('');
          setAppOpen(true);
        },
      });
    }
    actions.push({
      label: 'Remove App',
      tone: 'warning',
      disabled: busy || !row.allotedApps || row.allotedApps.length === 0,
      onPress: () => {
        setAppTarget(row);
        setAppMode('remove');
        setAppSelected('');
        setAppOpen(true);
      },
    });
    return actions;
  }, [sheetRow, busy, canAddApps, handleCoinRole, handleRemovePermission]);

  const appOptions: readonly string[] =
    appMode === 'add' ? (CLIENT_NAMES as readonly string[]) : appTarget?.allotedApps || [];

  if (!canView) {
    return (
      <View style={[styles.screen, styles.content]}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backLink}>‹ Back to Roles</Text>
        </TouchableOpacity>
        <Text style={styles.mutedText}>You do not have permission to view this page.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <TouchableOpacity onPress={onBack}>
        <Text style={styles.backLink}>‹ Back to Roles</Text>
      </TouchableOpacity>
      <Text style={styles.title}>Coin Permission</Text>

      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={searchName}
          onChangeText={setSearchName}
          placeholder="Search name"
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TextInput
          style={[styles.input, styles.searchInput]}
          value={searchMob}
          onChangeText={setSearchMob}
          placeholder="Search mob"
          placeholderTextColor={colors.muted}
          keyboardType="phone-pad"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity style={styles.searchBtn} onPress={search}>
          <Text style={styles.searchBtnText}>Search</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.chipsRowWrap}>
        <Text style={styles.chipsLabel}>Per page:</Text>
        {PAGE_SIZE_OPTIONS.map((n) => (
          <TouchableOpacity
            key={n}
            style={[styles.chip, pageSize === n && styles.chipActive]}
            onPress={() => {
              if (pageSize !== n) {
                setPageSize(n);
                setPage(1);
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

      <DataTable
        columns={columns.filter((c) => ['idx', 'name', 'mobile', 'coinLimit', 'status'].includes(c.key))}
        rows={rows}
        keyFor={(r, i) => String(r._id || i)}
        loading={loading}
        emptyMessage="No sub-admins found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row for details & actions"
      />

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

      <RowDetailSheet
        visible={!!sheetRow}
        title={display(sheetRow?.name)}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      {/* Edit Coin Limit */}
      <Modal visible={coinOpen} transparent animationType="slide" onRequestClose={() => setCoinOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setCoinOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>Edit Coin Limit</Text>
            <TextInput
              style={styles.input}
              value={coinValue}
              onChangeText={setCoinValue}
              placeholder="Please enter coin"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setCoinOpen(false)}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary]} onPress={submitCoin}>
                <Text style={styles.formBtnPrimaryText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Block / Un Block remark */}
      <Modal visible={blockOpen} transparent animationType="slide" onRequestClose={() => setBlockOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback onPress={() => setBlockOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>
              {blockTarget?.block === true ? 'Un Block' : 'Block'} {display(blockTarget?.name)}
            </Text>
            <TextInput
              style={styles.input}
              value={blockRemark}
              onChangeText={setBlockRemark}
              placeholder="Please enter remark"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setBlockOpen(false)}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnPrimary]} onPress={submitBlock}>
                <Text style={styles.formBtnPrimaryText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add / Remove App */}
      <Modal visible={appOpen} transparent animationType="slide" onRequestClose={() => setAppOpen(false)}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={() => setAppOpen(false)}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.formSheet}>
            <Text style={styles.formTitle}>{appMode === 'add' ? 'Select an App' : 'Remove an App'}</Text>
            {appOptions.length === 0 ? (
              <Text style={styles.mutedText}>No apps assigned to this user.</Text>
            ) : (
              <View style={styles.appGrid}>
                {appOptions.map((appName) => {
                  const assigned = (appTarget?.allotedApps || []).includes(appName);
                  const disabled = appMode === 'add' && assigned;
                  const selected = appSelected === appName;
                  return (
                    <TouchableOpacity
                      key={appName}
                      style={[styles.chip, selected && styles.chipActive, disabled && styles.chipDisabled]}
                      disabled={disabled}
                      onPress={() => setAppSelected(appName)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{appName}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.formBtn, styles.formBtnGhost]} onPress={() => setAppOpen(false)}>
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.formBtn,
                  appMode === 'add' ? styles.formBtnPrimary : styles.formBtnDanger,
                  !appSelected && styles.btnDisabled,
                ]}
                disabled={!appSelected}
                onPress={submitApp}
              >
                <Text style={styles.formBtnPrimaryText}>{appMode === 'add' ? 'Submit' : 'Remove'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: 'transparent' },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  backLink: { color: colors.primary, fontSize: 14, fontWeight: '600', marginBottom: spacing(2) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginBottom: spacing(3) },
  searchRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(2), alignItems: 'center' },
  searchInput: { flex: 1, marginTop: 0 },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  searchBtnText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  chipsRowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing(2),
    alignItems: 'center',
    marginBottom: spacing(3),
  },
  chipsLabel: { color: colors.muted, fontSize: 12 },
  chip: {
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(1.5),
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.primaryForeground },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing(4),
    marginTop: spacing(3),
  },
  pagerBtn: { color: colors.primary, fontSize: 14, fontWeight: '700', padding: spacing(2) },
  pagerDisabled: { color: colors.muted, opacity: 0.5 },
  pagerLabel: { color: colors.muted, fontSize: 13 },
  mutedText: { color: colors.muted, fontSize: 13, marginTop: spacing(2) },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    gap: spacing(1),
  },
  formTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700', marginBottom: spacing(2) },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
    marginTop: spacing(1),
  },
  appGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(2), marginTop: spacing(2) },
  formActions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(4) },
  formBtn: {
    flex: 1,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBtnGhost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  formBtnGhostText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  formBtnPrimary: { backgroundColor: colors.primary },
  formBtnDanger: { backgroundColor: colors.destructive },
  formBtnPrimaryText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  btnDisabled: { opacity: 0.5 },
});
