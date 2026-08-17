/**
 * Set Whatsapp Mid — mobile port of desktop WhatsappMidPage.
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
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type Row = {
  _id?: string;
  id?: string;
  name?: string;
  mid?: string;
  upiId?: string;
  maxDepositAllowed?: number;
  position?: number;
  isCurrentlyActive?: boolean;
  [key: string]: unknown;
};

type GatewayRow = {
  name?: string;
  displayName?: string;
  mid?: string;
  midArray?: string[];
};

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function asList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    for (const key of ['rows', 'data', 'list', 'items', 'payload', 'result']) {
      if (Array.isArray(d[key])) return d[key] as T[];
    }
  }
  return [];
}

const getRowId = (item: Row) => String(item._id || item.id || '').trim();

const dedupe = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.filter((v): v is string => !!v)));

const isWhatsappGateway = (item: GatewayRow) =>
  `${item?.name || ''}`.toLowerCase().includes('whatsapp');

export function WhatsappMidScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<Row | null>(null);
  const [gatewayNames, setGatewayNames] = useState<string[]>([]);
  const [gatewayMids, setGatewayMids] = useState<string[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState('');
  const [mid, setMid] = useState('');
  const [upiId, setUpiId] = useState('');
  const [maxDeposit, setMaxDeposit] = useState('');
  const [position, setPosition] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const genRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi<unknown>('whatsappMid.list', {});
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load WhatsApp MIDs');
        setRows([]);
        return;
      }
      setSheetRow(null);
      setRows(asList<Row>(res.data));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  const loadGateways = useCallback(async () => {
    const res = await secureApi<unknown>('depositProviders.list', {});
    if (!res.ok) return;
    const providers = asList<GatewayRow>(res.data).filter(isWhatsappGateway);
    setGatewayNames(dedupe(providers.map((g) => g.name || g.displayName)));
    setGatewayMids(
      dedupe(
        providers.flatMap((g) => [
          g.mid,
          ...(Array.isArray(g.midArray) ? g.midArray : []),
        ]),
      ),
    );
  }, []);

  useEffect(() => {
    void load();
    void loadGateways();
  }, [load, loadGateways]);

  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const byName = (a.name || '').localeCompare(b.name || '');
        if (byName !== 0) return byName;
        return (Number(a.position) || 0) - (Number(b.position) || 0);
      }),
    [rows],
  );

  /** Laxmi WhatsappMid — rows grouped under each Name (rowSpan on web). */
  const groupedByName = useMemo(() => {
    const groups: { name: string; items: Row[] }[] = [];
    const map = new Map<string, Row[]>();
    for (const row of sorted) {
      const key = String(row.name || '').trim() || 'Untitled';
      const list = map.get(key);
      if (list) list.push(row);
      else {
        const next = [row];
        map.set(key, next);
        groups.push({ name: key, items: next });
      }
    }
    return groups;
  }, [sorted]);

  const toggleStatus = async (row: Row, checked: boolean) => {
    const rowId = getRowId(row);
    if (!rowId) return;
    const res = await secureApi('whatsappMid.update', {
      id: rowId,
      isCurrentlyActive: checked,
    });
    if (!res.ok) {
      Alert.alert('Error', res.message || 'Failed to update status');
      return;
    }
    setRows((prev) =>
      prev.map((item) =>
        getRowId(item) === rowId ? { ...item, isCurrentlyActive: checked } : item,
      ),
    );
    setSheetRow((prev) =>
      prev && getRowId(prev) === rowId
        ? { ...prev, isCurrentlyActive: checked }
        : prev,
    );
  };

  const submitCreate = async () => {
    if (!name.trim() || !mid.trim() || !upiId.trim() || !maxDeposit.trim() || !position.trim()) {
      Alert.alert('Validation', 'Fill Name, MID, UPI Id, Max Deposit, and Position');
      return;
    }
    setSubmitting(true);
    try {
      const res = await secureApi('whatsappMid.create', {
        name: name.trim(),
        mid: mid.trim(),
        upiId: upiId.trim(),
        maxDepositAllowed: Number(maxDeposit),
        position: Number(position),
      });
      if (!res.ok) {
        Alert.alert('Error', res.message || 'Failed to create');
        return;
      }
      setFormOpen(false);
      setName('');
      setMid('');
      setUpiId('');
      setMaxDeposit('');
      setPosition('');
      await load();
    } finally {
      setSubmitting(false);
    }
  };

  const deleteRow = (row: Row) => {
    const rowId = getRowId(row);
    if (!rowId) return;
    Alert.alert('Delete WhatsApp MID?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            const res = await secureApi('whatsappMid.delete', { id: rowId });
            if (!res.ok) {
              Alert.alert('Error', res.message || 'Failed to delete');
              return;
            }
            setSheetRow(null);
            setRows((prev) => prev.filter((item) => getRowId(item) !== rowId));
          })();
        },
      },
    ]);
  };

  const sheetFields: SheetField[] = sheetRow
    ? [
        { label: 'Name', value: display(sheetRow.name) },
        { label: 'MID', value: display(sheetRow.mid) },
        { label: 'UPI Id', value: display(sheetRow.upiId) },
        { label: 'Max Deposit', value: display(sheetRow.maxDepositAllowed) },
        { label: 'Position', value: display(sheetRow.position) },
        {
          label: 'Active',
          value: sheetRow.isCurrentlyActive ? 'Yes' : 'No',
        },
      ]
    : [];

  const sheetActions: SheetAction[] = sheetRow
    ? [
        {
          label: sheetRow.isCurrentlyActive ? 'Deactivate' : 'Activate',
          onPress: () =>
            void toggleStatus(sheetRow, !Boolean(sheetRow.isCurrentlyActive)),
        },
        {
          label: 'Delete',
          tone: 'danger',
          onPress: () => deleteRow(sheetRow),
        },
      ]
    : [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={loading}
          onRefresh={() => void load()}
          tintColor={colors.primary}
        />
      }
    >
      <View style={styles.headerRow}>
        <Text style={styles.title}>Set Whatsapp Mid</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setFormOpen(true)}>
          <Text style={styles.addBtnText}>＋ Add</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {loading && rows.length === 0 ? <Text style={styles.hint}>Loading…</Text> : null}
      {!loading && rows.length === 0 ? (
        <Text style={styles.hint}>No WhatsApp MIDs found</Text>
      ) : null}

      <View style={styles.list}>
        {groupedByName.map((group) => (
          <View key={group.name} style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={styles.groupAccent} />
              <View style={styles.groupHeaderText}>
                <Text style={styles.groupLabel}>NAME</Text>
                <Text style={styles.groupTitle} numberOfLines={1}>
                  {group.name}
                </Text>
              </View>
              <View style={styles.groupBadge}>
                <Text style={styles.groupCount}>
                  {group.items.length}
                </Text>
              </View>
            </View>
            {group.items.map((row, i) => (
              <TouchableOpacity
                key={getRowId(row) || `${group.name}-${i}`}
                style={styles.card}
                onPress={() => setSheetRow(row)}
                activeOpacity={0.7}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    MID: {display(row.mid)}
                  </Text>
                  <Switch
                    value={Boolean(row.isCurrentlyActive)}
                    onValueChange={(v) => void toggleStatus(row, v)}
                    style={styles.cardSwitch}
                  />
                </View>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  UPI: {display(row.upiId)}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  Max {display(row.maxDepositAllowed)} · Pos {display(row.position)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.name) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal visible={formOpen} transparent animationType="slide" onRequestClose={() => setFormOpen(false)}>
        <KeyboardAvoidingView
          style={styles.backdrop}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.formSheet}>
            <ScrollView
              contentContainerStyle={[
                styles.formContent,
                { paddingBottom: Math.max(insets.bottom, spacing(4)) + spacing(4) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
            <Text style={styles.formTitle}>Add Whatsapp Mid</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              placeholderTextColor={colors.muted}
              value={name}
              onChangeText={setName}
            />
            {gatewayNames.length > 0 ? (
              <ScrollView horizontal style={styles.chipRow}>
                {gatewayNames.map((n) => (
                  <TouchableOpacity key={n} style={styles.chip} onPress={() => setName(n)}>
                    <Text style={styles.chipText}>{n}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="MID"
              placeholderTextColor={colors.muted}
              value={mid}
              onChangeText={setMid}
            />
            {gatewayMids.length > 0 ? (
              <ScrollView horizontal style={styles.chipRow}>
                {gatewayMids.slice(0, 20).map((m) => (
                  <TouchableOpacity key={m} style={styles.chip} onPress={() => setMid(m)}>
                    <Text style={styles.chipText}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            ) : null}
            <TextInput
              style={styles.input}
              placeholder="UPI Id"
              placeholderTextColor={colors.muted}
              value={upiId}
              onChangeText={setUpiId}
            />
            <TextInput
              style={styles.input}
              placeholder="Max Deposit Allowed"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={maxDeposit}
              onChangeText={setMaxDeposit}
            />
            <TextInput
              style={styles.input}
              placeholder="Position (1-15)"
              placeholderTextColor={colors.muted}
              keyboardType="numeric"
              value={position}
              onChangeText={setPosition}
            />
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setFormOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addBtn}
                disabled={submitting}
                onPress={() => void submitCreate()}
              >
                <Text style={styles.addBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(4),
  },
  title: { fontSize: 20, fontWeight: '700', color: colors.foreground },
  addBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
    borderRadius: radius.sm,
  },
  addBtnText: { color: colors.primaryForeground, fontWeight: '700' },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    padding: spacing(2),
    borderRadius: radius.sm,
    marginBottom: spacing(2),
  },
  errorText: { color: colors.destructive },
  hint: { color: colors.muted, marginBottom: spacing(2) },
  list: { gap: spacing(5) },
  group: { gap: spacing(1.5) },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    paddingHorizontal: spacing(3),
    gap: spacing(2.5),
  },
  groupAccent: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  groupHeaderText: { flex: 1, minWidth: 0 },
  groupLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 2,
  },
  groupTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '800',
  },
  groupBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing(2),
  },
  groupCount: {
    color: colors.primaryForeground,
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing(2),
    paddingHorizontal: spacing(2.5),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  cardName: {
    fontWeight: '700',
    color: colors.foreground,
    flex: 1,
    marginRight: 8,
    fontSize: 13,
  },
  cardSwitch: { transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] },
  cardMeta: { color: colors.muted, fontSize: 11, marginTop: 1, lineHeight: 14 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
  },
  formContent: {
    paddingHorizontal: spacing(4),
    paddingTop: spacing(4),
    gap: spacing(2),
  },
  formTitle: { fontSize: 18, fontWeight: '700', color: colors.foreground, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing(2),
    color: colors.foreground,
    backgroundColor: colors.background,
  },
  chipRow: { maxHeight: 40 },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
    backgroundColor: colors.surfaceAlt,
  },
  chipText: { color: colors.foreground, fontSize: 12 },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing(2),
    marginTop: spacing(2),
  },
  cancelBtn: {
    paddingHorizontal: spacing(4),
    paddingVertical: spacing(2),
  },
  cancelText: { color: colors.muted, fontWeight: '600' },
});
