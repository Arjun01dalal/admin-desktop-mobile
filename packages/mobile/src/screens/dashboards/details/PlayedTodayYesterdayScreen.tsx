/**
 * Played today / yesterday — mobile port of admin-panel-domains PlayedTodayYesterday
 * + desktop PlayedTodayYesterdayPage. Uses dashboard.playedTodayYesterday.
 */
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  BREAKDOWN_COUNTS,
  COUNT_BY_TYPE,
  DEFAULT_PLAYED_PAGE_SIZE,
  INDIA_STATES,
  PLAYED_PAGE_SIZE_OPTIONS,
  PLAY_FILTERS,
  PLAY_SUMMARY_META,
  PLAY_TYPE_LABELS,
  appCodeForName,
  buildPlayedTodayYesterdayPayload,
  canShowGtelC2c,
  emptyPlaySummary,
  isPlayType,
  normalizePlayedTodayYesterday,
  rowDisplayName,
  rowMobile,
  rowUserId,
  type PlaySummary,
  type PlayType,
} from '@astro/shared';
import { colors } from '../../../theme';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { secureApi } from '../../../api/client';
import { hasPermission } from '../../../auth/permissions';
import { getStoredUser } from '../../../lib/webShim';
import { formatDisplayDate, formatDisplayTime, todayIST } from '../../../utils/dates';
import { display, maskMobile } from '../../../utils/display';
import { AddToC2cCampaignPanel } from '../../../components/AddToC2cCampaignPanel';
import {
  GtelClick2CallModal,
  type GtelC2cTarget,
} from '../../../components/GtelClick2CallModal';
import { DetailFilterBar } from './DetailFilterBar';
import { RowDetailSheet, type SheetAction, type SheetField } from './RowDetailSheet';
import { styles } from './PlayedTodayYesterdayScreen.styles';

type Row = Record<string, unknown>;

/** Date/boolean shaping on top of shared display (keeps prior cell formatting). */
function formatCell(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    return `${formatDisplayDate(value)} ${formatDisplayTime(value)}`;
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split('-');
    return `${d}-${m}-${y}`;
  }
  return display(value);
}

type AppliedFilters = {
  date: string;
  empCode: string;
  clientName: string;
  userState: string[];
};

export function PlayedTodayYesterdayScreen() {
  const navigation = useNavigation<{ navigate: (route: string, params?: object) => void }>();
  const params = (useRoute().params ?? {}) as { type?: string; date?: string };
  const initialType: PlayType = isPlayType(params.type) ? params.type : 'today_not_yesterday';
  const initialDate = typeof params.date === 'string' && params.date ? params.date : todayIST();

  const canShowMobile = hasPermission('show_mobile');
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const canShowC2c = canShowGtelC2c(admin);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);

  const [type, setType] = useState<PlayType>(initialType);
  const [draftDate, setDraftDate] = useState(initialDate);
  const [draftEmpCode, setDraftEmpCode] = useState('');
  const [draftClientName, setDraftClientName] = useState('');
  const [draftStates, setDraftStates] = useState<string[]>([]);
  const [applied, setApplied] = useState<AppliedFilters>({
    date: initialDate,
    empCode: '',
    clientName: '',
    userState: [],
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PLAYED_PAGE_SIZE);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState<PlaySummary>(emptyPlaySummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Row | null>(null);
  const [statePickerOpen, setStatePickerOpen] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const genRef = useRef(0);

  useEffect(() => {
    if (isPlayType(params.type) && params.type !== type) {
      setType(params.type);
      setPage(1);
    }
    if (typeof params.date === 'string' && params.date && params.date !== applied.date) {
      setDraftDate(params.date);
      setApplied((prev) => ({ ...prev, date: params.date as string }));
      setPage(1);
    }
    // Intentionally sync from route params only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.type, params.date]);

  const openUserReport = useCallback(
    (userId?: string, userName?: string) => {
      if (!userId) return;
      navigation.navigate('/user-report', {
        userId: String(userId),
        userName: String(userName || ''),
      });
    },
    [navigation],
  );

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await secureApi(
        'dashboard.playedTodayYesterday',
        buildPlayedTodayYesterdayPayload({
          type,
          pageNo: page,
          itemsPerPage: pageSize,
          date: applied.date || undefined,
          empCode: applied.empCode,
          clientName: applied.clientName,
          state: applied.userState,
        }),
      );
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to fetch played users');
        setRows([]);
        setTotal(0);
        setTotalPages(1);
        setSummary(emptyPlaySummary());
        return;
      }
      const parsed = normalizePlayedTodayYesterday(res.data, pageSize);
      setRows(parsed.rows);
      setTotal(parsed.total);
      setTotalPages(parsed.totalPages);
      setSummary(parsed.summary);
      setSelected(null);
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [applied, page, pageSize, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSearch = useCallback(() => {
    setPage(1);
    setApplied({
      date: draftDate,
      empCode: draftEmpCode.trim(),
      clientName: draftClientName,
      userState: [...draftStates],
    });
  }, [draftClientName, draftDate, draftEmpCode, draftStates]);

  const clearDate = useCallback(() => {
    setDraftDate('');
    setPage(1);
    setApplied((prev) => ({ ...prev, date: '' }));
  }, []);

  const sheetFields = useCallback(
    (r: Row): SheetField[] => [
      { label: 'Dp Id', value: formatCell(rowUserId(r)) },
      { label: 'Name', value: formatCell(rowDisplayName(r)) },
      { label: 'Mobile', value: maskMobile(rowMobile(r), canShowMobile) },
      { label: 'App', value: appCodeForName(String(r.clientName ?? '')) },
      { label: 'Emp Code', value: formatCell(r.empCode) },
      { label: 'State', value: formatCell(r.state) },
      { label: 'City', value: formatCell(r.city) },
      { label: 'Last Activity', value: formatCell(r.activeUser) },
      { label: 'Second Last Active', value: formatCell(r.secondLastActiveDate) },
      { label: 'Created On', value: formatCell(r.createdOn) },
    ],
    [canShowMobile],
  );

  const sheetActions = useMemo<SheetAction[] | undefined>(() => {
    if (!selected) return undefined;
    const id = rowUserId(selected);
    if (!id) return undefined;
    return [
      {
        label: 'User Report',
        tone: 'primary',
        onPress: () => {
          const name = rowDisplayName(selected);
          setSelected(null);
          openUserReport(id, name);
        },
      },
    ];
  }, [openUserReport, selected]);

  const title = PLAY_TYPE_LABELS[type];

  const keyExtractor = useCallback((row: Row, index: number) => {
    const id = rowUserId(row);
    const mobile = rowMobile(row);
    const rowKey = id || mobile || String(index);
    return `played-${index}-${rowKey}`;
  }, []);

  const renderItem = useCallback(
    ({ item: row, index }: ListRenderItemInfo<Row>) => (
      <PlayedTodayYesterdayCard
        row={row}
        index={index}
        page={page}
        pageSize={pageSize}
        canShowMobile={!!canShowMobile}
        canShowC2c={canShowC2c}
        onOpenSheet={() => setSelected(row)}
        onOpenReport={(id, name) => openUserReport(id, name)}
        onC2cCall={(target) => setC2cTarget(target)}
      />
    ),
    [page, pageSize, canShowMobile, canShowC2c, openUserReport],
  );

  const listHeader = (
    <>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.sub}>Total: {total.toLocaleString('en-IN')}</Text>

      <View style={styles.typeRow}>
        {PLAY_FILTERS.map(({ type: value, label }) => {
          const active = type === value;
          const count = summary[COUNT_BY_TYPE[value]];
          return (
            <TouchableOpacity
              key={value}
              style={[styles.typeChip, active && styles.typeChipActive]}
              onPress={() => {
                if (value === type) return;
                setType(value);
                setPage(1);
              }}
              activeOpacity={0.75}
            >
              <Text style={[styles.typeChipLabel, active && styles.typeChipLabelActive]}>
                {label}
              </Text>
              <Text style={styles.typeChipValue}>
                {count != null && count !== '' ? Number(count).toLocaleString('en-IN') : '—'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.breakdownRow}>
        {BREAKDOWN_COUNTS.map(({ key, label }) => (
          <View key={key} style={styles.breakdownChip}>
            <Text style={styles.breakdownLabel}>{label}</Text>
            <Text style={styles.breakdownValue}>
              {summary[key] != null && summary[key] !== ''
                ? Number(summary[key]).toLocaleString('en-IN')
                : '—'}
            </Text>
          </View>
        ))}
        <View style={[styles.breakdownChip, styles.breakdownChipAccent]}>
          <Text style={styles.breakdownLabel}>Total</Text>
          <Text style={styles.breakdownValue}>{total.toLocaleString('en-IN')}</Text>
        </View>
      </View>

      <View style={styles.metaRow}>
        {PLAY_SUMMARY_META.map(({ key, label }) => (
          <View key={key} style={styles.metaChip}>
            <Text style={styles.metaText}>
              {label}: <Text style={styles.metaBold}>{formatCell(summary[key])}</Text>
            </Text>
          </View>
        ))}
      </View>

      <DetailFilterBar
        collapsible
        filtersExpanded={filtersExpanded}
        onToggleFilters={() => setFiltersExpanded((open) => !open)}
        startDate={draftDate}
        endDate={draftDate}
        loading={loading}
        onStartDateChange={setDraftDate}
        onEndDateChange={setDraftDate}
        onApply={handleSearch}
        onClearDates={clearDate}
        appClientName={draftClientName}
        onAppChange={setDraftClientName}
        pageSize={pageSize}
        pageSizeOptions={PLAYED_PAGE_SIZE_OPTIONS}
        onPageSizeChange={(n) => {
          setPageSize(n);
          setPage(1);
        }}
      >
        <Text style={styles.fieldLabel}>Employee Code</Text>
        <TextInput
          style={styles.textInput}
          value={draftEmpCode}
          onChangeText={setDraftEmpCode}
          placeholder="Employee Code"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />

        <Text style={styles.fieldLabel}>State</Text>
        <TouchableOpacity style={styles.selectBtn} onPress={() => setStatePickerOpen(true)}>
          <Text style={styles.selectBtnText} numberOfLines={1}>
            {draftStates.length ? draftStates.join(', ') : 'All'}
          </Text>
        </TouchableOpacity>

        <AddToC2cCampaignPanel userIds={rows.map((r) => rowUserId(r)).filter(Boolean)} />
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
        Page {page} / {totalPages}
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
    <View style={styles.screen}>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={rows}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        listHeader={listHeader}
        listFooter={listFooter}
        loading={loading}
        emptyMessage="No users found"
        refreshing={loading}
        onRefresh={() => void load()}
        refreshEnabled={!statePickerOpen}
      />

      <RowDetailSheet
        visible={selected !== null}
        title={selected ? formatCell(rowDisplayName(selected)) : ''}
        fields={selected ? sheetFields(selected) : []}
        onClose={() => setSelected(null)}
        actions={sheetActions}
      />

      <Modal
        visible={statePickerOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setStatePickerOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setStatePickerOpen(false)}
        >
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select States</Text>
            <ScrollView>
              {INDIA_STATES.map((name) => {
                const checked = draftStates.includes(name);
                return (
                  <TouchableOpacity
                    key={name}
                    style={styles.modalOption}
                    onPress={() =>
                      setDraftStates((prev) =>
                        checked ? prev.filter((s) => s !== name) : [...prev, name],
                      )
                    }
                  >
                    <View style={[styles.modalCheck, checked && styles.modalCheckOn]}>
                      {checked ? <Text style={styles.modalCheckMark}>✓</Text> : null}
                    </View>
                    <Text style={styles.modalOptionText}>{name}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.modalDone}
              onPress={() => setStatePickerOpen(false)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <GtelClick2CallModal
        target={c2cTarget}
        onClose={() => setC2cTarget(null)}
        canShowMobile={!!canShowMobile}
      />
    </View>
  );
}

type PlayedTodayYesterdayCardProps = {
  row: Row;
  index: number;
  page: number;
  pageSize: number;
  canShowMobile: boolean;
  canShowC2c: boolean;
  onOpenSheet: () => void;
  onOpenReport: (id: string, name: string) => void;
  onC2cCall: (target: GtelC2cTarget) => void;
};

const PlayedTodayYesterdayCard = memo(function PlayedTodayYesterdayCard({
  row,
  index,
  page,
  pageSize,
  canShowMobile,
  canShowC2c,
  onOpenSheet,
  onOpenReport,
  onC2cCall,
}: PlayedTodayYesterdayCardProps) {
  const id = rowUserId(row);
  const name = rowDisplayName(row);
  const mobile = rowMobile(row);
  return (
    <TouchableOpacity style={styles.card} activeOpacity={0.75} onPress={onOpenSheet}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardIndex}>#{(page - 1) * pageSize + index + 1}</Text>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {formatCell(name)}
        </Text>
        {id ? (
          <TouchableOpacity
            style={styles.reportBtn}
            onPress={() => onOpenReport(id, name)}
            hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          >
            <Text style={styles.reportBtnText}>User Report</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Dp Id</Text>
        <Text style={styles.cardValue} numberOfLines={1} selectable>
          {formatCell(id)}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Mobile</Text>
        <View style={{ flex: 1, alignItems: 'flex-end' }}>
          <Text style={styles.cardValue}>{maskMobile(mobile, canShowMobile)}</Text>
          {canShowC2c && mobile ? (
            <TouchableOpacity
              style={styles.c2cBtn}
              onPress={() =>
                onC2cCall({
                  phoneNumber: String(mobile),
                  userId: id,
                  userName: name,
                  appName: String(row.clientName || row.appName || ''),
                  lastActivity: String(row.activeUser || ''),
                  source: 'Manual',
                })
              }
            >
              <Text style={styles.c2cBtnText}>C2C CALL</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>App</Text>
        <Text style={styles.cardValue}>{appCodeForName(String(row.clientName ?? ''))}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>State</Text>
        <Text style={styles.cardValue}>{formatCell(row.state)}</Text>
      </View>
      <View style={styles.cardRow}>
        <Text style={styles.cardLabel}>Last Activity</Text>
        <Text style={styles.cardValue}>{formatCell(row.activeUser)}</Text>
      </View>
    </TouchableOpacity>
  );
});
