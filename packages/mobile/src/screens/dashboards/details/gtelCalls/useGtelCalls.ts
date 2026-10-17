/** Data + actions for Gtel Calls (menu + Dashboard→Calls modes). */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CALLER_ROLE_IDS,
  DEFAULT_GTEL_PAGE_SIZE,
  EMPCODE_LIST_FILTER_ROLE_ID,
  buildGtelCallsQuery,
  buildGtelCxSummaryCounts,
  buildGtelSummaryCards,
  emptyGtelFilters,
  extractGtelCallById,
  extractGtelCallsFromCallerDashboard,
  extractGtelDispositions,
  extractGtelExtensions,
  formatGtelDuration,
  getGtelAppName,
  getGtelDpiId,
  getGtelLastActivityRaw,
  getGtelPlayedVerticals,
  getGtelUsername,
  getNumericExtension,
  GTEL_SHOW_MOBILE_OVERRIDE,
  GTEL_STATUS_FILTER_CARDS,
  gtelCallMatchesStatus,
  gtelSummaryCountForStatus,
  isGtelFlaggedCall,
  maskGtelPhone,
  normalizeGtelCallsPage,
  pickGtelRecordingUrl,
  sanitizeGtelPhone,
  type GtelCall,
  type GtelFilters,
  type GtelStatusFilter,
  type GtelSummaryCard,
} from '@astro/shared';
import { secureApi } from '../../../../api/client';
import { hasPermission, isCallerRole } from '../../../../auth/permissions';
import { canShowGtelC2c, type GtelC2cTarget } from '../../../../components/GtelClick2CallModal';
import { getStoredUser } from '../../../../lib/webShim';
import { spacing } from '../../../../theme';
import { todayIST } from '../../../../utils/dates';
import { type CxQuickFilter, formatGtelTs } from './format';

export function useGtelCalls() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const routeParams = (useRoute().params ?? {}) as Record<string, unknown>;
  const insets = useSafeAreaInsets();
  const sheetBottomPad = Math.max(insets.bottom, spacing(3)) + spacing(2);
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const loginMobile = String(admin?.mobile || '').trim();
  const canShowMobile =
    loginMobile === GTEL_SHOW_MOBILE_OVERRIDE || hasPermission('show_mobile', admin);
  const canShowC2c = canShowGtelC2c(admin);
  const canShowGtelDashboard = hasPermission('show_gtel_dashboard', admin);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const loginExtensionId = getNumericExtension(admin?.extensionId);
  const roleId = String(admin?.Role_ID || '');
  const isCallerNew = roleId === EMPCODE_LIST_FILTER_ROLE_ID;
  const isCaller = CALLER_ROLE_IDS.has(roleId) || isCallerRole(admin);
  const shouldLockEmpCode = isCallerNew && Boolean(loginEmpCode);
  const canShowRecording = !isCaller;
  const canShowPersonalConnect = !isCaller;

  const today = todayIST();
  const routeFrom = typeof routeParams.from === 'string' ? routeParams.from.trim() : '';
  const routeTo = typeof routeParams.to === 'string' ? routeParams.to.trim() : '';
  const routeEmp =
    typeof routeParams.empCode === 'string' ? routeParams.empCode.trim() : '';
  /** Opened via Caller Dashboard → Calls — hide Dashboard / Call Start / Call. */
  const hideHeroActions = routeParams.hideHeroActions === true;
  const initialEmp = shouldLockEmpCode ? loginEmpCode : routeEmp;
  const [draft, setDraft] = useState<GtelFilters>(() => ({
    ...emptyGtelFilters(routeFrom || today, initialEmp),
    from: routeFrom || today,
    to: routeTo || today,
    empCode: initialEmp,
  }));
  const [applied, setApplied] = useState<GtelFilters>(() => ({
    ...emptyGtelFilters(routeFrom || today, initialEmp),
    from: routeFrom || today,
    to: routeTo || today,
    empCode: initialEmp,
  }));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_GTEL_PAGE_SIZE);
  const [rows, setRows] = useState<GtelCall[]>([]);
  /** Full list when opened from Dashboard→Calls (client pagination). */
  const [allCalls, setAllCalls] = useState<GtelCall[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summaryCards, setSummaryCards] = useState<GtelSummaryCard[]>([]);
  const [summaryRaw, setSummaryRaw] = useState<Record<string, unknown> | null>(null);
  /** Client-side status chip filter. */
  const [statusFilter, setStatusFilter] = useState<GtelStatusFilter>('');
  /** Dashboard → Calls: Exch / Casino / SM / Flagged quick filter. */
  const [cxQuickFilter, setCxQuickFilter] = useState<CxQuickFilter>('all');
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
  /** Flagged call → GET /dialer/calls?callId= → Recording / Transcript. */
  const [flaggedMedia, setFlaggedMedia] = useState<{
    callId: string;
    loading: boolean;
    call: GtelCall | null;
    view: 'actions' | 'transcript';
  } | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [manualSearching, setManualSearching] = useState(false);
  const [manualUsers, setManualUsers] = useState<Record<string, unknown>[]>([]);
  const [manualUsersOpen, setManualUsersOpen] = useState(false);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);
  const [callStartOpen, setCallStartOpen] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    if (!shouldLockEmpCode || !loginEmpCode) return;
    setDraft((prev) => (prev.empCode === loginEmpCode ? prev : { ...prev, empCode: loginEmpCode }));
    setApplied((prev) =>
      prev.empCode === loginEmpCode ? prev : { ...prev, empCode: loginEmpCode },
    );
  }, [shouldLockEmpCode, loginEmpCode]);

  // Apply filters when opened from Caller Dashboard (Calls button).
  useEffect(() => {
    if (!routeFrom && !routeTo && !routeEmp) return;
    if (shouldLockEmpCode) return;
    setDraft((prev) => ({
      ...prev,
      from: routeFrom || prev.from,
      to: routeTo || prev.to,
      empCode: routeEmp || prev.empCode,
    }));
    setApplied((prev) => ({
      ...prev,
      from: routeFrom || prev.from,
      to: routeTo || prev.to,
      empCode: routeEmp || prev.empCode,
    }));
  }, [routeEmp, routeFrom, routeTo, shouldLockEmpCode]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Dispositions are cheap; skip heavy subadmins list when opened from Dashboard→Calls.
      const tasks: Promise<unknown>[] = [secureApi('gtel.dispositions', {})];
      if (!hideHeroActions) {
        tasks.push(secureApi('caller.subadminsByRole', { filter: {} }));
      }
      const results = await Promise.all(tasks);
      if (cancelled) return;
      const dispRes = results[0] as Awaited<ReturnType<typeof secureApi>>;
      setDispositions(dispRes.ok ? extractGtelDispositions(dispRes.data) : []);
      if (!hideHeroActions) {
        const extRes = results[1] as Awaited<ReturnType<typeof secureApi>>;
        setExtensions(extRes.ok ? extractGtelExtensions(extRes.data) : []);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hideHeroActions]);

  /** Dashboard→Calls: GET /dialer/caller-dashboard?includeCalls=true (admin parity). */
  const loadDashboardCalls = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      // Prefer route params (Caller Dashboard → Calls), then applied filters.
      const empCodeFilter = shouldLockEmpCode
        ? loginEmpCode
        : (routeEmp || applied.empCode).trim();
      const fromFilter = (routeFrom || applied.from).trim();
      const toFilter = (routeTo || applied.to).trim();
      if (!empCodeFilter) {
        setAllCalls([]);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setError('Employee code is required to load caller calls.');
        return;
      }
      const dashPayload: Record<string, unknown> = {
        // Admin sends string "true" — keep the same query shape.
        includeCalls: 'true',
        empCode: empCodeFilter,
      };
      if (fromFilter) dashPayload.from = fromFilter;
      if (toFilter) dashPayload.to = toFilter;
      const dashRes = await secureApi('gtel.callerDashboard', dashPayload);
      if (gen !== genRef.current) return;
      if (!dashRes.ok) {
        setError(dashRes.message || 'Failed to fetch calls');
        setAllCalls([]);
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setSummaryCards([]);
        setSummaryRaw(null);
        return;
      }
      const embedded = extractGtelCallsFromCallerDashboard(
        dashRes.data,
        empCodeFilter,
      ) as GtelCall[];
      const dashBody =
        dashRes.data && typeof dashRes.data === 'object'
          ? (dashRes.data as Record<string, unknown>)
          : null;
      const summary =
        (dashBody?.summary as Record<string, unknown> | null) ||
        (dashBody?.Summary as Record<string, unknown> | null) ||
        null;
      setAllCalls(embedded);
      setTotal(embedded.length);
      setSummaryRaw(summary);
      setSummaryCards(buildGtelSummaryCards(summary, embedded, embedded.length));
      setCxQuickFilter('all');
      setStatusFilter('');
      setPage(1);
      if (!embedded.length) {
        setError('No calls found for this caller in the selected date range.');
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [
    applied.empCode,
    applied.from,
    applied.to,
    loginEmpCode,
    routeEmp,
    routeFrom,
    routeTo,
    shouldLockEmpCode,
  ]);

  /** Menu Gtel Calls: server pagination. */
  const loadServerPage = useCallback(async () => {
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
          filters: { ...applied, status: '' },
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
        setAllCalls([]);
        setTotal(0);
        setTotalPages(1);
        setSummaryCards([]);
        setSummaryRaw(null);
        return;
      }
      const parsed = normalizeGtelCallsPage(res.data, pageSize, empCodeFilter || undefined);
      setAllCalls([]);
      setRows(parsed.rows);
      setTotal(parsed.total);
      setTotalPages(parsed.totalPages);
      setSummaryRaw(parsed.summary);
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
    if (!hideHeroActions) return;
    void loadDashboardCalls();
  }, [hideHeroActions, loadDashboardCalls]);

  useEffect(() => {
    if (hideHeroActions) return;
    void loadServerPage();
  }, [hideHeroActions, loadServerPage]);

  const handleSearch = () => {
    const next = shouldLockEmpCode
      ? { ...draft, empCode: loginEmpCode, status: '' as const }
      : { ...draft, status: '' as const };
    setStatusFilter('');
    setPage(1);
    setApplied(next);
  };

  const handleReset = () => {
    const next = emptyGtelFilters(todayIST(), shouldLockEmpCode ? loginEmpCode : '');
    setDraft(next);
    setStatusFilter('');
    setPage(1);
    setApplied(next);
  };

  const toggleStatusFilter = useCallback((key: Exclude<GtelStatusFilter, ''>) => {
    setStatusFilter((cur) => (cur === key ? '' : key));
    setPage(1);
  }, []);

  const statusSource = hideHeroActions ? allCalls : rows;
  const statusCards = useMemo(() => {
    return GTEL_STATUS_FILTER_CARDS.map((card) => {
      const fromSummary = gtelSummaryCountForStatus(summaryRaw, summaryCards, card.key);
      const fromPage = statusSource.filter((r) => gtelCallMatchesStatus(r, card.key)).length;
      return {
        ...card,
        value: fromSummary || fromPage,
      };
    });
  }, [statusSource, summaryCards, summaryRaw]);

  const cxCounts = useMemo(
    () => (hideHeroActions ? buildGtelCxSummaryCounts(allCalls) : null),
    [allCalls, hideHeroActions],
  );

  const filteredSource = useMemo(() => {
    const source = hideHeroActions ? allCalls : rows;
    return source.filter((r) => {
      if (statusFilter && !gtelCallMatchesStatus(r, statusFilter)) return false;
      if (hideHeroActions && cxQuickFilter === 'flagged') {
        if (!isGtelFlaggedCall(r)) return false;
      } else if (hideHeroActions && cxQuickFilter !== 'all') {
        if (!getGtelPlayedVerticals(r).includes(cxQuickFilter)) return false;
      }
      return true;
    });
  }, [allCalls, cxQuickFilter, hideHeroActions, rows, statusFilter]);

  const visibleRows = useMemo(() => {
    if (!hideHeroActions) return filteredSource;
    const start = (page - 1) * pageSize;
    return filteredSource.slice(start, start + pageSize);
  }, [filteredSource, hideHeroActions, page, pageSize]);

  const pagerTotal = hideHeroActions
    ? filteredSource.length
    : statusFilter
      ? filteredSource.length
      : total;
  const pagerPages = hideHeroActions
    ? Math.max(1, Math.ceil(filteredSource.length / pageSize) || 1)
    : Math.max(1, totalPages);

  useEffect(() => {
    if (page > pagerPages) setPage(pagerPages);
  }, [page, pagerPages]);

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

  const openFlaggedMedia = useCallback(async (call: GtelCall) => {
    const callId = String(
      call.callId || (call as { call_id?: unknown }).call_id || call.dialerUniqueId || '',
    ).trim();
    if (!callId || callId === '—') {
      Alert.alert('Media', 'Call ID not found');
      return;
    }
    setFlaggedMedia({ callId, loading: true, call: null, view: 'actions' });
    try {
      // Admin Caller Calls: GET /dialer/calls?callId=…
      const res = await secureApi('gtel.calls', { callId });
      if (!res.ok) {
        Alert.alert('Media', res.message || 'Failed to fetch call media');
        setFlaggedMedia(null);
        return;
      }
      const found = extractGtelCallById(res.data, callId);
      if (!found) {
        Alert.alert('Media', 'Call details not found');
        setFlaggedMedia(null);
        return;
      }
      setFlaggedMedia({ callId, loading: false, call: found, view: 'actions' });
    } catch {
      Alert.alert('Media', 'Failed to fetch call media');
      setFlaggedMedia(null);
    }
  }, []);

  const playFlaggedRecording = useCallback(async () => {
    const url = pickGtelRecordingUrl(flaggedMedia?.call || null);
    if (!url) {
      Alert.alert('Recording', 'Recording not available');
      return;
    }
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Recording', 'Unable to open recording');
    }
  }, [flaggedMedia?.call]);

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
      lastActivity: formatGtelTs(getGtelLastActivityRaw(call)),
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
        | {
            user?: Record<string, unknown>[];
            users?: Record<string, unknown>[];
            items?: Record<string, unknown>[];
          }
        | undefined;
      const list =
        (Array.isArray(raw?.user) && raw.user) ||
        (Array.isArray(raw?.users) && raw.users) ||
        (Array.isArray(raw?.items) && raw.items) ||
        [];
      if (!list.length) {
        // Not in DB → prospect click-to-call (admin parity).
        setManualOpen(false);
        Alert.alert(
          'Prospect call',
          'Number not found in DB. Start call as prospect?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Call',
              onPress: () =>
                setC2cTarget({
                  phoneNumber: phone,
                  source: 'Manual',
                  isProspect: true,
                }),
            },
          ],
        );
        return;
      }
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
        value = formatGtelTs(value);
      }
      if (typeof value === 'object' && value != null) value = JSON.stringify(value);
      return [key, value == null || value === '' ? '—' : String(value)] as [string, string];
    });
  }, [canShowMobile, canShowPersonalConnect, canShowRecording, details]);

  const refresh = useCallback(() => {
    if (hideHeroActions) void loadDashboardCalls();
    else void loadServerPage();
  }, [hideHeroActions, loadDashboardCalls, loadServerPage]);

  return {
    navigation,
    sheetBottomPad,
    hideHeroActions,
    routeEmp,
    routeFrom,
    routeTo,
    canShowMobile,
    canShowC2c,
    canShowGtelDashboard,
    canShowRecording,
    shouldLockEmpCode,
    loginEmpCode,
    draft,
    setDraft,
    applied,
    page,
    setPage,
    pageSize,
    setPageSize,
    allCalls,
    total,
    statusFilter,
    setStatusFilter,
    cxQuickFilter,
    setCxQuickFilter,
    loading,
    error,
    filtersExpanded,
    setFiltersExpanded,
    dispositions,
    extensions,
    picker,
    setPicker,
    detailsOpen,
    setDetailsOpen,
    detailsLoading,
    detailsCallId,
    detailEntries,
    flaggedMedia,
    setFlaggedMedia,
    manualOpen,
    setManualOpen,
    manualPhone,
    setManualPhone,
    manualSearching,
    manualUsers,
    setManualUsers,
    manualUsersOpen,
    setManualUsersOpen,
    c2cTarget,
    setC2cTarget,
    callStartOpen,
    setCallStartOpen,
    statusCards,
    cxCounts,
    filteredSource,
    visibleRows,
    pagerTotal,
    pagerPages,
    handleSearch,
    handleReset,
    toggleStatusFilter,
    loadDashboardCalls,
    loadServerPage,
    refresh,
    openDetails,
    openFlaggedMedia,
    playFlaggedRecording,
    startC2c,
    searchManualUsers,
    openUserReport,
  };
}
