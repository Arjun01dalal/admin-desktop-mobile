/**
 * Set Whatsapp Mid — mobile port of desktop WhatsappMidPage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
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
    () => [...rows].sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [rows],
  );

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
        {sorted.map((row, i) => (
          <TouchableOpacity
            key={getRowId(row) || String(i)}
            style={styles.card}
            onPress={() => setSheetRow(row)}
            activeOpacity={0.7}
          >
            <View style={styles.cardTop}>
              <Text style={styles.cardName}>{display(row.name)}</Text>
              <Switch
                value={Boolean(row.isCurrentlyActive)}
                onValueChange={(v) => void toggleStatus(row, v)}
              />
            </View>
            <Text style={styles.cardMeta}>MID: {display(row.mid)}</Text>
            <Text style={styles.cardMeta}>UPI: {display(row.upiId)}</Text>
            <Text style={styles.cardMeta}>
              Max {display(row.maxDepositAllowed)} · Pos {display(row.position)}
            </Text>
          </TouchableOpacity>
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
        <View style={styles.backdrop}>
          <View style={styles.formSheet}>
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
          </View>
        </View>
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
  list: { gap: spacing(2) },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardName: { fontWeight: '700', color: colors.foreground, flex: 1, marginRight: 8 },
  cardMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  formSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(4),
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
