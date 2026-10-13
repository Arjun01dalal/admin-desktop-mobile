/**
 * Gtel Calls — mobile port of admin-panel-domains GtelCalls.
 * APIs: gtel.calls / dispositions / callDetails / clickToCall (+ subadminsByRole for extensions).
 * Recording opens externally via Linking (no in-app player).
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  CALLER_ROLE_IDS,
  DEFAULT_GTEL_PAGE_SIZE,
  EMPCODE_LIST_FILTER_ROLE_ID,
  GTEL_PAGE_SIZE_OPTIONS as GTEL_PAGE_SIZE_OPTIONS_ALL,
  GTEL_SHOW_MOBILE_OVERRIDE,
  buildGtelCallsQuery,
  buildGtelSummaryCards,
  emptyGtelFilters,
  extractGtelDispositions,
  extractGtelExtensions,
  formatGtelDuration,
  getGtelAppName,
  getGtelCallerEmpCode,
  getGtelCity,
  getGtelDpiId,
  getGtelLastActivityRaw,
  getGtelState,
  getGtelUserEmpCode,
  getGtelUsername,
  getNumericExtension,
  gtelDispositionTone,
  gtelStatusTone,
  isGtelRowAlert,
  maskGtelPhone,
  normalizeGtelCallsPage,
  sanitizeGtelPhone,
  type GtelCall,
  type GtelFilters,
  type GtelSummaryCard,
} from '@astro/shared';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, isDarkTheme, spacing } from '../../../theme';
import { secureApi } from '../../../api/client';
import { hasPermission, isCallerRole } from '../../../auth/permissions';
import {
  GtelClick2CallModal,
  canShowGtelC2c,
  type GtelC2cTarget,
} from '../../../components/GtelClick2CallModal';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { DetailFilterBar } from './DetailFilterBar';
import { styles } from './GtelCallsScreen.styles';

/** Cap mobile page sizes for virtualized list performance. */
const GTEL_PAGE_SIZE_OPTIONS = GTEL_PAGE_SIZE_OPTIONS_ALL.filter((n) => n <= 50);

function formatTs(value?: string | null): string {
  if (!value || value === '—') return '—';
  if (/^\d{4}-\d{2}-\d{2}T/.test(value) || /^\d{4}-\d{2}-\d{2}/.test(value)) {
    try {
      return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
    } catch {
      return value;
    }
  }
  return value;
}

type PillTone = 'answer' | 'noAnswer' | 'callback' | 'completed' | 'muted';

const PILL_TONES_DARK: Record<PillTone, { color: string; backgroundColor: string }> = {
  answer: { color: '#86efac', backgroundColor: 'rgba(22,163,74,0.28)' },
  noAnswer: { color: '#fca5a5', backgroundColor: 'rgba(239,68,68,0.28)' },
  callback: { color: '#fcd34d', backgroundColor: 'rgba(245,158,11,0.28)' },
  completed: { color: '#e0f2fe', backgroundColor: '#0284c7' },
  muted: { color: '#e2e8f0', backgroundColor: 'rgba(148,163,184,0.28)' },
};

const PILL_TONES_LIGHT: Record<PillTone, { color: string; backgroundColor: string }> = {
  answer: { color: '#166534', backgroundColor: 'rgba(22,163,74,0.16)' },
  noAnswer: { color: '#991b1b', backgroundColor: 'rgba(239,68,68,0.14)' },
  callback: { color: '#92400e', backgroundColor: 'rgba(245,158,11,0.18)' },
  /** Sky — not green; dark text on soft wash for light mode */
  completed: { color: '#075985', backgroundColor: 'rgba(14,165,233,0.2)' },
  muted: { color: '#334155', backgroundColor: 'rgba(148,163,184,0.22)' },
};

function StatusPill({
  label,
  tone,
  style,
}: {
  label: string;
  tone: PillTone;
  style?: object;
}) {
  const palette = isDarkTheme() ? PILL_TONES_DARK : PILL_TONES_LIGHT;
  const toneStyle = palette[tone] || palette.muted;
  return (
    <View style={[styles.pill, { backgroundColor: toneStyle.backgroundColor }, style]}>
      <Text style={[styles.pillText, { color: toneStyle.color }]}>{label}</Text>
    </View>
  );
}

function statusTone(status?: string | null): PillTone {
  const tone = gtelStatusTone(status);
  return (tone in PILL_TONES_DARK ? tone : 'muted') as PillTone;
}

function dispositionTone(disposition?: string | null): PillTone {
  const tone = gtelDispositionTone(disposition);
  return (tone in PILL_TONES_DARK ? tone : 'muted') as PillTone;
}

type GtelCallCardProps = {
  call: GtelCall;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  canShowC2c: boolean;
  canShowRecording: boolean;
  onOpenReport: (userId?: string, userName?: string) => void;
  onStartC2c: (call: GtelCall) => void;
  onOpenDetails: (callId?: string) => void;
};

const GtelCallCard = memo(function GtelCallCard({
  call,
  index,
  page,
  pageSize,
  canShowMobile,
  canShowC2c,
  canShowRecording,
  onOpenReport,
  onStartC2c,
  onOpenDetails,
}: GtelCallCardProps) {
  const dpi = getGtelDpiId(call);
  const name = getGtelUsername(call);
  const alert = isGtelRowAlert(call);
  const disposition = call.disposition || '';
  const phone = maskGtelPhone(call.phoneNumber, canShowMobile);
  const app = getGtelAppName(call);
  const ext = call.extension || '—';
  const when = formatTs(call.callDate || call.createdOn);
  const duration = formatGtelDuration(call.duration);
  const place = `${getGtelState(call)} / ${getGtelCity(call)}`;
  return (
    <View style={[styles.card, alert && styles.cardAlert, { marginBottom: spacing(2) }]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {name}
        </Text>
        <StatusPill label={call.status || '—'} tone={statusTone(call.status)} />
      </View>

      <Text style={styles.cardLine} numberOfLines={1}>
        {phone}
        {app !== '—' ? ` · ${app}` : ''}
        {ext !== '—' ? ` · Ext ${ext}` : ''}
      </Text>
      <Text style={styles.cardLineMuted} numberOfLines={1}>
        {when}
        {duration !== '—' ? ` · ${duration}` : ''}
        {` · Emp ${getGtelCallerEmpCode(call)}/${getGtelUserEmpCode(call)}`}
      </Text>
      {disposition ? (
        <StatusPill
          label={disposition}
          tone={dispositionTone(disposition)}
          style={styles.cardDisp}
        />
      ) : null}
      {place !== '— / —' ? (
        <Text style={styles.cardLineMuted} numberOfLines={1}>
          {place}
        </Text>
      ) : null}

      <View style={styles.cardActions}>
        {dpi !== '—' ? (
          <TouchableOpacity style={styles.actionBtn} onPress={() => onOpenReport(dpi, name)}>
            <Text style={styles.actionBtnText}>Report</Text>
          </TouchableOpacity>
        ) : null}
        {canShowC2c && call.phoneNumber ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGhost]}
            onPress={() => onStartC2c(call)}
          >
            <Text style={styles.actionBtnGhostText}>Call</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGhost]}
          onPress={() => void onOpenDetails(call.callId || call._id)}
        >
          <Text style={styles.actionBtnGhostText}>Details</Text>
        </TouchableOpacity>
        {canShowRecording && call.recordingUrl ? (
          <TouchableOpacity
            style={[styles.actionBtn, styles.actionBtnGhost]}
            onPress={() => void Linking.openURL(String(call.recordingUrl))}
          >
            <Text style={styles.actionBtnGhostText}>Rec</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
});

export function GtelCallsScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, spacing(3)) + spacing(2);
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const loginMobile = String(admin?.mobile || '').trim();
  const canShowMobile =
    loginMobile === GTEL_SHOW_MOBILE_OVERRIDE || hasPermission('show_mobile', admin);
  const canShowC2c = canShowGtelC2c(admin);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const loginExtensionId = getNumericExtension(admin?.extensionId);
  const roleId = String(admin?.Role_ID || '');
  const isCallerNew = roleId === EMPCODE_LIST_FILTER_ROLE_ID;
  const isCaller = CALLER_ROLE_IDS.has(roleId) || isCallerRole(admin);
  const shouldLockEmpCode = isCallerNew && Boolean(loginEmpCode);
  const canShowRecording = !isCaller;
  const canShowPersonalConnect = !isCaller;

  const today = todayIST();
  const [draft, setDraft] = useState<GtelFilters>(() =>
    emptyGtelFilters(today, shouldLockEmpCode ? loginEmpCode : ''),
  );
  const [applied, setApplied] = useState<GtelFilters>(() =>
    emptyGtelFilters(today, shouldLockEmpCode ? loginEmpCode : ''),
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_GTEL_PAGE_SIZE);
  const [rows, setRows] = useState<GtelCall[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryCards, setSummaryCards] = useState<GtelSummaryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [dispositions, setDispositions] = useState<string[]>([]);
  const [extensions, setExtensions] = useState<string[]>([]);
  const [picker, setPicker] = useState<null | 'extension' | 'disposition'>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsCallId, setDetailsCallId] = useState('');
  const [details, setDetails] = useState<Record<string, unknown> | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [manualUsers, setManualUsers] = useState<Record<string, unknown>[]>([]);
  const [manualUsersOpen, setManualUsersOpen] = useState(false);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);
  const genRef = useRef(0);

  useEffect(() => {
    if (!shouldLockEmpCode || !loginEmpCode) return;
    setDraft((prev) => (prev.empCode === loginEmpCode ? prev : { ...prev, empCode: loginEmpCode }));
    setApplied((prev) =>
      prev.empCode === loginEmpCode ? prev : { ...prev, empCode: loginEmpCode },
    );
  }, [shouldLockEmpCode, loginEmpCode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [dispRes, extRes] = await Promise.all([
        secureApi('gtel.dispositions', {}),
        secureApi('caller.subadminsByRole', { filter: {} }),
      ]);
      if (cancelled) return;
      setDispositions(dispRes.ok ? extractGtelDispositions(dispRes.data) : []);
      setExtensions(extRes.ok ? extractGtelExtensions(extRes.data) : []);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const empCodeFilter = shouldLockEmpCode ? loginEmpCode : applied.empCode.trim();
      const res = await secureApi(
        'gtel.calls',
        buildGtelCallsQuery({
          pageNo: page,
          itemsPerPage: pageSize,
          filters: applied,
          canShowMobile,
          shouldLockEmpCode,
          loginEmpCode,
          isCaller,
          loginExtensionId,
        }),
      );
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch calls');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setSummaryCards([]);
        return;
      }
      const parsed = normalizeGtelCallsPage(res.data, pageSize, empCodeFilter || undefined);
      setRows(parsed.rows);
      setTotal(parsed.total);
      setTotalPages(parsed.totalPages);
      setSummaryCards(buildGtelSummaryCards(parsed.summary, parsed.rows, parsed.total));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [
    applied,
    canShowMobile,
    isCaller,
    loginEmpCode,
    loginExtensionId,
    page,
    pageSize,
    shouldLockEmpCode,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = () => {
    const next = shouldLockEmpCode ? { ...draft, empCode: loginEmpCode } : draft;
    setPage(1);
    setApplied({ ...next });
  };

  const handleReset = () => {
    const next = emptyGtelFilters(todayIST(), shouldLockEmpCode ? loginEmpCode : '');
    setDraft(next);
    setPage(1);
    setApplied(next);
  };

  const openDetails = useCallback(async (callId?: string) => {
    if (!callId) {
      Alert.alert('Details', 'Call ID not found');
      return;
    }
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsCallId(callId);
    setDetails(null);
    try {
      const res = await secureApi('gtel.callDetails', { callId });
      if (!res.ok) {
        Alert.alert('Details', res.message || 'Failed to fetch call details');
        setDetailsOpen(false);
        return;
      }
      const body =
        res.data && typeof res.data === 'object'
          ? (res.data as Record<string, unknown>)
          : null;
      setDetails(body);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  const startC2c = useCallback((call: GtelCall) => {
    const phone = sanitizeGtelPhone(call.phoneNumber);
    if (!phone) {
      Alert.alert('Call', 'Phone number not found');
      return;
    }
    setC2cTarget({
      phoneNumber: phone,
      userId: getGtelDpiId(call) !== '—' ? getGtelDpiId(call) : undefined,
      userName: getGtelUsername(call) !== '—' ? getGtelUsername(call) : undefined,
      appName: getGtelAppName(call) !== '—' ? getGtelAppName(call) : undefined,
      lastActivity: formatTs(getGtelLastActivityRaw(call)),
    });
  }, []);

  const searchManualUsers = useCallback(async () => {
    const phone = sanitizeGtelPhone(manualPhone);
    if (phone.length !== 10) {
      Alert.alert('Call', 'Valid 10 digit number required');
      return;
    }
    setManualSearching(true);
    try {
      const res = await secureApi('users.getAll', {
        itemsPerPage: 50,
        pageNo: 1,
        filter: { mobile: phone },
      });
      if (!res.ok) {
        Alert.alert('Call', res.message || 'Failed to fetch users');
        return;
      }
      const raw = res.data as
        | { user?: Record<string, unknown>[]; users?: Record<string, unknown>[]; items?: Record<string, unknown>[] }
        | undefined;
      const list =
        (Array.isArray(raw?.user) && raw.user) ||
        (Array.isArray(raw?.users) && raw.users) ||
        (Array.isArray(raw?.items) && raw.items) ||
        [];
      setManualUsers(list);
      setManualOpen(false);
      setManualUsersOpen(true);
    } finally {
      setManualSearching(false);
    }
  }, [manualPhone]);

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId || userId === '—') return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [navigation],
  );

  const detailEntries = useMemo(() => {
    if (!details) return [] as [string, string][];
    const hidden = new Set(['dialerResponse', 'hangupResponse', 'webhookPayload', 'summary', 'Summary']);
    if (!canShowRecording) hidden.add('recordingUrl');
    if (!canShowPersonalConnect) hidden.add('personalConnectCategories');
    const order = [
      'callId',
      'username',
      'userName',
      'name',
      'clientName',
      'dpi_id',
      'dp_id',
      'userId',
      'empCode',
      'state',
      'city',
      'phoneNumber',
      'extension',
      'status',
      'statusByDialer',
      'disposition',
      'duration',
      'callDate',
      'recordingUrl',
      'transcription',
      'createdOn',
    ];
    const keys = [
      ...order.filter((k) => k in details && !hidden.has(k)),
      ...Object.keys(details).filter((k) => !order.includes(k) && !hidden.has(k)),
    ];
    return keys.map((key) => {
      let value = details[key];
      if (key === 'phoneNumber') value = maskGtelPhone(String(value || ''), canShowMobile);
      if (key === 'duration') value = formatGtelDuration(Number(value));
      if (
        typeof value === 'string' &&
        (/^\d{4}-\d{2}-\d{2}T/.test(value) || key.toLowerCase().includes('at') || key.includes('On'))
      ) {
        value = formatTs(value);
      }
      if (typeof value === 'object' && value != null) value = JSON.stringify(value);
      return [key, value == null || value === '' ? '—' : String(value)] as [string, string];
    });
  }, [canShowMobile, canShowPersonalConnect, canShowRecording, details]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<GtelCall>) => (
      <GtelCallCard
        call={item}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={canShowMobile}
        canShowC2c={canShowC2c}
        canShowRecording={canShowRecording}
        onOpenReport={openUserReport}
        onStartC2c={startC2c}
        onOpenDetails={openDetails}
      />
    ),
    [
      canShowC2c,
      canShowMobile,
      canShowRecording,
      openDetails,
      openUserReport,
      page,
      pageSize,
      startC2c,
    ],
  );

  const listHeader = (
    <>
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Gtel Calls</Text>
          <Text style={styles.sub}>
            Search dialer call history by date, extension, phone number, or disposition.
          </Text>
        </View>
        {canShowC2c ? (
          <TouchableOpacity
            style={styles.manualCallBtn}
            onPress={() => {
              setManualPhone('');
              setManualUsers([]);
              setManualOpen(true);
            }}
          >
            <Text style={styles.manualCallBtnText}>Call</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.statsRow}>
        {summaryCards.map((card) => (
          <View key={card.key} style={styles.stat}>
            <Text style={styles.statLabel}>{card.label}</Text>
            <Text style={styles.statValue}>{card.value.toLocaleString('en-IN')}</Text>
          </View>
        ))}
      </View>

      <DetailFilterBar
        collapsible
        filtersExpanded={filtersExpanded}
        onToggleFilters={() => setFiltersExpanded((o) => !o)}
        startDate={draft.from}
        endDate={draft.to}
        loading={loading}
        onStartDateChange={(v) => setDraft((p) => ({ ...p, from: v }))}
        onEndDateChange={(v) => setDraft((p) => ({ ...p, to: v }))}
        onApply={handleSearch}
        onClearAllFilters={handleReset}
        pageSize={pageSize}
        pageSizeOptions={GTEL_PAGE_SIZE_OPTIONS}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      >
        <Text style={styles.fieldLabel}>Extension</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setPicker('extension')}>
          <Text style={styles.selectBtnText}>{draft.extension || 'All'}</Text>
        </TouchableOpacity>

        {canShowMobile ? (
          <>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={draft.phoneNumber}
              onChangeText={(v) => setDraft((p) => ({ ...p, phoneNumber: v }))}
              keyboardType="phone-pad"
              placeholder="Phone"
              placeholderTextColor={colors.muted}
            />
          </>
        ) : null}

        <Text style={styles.fieldLabel}>Employee Code</Text>
        <TextInput
          style={styles.textInput}
          value={draft.empCode}
          onChangeText={(v) => setDraft((p) => ({ ...p, empCode: v }))}
          editable={!shouldLockEmpCode}
          placeholder="Emp Code"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>Disposition</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setPicker('disposition')}>
          <Text style={styles.selectBtnText}>
            {draft.disposition === 'null' ? 'No Disposition' : draft.disposition || 'All'}
          </Text>
        </TouchableOpacity>
      </DetailFilterBar>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </>
  );

  const listFooter = (
    <View style={styles.pager}>
      <Text
        style={[styles.pagerBtn, page <= 1 && styles.pagerDisabled]}
        onPress={() => page > 1 && setPage((p) => p - 1)}
      >
        ‹ Prev
      </Text>
      <Text style={styles.pagerLabel}>
        Page {page} / {totalPages} · {total.toLocaleString('en-IN')}
      </Text>
      <Text
        style={[styles.pagerBtn, page >= totalPages && styles.pagerDisabled]}
        onPress={() => page < totalPages && setPage((p) => p + 1)}
      >
        Next ›
      </Text>
    </View>
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={(call, index) => `${call.callId || call._id || index}`}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No calls found"
        refreshing={loading}
        onRefresh={() => void load()}
      />

      {/* Extension / disposition picker */}
      <Modal
        visible={picker != null}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity
            style={{ flex: 1 }}
            activeOpacity={1}
            onPress={() => setPicker(null)}
          />
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>
              {picker === 'extension' ? 'Select Extension' : 'Select Disposition'}
            </Text>
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: 8 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              <TouchableOpacity
                style={styles.modalOption}
                onPress={() => {
                  if (picker === 'extension') setDraft((p) => ({ ...p, extension: '' }));
                  else setDraft((p) => ({ ...p, disposition: '' }));
                  setPicker(null);
                }}
              >
                <Text style={styles.modalOptionText}>All</Text>
              </TouchableOpacity>
              {picker === 'disposition' ? (
                <TouchableOpacity
                  style={styles.modalOption}
                  onPress={() => {
                    setDraft((p) => ({ ...p, disposition: 'null' }));
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>No Disposition</Text>
                </TouchableOpacity>
              ) : null}
              {(picker === 'extension' ? extensions : dispositions).map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.modalOption}
                  onPress={() => {
                    if (picker === 'extension') setDraft((p) => ({ ...p, extension: item }));
                    else setDraft((p) => ({ ...p, disposition: item }));
                    setPicker(null);
                  }}
                >
                  <Text style={styles.modalOptionText}>{item}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDone} onPress={() => setPicker(null)}>
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Call details */}
      <Modal
        visible={detailsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setDetailsOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Call Details</Text>
            <Text style={styles.sub} selectable>
              {detailsCallId || '—'}
            </Text>
            {detailsLoading ? <Text style={styles.hint}>Loading…</Text> : null}
            {!detailsLoading && !details ? <Text style={styles.hint}>No details found</Text> : null}
            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ paddingBottom: spacing(4) }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {detailEntries.map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{key}</Text>
                  <Text style={styles.detailValue} selectable>
                    {value}
                  </Text>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalDone} onPress={() => setDetailsOpen(false)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual dial phone entry */}
      <Modal
        visible={manualOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setManualOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Manual Call</Text>
            <Text style={styles.fieldLabel}>Phone Number</Text>
            <TextInput
              style={styles.textInput}
              value={manualPhone}
              onChangeText={setManualPhone}
              keyboardType="phone-pad"
              maxLength={10}
              placeholder="10 digit mobile"
              placeholderTextColor={colors.muted}
            />
            <View style={styles.filterActions}>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnPrimary, manualSearching && { opacity: 0.6 }]}
                disabled={manualSearching}
                onPress={() => void searchManualUsers()}
              >
                <Text style={styles.formBtnPrimaryText}>
                  {manualSearching ? 'Searching…' : 'Search'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.formBtn, styles.formBtnGhost]}
                onPress={() => setManualOpen(false)}
              >
                <Text style={styles.formBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Manual dial user picker */}
      <Modal
        visible={manualUsersOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setManualUsersOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalSheet, { paddingBottom: sheetBottomPad }]}>
            <Text style={styles.modalTitle}>Select User</Text>
            {!manualUsers.length ? (
              <Text style={styles.hint}>No users found for this number</Text>
            ) : (
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.userList}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
                {manualUsers.map((user, idx) => {
                  const id = String(user._id || user.dp_id || '');
                  const name = String(user.name || user.userName || user.username || '—');
                  const mobile = String(user.mobile || manualPhone);
                  const startCall = () => {
                    setManualUsersOpen(false);
                    setC2cTarget({
                      phoneNumber: sanitizeGtelPhone(mobile),
                      userId: id || undefined,
                      userName: name,
                      appName: String(user.clientName || '') || undefined,
                      lastActivity: formatTs(
                        String(
                          user.lastActivity ||
                            user.last_activity ||
                            user.activeUser ||
                            user.active_user ||
                            '',
                        ),
                      ),
                    });
                  };
                  return (
                    <TouchableOpacity
                      key={`${id}-${idx}`}
                      style={styles.userRow}
                      activeOpacity={0.75}
                      onPress={startCall}
                    >
                      <View style={styles.userInfo}>
                        <Text style={styles.userName}>{name}</Text>
                        <Text style={styles.userMeta}>
                          {maskGtelPhone(mobile, canShowMobile)}
                        </Text>
                        {id ? <Text style={styles.userId} selectable>{id}</Text> : null}
                      </View>
                      <View style={styles.userCallBtn}>
                        <Text style={styles.userCallBtnText}>Call</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <TouchableOpacity style={styles.modalDone} onPress={() => setManualUsersOpen(false)}>
              <Text style={styles.modalDoneText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <GtelClick2CallModal
        target={c2cTarget}
        onClose={() => setC2cTarget(null)}
        onEnded={() => void load()}
        canShowMobile={canShowMobile}
      />
    </>
  );
}
