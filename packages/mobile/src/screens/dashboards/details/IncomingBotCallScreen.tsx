/**
 * Incoming Bot Call — mobile port of desktop IncomingBotCallPage.
 * incomingBot.list { since } lists calls (filtered to the allowed "to" numbers);
 * incomingBot.processCall { call_sid } returns the AI call summary/analysis.
 *
 * NOTE: on mobile both incomingBot.list and incomingBot.processCall are declared
 * as LOCAL registry actions, which secureApi does not support (it returns an
 * error). The screen is fully implemented, but until those actions are wired on
 * mobile the list load / summary fetch will surface a "not supported" error.
 *
 * Date filter + From/To/SID search. Row tap opens the detail sheet with the full
 * call fields, a "Play Recording" action (opens the recording URL in the browser)
 * and a "View Summary" action that fetches + shows the AI analysis rows.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { colors, radius, spacing } from '../../../theme';
import { DataTable, type DataTableColumn } from '../../../dashboards/ui/DataTable';
import { secureApi } from '../../../api/client';
import { todayIST } from '../../../utils/dates';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';

type IncomingCall = {
  sid: string;
  from?: string;
  to?: string;
  direction?: string;
  status?: string;
  start_time?: string;
  duration?: string | number;
  recording_url?: string | null;
};

type SummaryFlag = {
  flag?: unknown;
  reason?: string;
  level?: unknown;
  required?: unknown;
  value?: unknown;
  detected?: unknown;
  types?: string[];
};

type CallSummaryData = {
  status?: string;
  message?: string;
  call_sid?: string;
  data?: {
    transcript?: string;
    analysis?: Record<string, unknown>;
    [key: string]: unknown;
  };
};

const ALLOWED_TO_NUMBERS = ['08040265157', '08040265127', '02048556172'];

function display(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function getLast10Digits(value?: string | null): string {
  return (value ?? '').replace(/\D/g, '').slice(-10);
}

const ALLOWED_TO_SUFFIXES = ALLOWED_TO_NUMBERS.map(getLast10Digits);

function isAllowedToNumber(to?: string | null): boolean {
  return ALLOWED_TO_SUFFIXES.includes(getLast10Digits(to));
}

function startOfDayUtc(dateValue?: string): string {
  const date = dateValue ? new Date(dateValue) : new Date(todayIST());
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  ).toISOString();
}

function formatDateTime(value?: string): string {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
}

function formatDurationInMin(duration: string | number | undefined): string {
  const seconds = Number(duration);
  if (duration === undefined || duration === '' || Number.isNaN(seconds)) return '—';
  return (seconds / 60).toFixed(2);
}

function buildSummaryRows(summaryData: CallSummaryData | null) {
  const raw = summaryData?.data?.analysis ?? summaryData?.data;
  if (!raw || typeof raw !== 'object') return [];

  const data = raw as Record<string, unknown>;
  const threat = data.threat as SummaryFlag | undefined;
  const priority = data.priority as SummaryFlag | undefined;
  const humanIntervention = data.human_intervention as SummaryFlag | undefined;
  const satisfaction = data.satisfaction as SummaryFlag | undefined;
  const frustration = data.frustration as SummaryFlag | undefined;
  const nuisance = data.nuisance as SummaryFlag | undefined;
  const repeatedComplaint = data.repeated_complaint as SummaryFlag | undefined;
  const piiDetails = data.pii_details as SummaryFlag | undefined;

  return [
    { title: 'Summary', value: data.summary, reason: '-' },
    { title: 'Transcript', value: summaryData?.data?.transcript || data.transcript, reason: '-' },
    { title: 'Priority', value: priority?.level, reason: priority?.reason },
    { title: 'Threat', value: threat?.flag, reason: threat?.reason || 'N/A' },
    { title: 'Human Intervention', value: humanIntervention?.required, reason: humanIntervention?.reason },
    { title: 'Frustration', value: frustration?.level, reason: frustration?.reason },
    { title: 'Satisfaction', value: satisfaction?.value, reason: satisfaction?.reason || 'N/A' },
    { title: 'Nuisance', value: nuisance?.value, reason: nuisance?.reason },
    { title: 'Repeated Complaint', value: repeatedComplaint?.value, reason: repeatedComplaint?.reason },
    { title: 'PII Details', value: piiDetails?.detected, reason: piiDetails?.types?.join(', ') },
    { title: 'Next Best Action', value: data.next_best_action, reason: '' },
  ];
}

export function IncomingBotCallScreen() {
  const [sinceDate, setSinceDate] = useState(() => todayIST());
  const [draftSince, setDraftSince] = useState(() => todayIST());

  const [searchFrom, setSearchFrom] = useState('');
  const [searchTo, setSearchTo] = useState('');
  const [searchSid, setSearchSid] = useState('');
  const [appliedFrom, setAppliedFrom] = useState('');
  const [appliedTo, setAppliedTo] = useState('');
  const [appliedSid, setAppliedSid] = useState('');

  const [rows, setRows] = useState<IncomingCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheetRow, setSheetRow] = useState<IncomingCall | null>(null);

  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryData, setSummaryData] = useState<CallSummaryData | null>(null);

  const genRef = useRef(0);
  const summaryGenRef = useRef(0);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      // Desktop handles incomingBot.list locally in Electron by calling the
      // helper service directly; mobile does the same (plain public endpoint).
      let data: { calls?: IncomingCall[]; message?: string } | undefined;
      try {
        const resp = await fetch(
          `https://helper.callingbot.live/incoming-calls?since=${encodeURIComponent(
            startOfDayUtc(sinceDate),
          )}`,
        );
        if (gen !== genRef.current) return;
        if (!resp.ok) {
          setError(`Failed to load incoming calls (HTTP ${resp.status})`);
          setRows([]);
          return;
        }
        data = (await resp.json()) as { calls?: IncomingCall[]; message?: string };
      } catch (err) {
        if (gen !== genRef.current) return;
        setError(err instanceof Error ? err.message : 'Failed to load incoming calls');
        setRows([]);
        return;
      }
      if (gen !== genRef.current) return;
      const calls = Array.isArray(data?.calls) ? data!.calls! : [];
      setSheetRow(null);
      setRows(calls.filter((c) => isAllowedToNumber(c.to)));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [sinceDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const applySearch = useCallback(() => {
    setSinceDate(draftSince.trim() || todayIST());
    setAppliedFrom(searchFrom.trim());
    setAppliedTo(searchTo.trim());
    setAppliedSid(searchSid.trim());
  }, [draftSince, searchFrom, searchTo, searchSid]);

  const filteredRows = useMemo(() => {
    const fromQ = appliedFrom.toLowerCase();
    const toQ = appliedTo.toLowerCase();
    const sidQ = appliedSid.toLowerCase();
    return rows.filter((call) => {
      if (fromQ && !String(call.from || '').toLowerCase().includes(fromQ)) return false;
      if (toQ && !String(call.to || '').toLowerCase().includes(toQ)) return false;
      if (sidQ && !String(call.sid || '').toLowerCase().includes(sidQ)) return false;
      return true;
    });
  }, [rows, appliedFrom, appliedTo, appliedSid]);

  const openSummary = useCallback(async (call: IncomingCall) => {
    const gen = ++summaryGenRef.current;
    setSummaryOpen(true);
    setSummaryData(null);
    setSummaryLoading(true);
    try {
      // Same as desktop's local handler: call the helper service directly.
      try {
        const resp = await fetch('https://helper.callingbot.live/process-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ call_sid: call.sid }),
        });
        const data = (await resp.json()) as CallSummaryData & {
          status?: string;
          message?: string;
        };
        if (gen !== summaryGenRef.current) return;
        if (!resp.ok || data?.status === 'failed') {
          Alert.alert(data?.message || 'Analysis is in progress.');
          setSummaryOpen(false);
          return;
        }
        setSummaryData(data || null);
      } catch {
        if (gen !== summaryGenRef.current) return;
        Alert.alert('Analysis is in progress.');
        setSummaryOpen(false);
        return;
      }
    } finally {
      if (gen === summaryGenRef.current) setSummaryLoading(false);
    }
  }, []);

  const closeSummary = useCallback(() => {
    summaryGenRef.current += 1; // invalidate any in-flight summary fetch
    setSummaryOpen(false);
    setSummaryLoading(false);
  }, []);

  const summaryRows = useMemo(() => buildSummaryRows(summaryData), [summaryData]);

  const playRecording = useCallback((url?: string | null) => {
    if (!url) {
      Alert.alert('No recording available');
      return;
    }
    void Linking.openURL(url).catch(() => Alert.alert('Unable to open recording'));
  }, []);

  const columns = useMemo<DataTableColumn<IncomingCall>[]>(
    () => [
      { key: 'idx', label: '#', width: 44, render: (_r, i) => String(i + 1) },
      { key: 'from', label: 'From', width: 130, render: (r) => display(r.from) },
      { key: 'status', label: 'Status', width: 110, render: (r) => display(r.status) },
      { key: 'duration', label: 'Dur (min)', width: 90, align: 'right', render: (r) => formatDurationInMin(r.duration) },
    ],
    [],
  );

  const sheetFields = useMemo<SheetField[]>(() => {
    if (!sheetRow) return [];
    return [
      { label: 'From', value: display(sheetRow.from) },
      { label: 'To', value: display(sheetRow.to) },
      { label: 'SID', value: display(sheetRow.sid), multiline: true },
      { label: 'Type', value: display(sheetRow.direction) },
      { label: 'Status', value: display(sheetRow.status) },
      { label: 'Duration (min)', value: formatDurationInMin(sheetRow.duration) },
      { label: 'Start Time', value: formatDateTime(sheetRow.start_time) },
      { label: 'Recording', value: sheetRow.recording_url ? 'Available' : '—' },
    ];
  }, [sheetRow]);

  const sheetActions = useMemo<SheetAction[]>(() => {
    if (!sheetRow) return [];
    const row = sheetRow;
    const actions: SheetAction[] = [];
    if (row.recording_url) {
      actions.push({
        label: 'Play Recording',
        tone: 'default',
        onPress: () => playRecording(row.recording_url),
      });
    }
    actions.push({ label: 'View Summary', tone: 'primary', onPress: () => void openSummary(row) });
    return actions;
  }, [sheetRow, playRecording, openSummary]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={colors.primary} />
      }
    >
      <Text style={styles.title}>Incoming Bot Call</Text>

      <View style={styles.filterWrap}>
        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Since Date (UTC) · YYYY-MM-DD</Text>
          <TextInput
            style={styles.input}
            value={draftSince}
            onChangeText={setDraftSince}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
        <View style={styles.searchGrid}>
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchFrom}
            onChangeText={setSearchFrom}
            placeholder="From"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchTo}
            onChangeText={setSearchTo}
            placeholder="To"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <TextInput
            style={[styles.input, styles.searchCell]}
            value={searchSid}
            onChangeText={setSearchSid}
            placeholder="SID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={[styles.applyBtn, loading && styles.btnDisabled]}
          onPress={applySearch}
          disabled={loading}
        >
          <Text style={styles.applyText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <DataTable
        columns={columns}
        rows={filteredRows}
        keyFor={(r, i) => String(r.sid || i)}
        loading={loading}
        emptyMessage="No incoming calls found"
        onRowPress={(row) => setSheetRow(row)}
        hint="Tap a row for details, recording & summary"
      />

      <RowDetailSheet
        visible={sheetRow !== null}
        title={sheetRow ? display(sheetRow.from) : ''}
        fields={sheetFields}
        actions={sheetActions}
        onClose={() => setSheetRow(null)}
      />

      <Modal
        visible={summaryOpen}
        transparent
        animationType="slide"
        onRequestClose={closeSummary}
      >
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback onPress={closeSummary}>
            <View style={styles.backdropTouch} />
          </TouchableWithoutFeedback>
          <View style={styles.summarySheet}>
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryTitle}>Call Summary</Text>
              <TouchableOpacity
                onPress={closeSummary}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ paddingBottom: spacing(6) }}>
              {summaryLoading ? (
                <Text style={styles.summaryEmpty}>Loading…</Text>
              ) : summaryData ? (
                summaryRows.map((item) => (
                  <View key={item.title} style={styles.summaryRow}>
                    <Text style={styles.summaryAttr}>{item.title}</Text>
                    <Text style={styles.summaryValue}>{display(item.value)}</Text>
                    {item.reason ? (
                      <Text style={styles.summaryReason}>{display(item.reason)}</Text>
                    ) : null}
                  </View>
                ))
              ) : (
                <Text style={styles.summaryEmpty}>No summary data available.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing(4), paddingBottom: spacing(10) },
  title: { color: colors.foreground, fontSize: 20, fontWeight: '700', marginBottom: spacing(3) },
  filterWrap: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(3),
    gap: spacing(2),
    marginBottom: spacing(3),
  },
  field: { gap: spacing(1) },
  fieldLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
    fontSize: 14,
  },
  searchGrid: { flexDirection: 'row', gap: spacing(2) },
  searchCell: { flex: 1 },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing(3),
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  applyText: { color: colors.primaryForeground, fontWeight: '700', fontSize: 13 },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: colors.destructive,
    borderRadius: radius.md,
    padding: spacing(3),
    marginBottom: spacing(3),
  },
  errorText: { color: colors.destructive, fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  backdropTouch: { flex: 1 },
  summarySheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(4),
    maxHeight: '80%',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing(3),
  },
  summaryTitle: { color: colors.foreground, fontSize: 17, fontWeight: '700' },
  close: { color: colors.muted, fontSize: 18, fontWeight: '700' },
  summaryRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingVertical: spacing(2.5),
    gap: spacing(1),
  },
  summaryAttr: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  summaryValue: { color: colors.foreground, fontSize: 14 },
  summaryReason: { color: colors.muted, fontSize: 12 },
  summaryEmpty: { color: colors.muted, textAlign: 'center', marginVertical: spacing(6) },
});
