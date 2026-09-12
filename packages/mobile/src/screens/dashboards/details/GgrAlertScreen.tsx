/**
 * GGR Alert — mobile port of desktop GgrAlertPage / Laxmi GgrAlert.
 * Screen orchestrates data; UI lives under ./ggrAlert/*.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import {
  formatGgrDateTime,
  normalizeGgrLogs,
  normalizeGgrRecipients,
  todayIstDate,
  unpackSubAdminOptions,
  type GgrAlertLogRow,
  type GgrAlertType,
  type GgrSubAdminOption,
} from '@astro/shared';
import { colors } from '../../../theme';
import { secureApi } from '../../../api/client';
import { getStoredUser } from '../../../lib/webShim';
import { GgrLogCard } from './ggrAlert/GgrLogCard';
import { GgrLogsFiltersPanel, type GgrAppliedFilters } from './ggrAlert/GgrLogsFiltersPanel';
import { GgrRecipientsPanel } from './ggrAlert/GgrRecipientsPanel';
import { GgrSubAdminPickerModal } from './ggrAlert/GgrSubAdminPickerModal';
import { ggrAlertStyles as styles } from './ggrAlert/styles';

export function GgrAlertScreen() {
  const [recipientsLoading, setRecipientsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [subAdminOptions, setSubAdminOptions] = useState<GgrSubAdminOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [telegramChatIds, setTelegramChatIds] = useState<number[]>([]);
  const [telegramInput, setTelegramInput] = useState('');
  const [subAdminSearch, setSubAdminSearch] = useState('');
  const [subAdminPickerOpen, setSubAdminPickerOpen] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [meta, setMeta] = useState<{ updatedBy?: string; updatedAt?: string }>({});

  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState<GgrAlertLogRow[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [startDate, setStartDate] = useState(todayIstDate);
  const [endDate, setEndDate] = useState(todayIstDate);
  const [filterUserId, setFilterUserId] = useState('');
  const [filterClient, setFilterClient] = useState('');
  const [filterType, setFilterType] = useState<GgrAlertType>('');
  const [applied, setApplied] = useState<GgrAppliedFilters>({
    startDate: todayIstDate(),
    endDate: todayIstDate(),
    userId: '',
    clientName: '',
    type: '',
  });

  const [runCheckLoading, setRunCheckLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [logsFiltersOpen, setLogsFiltersOpen] = useState(false);
  const [recipientsOpen, setRecipientsOpen] = useState(false);

  const loadSubAdmins = useCallback(async () => {
    const res = await secureApi<unknown>('users.getSubAdmins', { pageNo: 1, itemPerPage: 1000 });
    if (!res.ok) {
      Alert.alert(res.message || 'Failed to load sub-admins');
      setSubAdminOptions([]);
      return [] as GgrSubAdminOption[];
    }
    const options = unpackSubAdminOptions(res.data);
    setSubAdminOptions(options);
    return options;
  }, []);

  const applyRecipients = useCallback((config: ReturnType<typeof normalizeGgrRecipients>) => {
    setSelectedIds(config.subAdminIds);
    setTelegramChatIds(config.telegramChatIds);
    setEnabled(config.enabled);
    setMeta({
      updatedBy: config.updatedBy?.userName || config.updatedBy?.userId,
      updatedAt: config.updatedAt,
    });
  }, []);

  const loadRecipients = useCallback(async () => {
    setRecipientsLoading(true);
    try {
      const res = await secureApi<unknown>('ops.ggrAlertRecipientsGet', {});
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to load recipients');
        return;
      }
      applyRecipients(normalizeGgrRecipients(res.data));
    } finally {
      setRecipientsLoading(false);
    }
  }, [applyRecipients]);

  const loadLogs = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setLogsLoading(true);
      try {
        const filter: Record<string, string> = {};
        if (applied.userId.trim()) filter.userId = applied.userId.trim();
        if (applied.clientName.trim()) filter.clientName = applied.clientName.trim();
        if (applied.type) filter.type = applied.type;
        const payload: Record<string, unknown> = {
          pageNo: page,
          itemsPerPage: pageSize,
        };
        if (applied.startDate) payload.startDate = applied.startDate;
        if (applied.endDate) payload.endDate = applied.endDate;
        if (Object.keys(filter).length) payload.filter = filter;

        const res = await secureApi<unknown>('ops.ggrAlertLogsGetAll', payload);
        if (!res.ok) {
          if (!opts?.silent) {
            Alert.alert(res.message || 'Failed to load logs');
            setLogs([]);
          }
          return;
        }
        const parsed = normalizeGgrLogs(res.data, pageSize);
        setLogs(parsed.rows);
        setTotal(parsed.total);
        setTotalPages(Math.max(1, parsed.totalPages));
      } finally {
        if (!opts?.silent) setLogsLoading(false);
      }
    },
    [page, pageSize, applied],
  );

  const loadLogsRef = useRef(loadLogs);
  loadLogsRef.current = loadLogs;

  useEffect(() => {
    void (async () => {
      await loadSubAdmins();
      await loadRecipients();
    })();
  }, [loadSubAdmins, loadRecipients]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    const POLL_MS = 15 * 60 * 1000;
    const id = setInterval(() => {
      void loadLogsRef.current({ silent: true });
    }, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const saveRecipients = useCallback(async () => {
    const user = getStoredUser<{ _id?: string; name?: string }>();
    setSaving(true);
    try {
      const res = await secureApi('ops.ggrAlertRecipientsSet', {
        subAdminIds: selectedIds,
        telegramChatIds,
        enabled,
        updatedBy: { userId: user?._id || '', userName: user?.name || '' },
      });
      if (!res.ok) {
        Alert.alert(res.message || 'Failed to save');
        return;
      }
      Alert.alert('Success', 'Recipients saved');
      await loadRecipients();
    } finally {
      setSaving(false);
    }
  }, [enabled, loadRecipients, selectedIds, telegramChatIds]);

  const runCheck = useCallback(async () => {
    setRunCheckLoading(true);
    try {
      const res = await secureApi('ops.ggrAlertRunCheck', {});
      setLastRunAt(new Date().toISOString());
      if (!res.ok) {
        Alert.alert(res.message || 'GGR check failed');
        return;
      }
      Alert.alert('Success', 'GGR check completed');
      void loadLogs();
    } finally {
      setRunCheckLoading(false);
    }
  }, [loadLogs]);

  const addTelegram = useCallback(() => {
    const n = Number(telegramInput.trim());
    if (!Number.isFinite(n)) {
      Alert.alert('Enter a valid Telegram chat ID');
      return;
    }
    setTelegramChatIds((prev) => (prev.includes(n) ? prev : [...prev, n]));
    setTelegramInput('');
  }, [telegramInput]);

  const toggleSubAdmin = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedOptions = useMemo(
    () => subAdminOptions.filter((o) => selectedSet.has(o.id)),
    [subAdminOptions, selectedSet],
  );

  const filteredOptions = useMemo(() => {
    const q = subAdminSearch.trim().toLowerCase();
    const list = !q
      ? subAdminOptions
      : subAdminOptions.filter(
          (o) => o.label.toLowerCase().includes(q) || o.id.toLowerCase().includes(q),
        );
    return [...list].sort((a, b) => {
      const aOn = selectedSet.has(a.id) ? 0 : 1;
      const bOn = selectedSet.has(b.id) ? 0 : 1;
      if (aOn !== bOn) return aOn - bOn;
      return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
    });
  }, [subAdminOptions, subAdminSearch, selectedSet]);

  const refreshing = recipientsLoading || logsLoading;

  const keyExtractor = useCallback(
    (item: GgrAlertLogRow, index: number) => String(item._id || index),
    [],
  );

  const renderLog = useCallback(
    ({ item, index }: { item: GgrAlertLogRow; index: number }) => {
      const key = String(item._id || index);
      return (
        <GgrLogCard
          row={item}
          index={index}
          page={page}
          pageSize={pageSize}
          expanded={Boolean(expanded[key])}
          onToggleExpanded={() =>
            setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
          }
        />
      );
    },
    [expanded, page, pageSize],
  );

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>GGR Alert</Text>
            <Text style={styles.sub}>
              {lastRunAt ? `Last run ${formatGgrDateTime(lastRunAt)}` : 'Manual check when needed'}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.addBtn, runCheckLoading && styles.btnDisabled]}
            onPress={() => void runCheck()}
            disabled={runCheckLoading}
          >
            <Text style={styles.addBtnText}>{runCheckLoading ? '…' : 'Run Check'}</Text>
          </TouchableOpacity>
        </View>

        <GgrRecipientsPanel
          open={recipientsOpen}
          onToggleOpen={() => setRecipientsOpen((v) => !v)}
          enabled={enabled}
          onEnabledChange={setEnabled}
          selectedIds={selectedIds}
          selectedOptions={selectedOptions}
          telegramChatIds={telegramChatIds}
          telegramInput={telegramInput}
          onTelegramInputChange={setTelegramInput}
          onAddTelegram={addTelegram}
          onRemoveTelegram={(id) => setTelegramChatIds((prev) => prev.filter((x) => x !== id))}
          onOpenSubAdminPicker={() => {
            setSubAdminSearch('');
            setSubAdminPickerOpen(true);
          }}
          onToggleSubAdmin={toggleSubAdmin}
          onClearSubAdmins={() => setSelectedIds([])}
          meta={meta}
          loading={recipientsLoading}
          saving={saving}
          onReload={() => void loadSubAdmins().then(() => loadRecipients())}
          onSave={() => void saveRecipients()}
        />

        <GgrLogsFiltersPanel
          open={logsFiltersOpen}
          onToggleOpen={() => setLogsFiltersOpen((v) => !v)}
          total={total}
          applied={applied}
          startDate={startDate}
          endDate={endDate}
          filterUserId={filterUserId}
          filterClient={filterClient}
          filterType={filterType}
          pageSize={pageSize}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
          onUserIdChange={setFilterUserId}
          onClientChange={setFilterClient}
          onTypeChange={setFilterType}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setPage(1);
          }}
          onClear={() => {
            const today = todayIstDate();
            setStartDate(today);
            setEndDate(today);
            setFilterUserId('');
            setFilterClient('');
            setFilterType('');
            setApplied({
              startDate: today,
              endDate: today,
              userId: '',
              clientName: '',
              type: '',
            });
            setPage(1);
          }}
          onApply={() => {
            setApplied({
              startDate,
              endDate,
              userId: filterUserId.trim(),
              clientName: filterClient.trim(),
              type: filterType,
            });
            setPage(1);
            setLogsFiltersOpen(false);
          }}
        />

        {logsLoading && logs.length === 0 ? (
          <Text style={styles.listHint}>Loading logs…</Text>
        ) : null}
        {!logsLoading && logs.length === 0 ? (
          <Text style={styles.listHint}>No GGR alerts found</Text>
        ) : null}
        {logs.length > 0 ? <View style={{ height: 12 }} /> : null}
      </View>
    ),
    [
      addTelegram,
      applied,
      enabled,
      endDate,
      filterClient,
      filterType,
      filterUserId,
      lastRunAt,
      loadRecipients,
      loadSubAdmins,
      logs.length,
      logsFiltersOpen,
      logsLoading,
      meta,
      pageSize,
      recipientsLoading,
      recipientsOpen,
      runCheck,
      runCheckLoading,
      saveRecipients,
      saving,
      selectedIds,
      selectedOptions,
      startDate,
      telegramChatIds,
      telegramInput,
      toggleSubAdmin,
      total,
    ],
  );

  const listFooter = useMemo(
    () =>
      logs.length > 0 ? (
        <View style={[styles.pager, styles.listFooter]}>
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
      ) : (
        <View style={styles.listFooter} />
      ),
    [logs.length, page, totalPages],
  );

  return (
    <>
      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={logs}
        keyExtractor={keyExtractor}
        renderItem={renderLog}
        ListHeaderComponent={listHeader}
        ListFooterComponent={listFooter}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={10}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void loadSubAdmins().then(() => loadRecipients());
              void loadLogs();
            }}
            tintColor={colors.primary}
          />
        }
      />

      <GgrSubAdminPickerModal
        visible={subAdminPickerOpen}
        options={subAdminOptions}
        filteredOptions={filteredOptions}
        selectedIds={selectedIds}
        selectedSet={selectedSet}
        search={subAdminSearch}
        onSearchChange={setSubAdminSearch}
        onToggle={toggleSubAdmin}
        onClose={() => setSubAdminPickerOpen(false)}
      />
    </>
  );
}
