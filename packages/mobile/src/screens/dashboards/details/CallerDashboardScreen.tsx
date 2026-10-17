import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useNavigation, useRoute } from '@react-navigation/native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  CALLER_ROLE_IDS,
  EMPCODE_LIST_FILTER_ROLE_ID,
  buildGtelCallerHeadIndex,
  filterGtelCallerDashRowsForHead,
  gtelCallerDashStatTone,
  gtelCallerHeadMatchNames,
  buildGtelTotalsCardsFromCallers,
  isGtelCallerHeadDashboardRole,
  mergeGtelTotalsCards,
  normalizeGtelCallerDashboard,
  type GtelCallerDashCard,
  type GtelCallerDashRow,
  type GtelCallerDashTone,
} from '@astro/shared';
import { hasPermission, isCallerRole } from '../../../auth/permissions';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { styles, TONE_STYLES } from './CallerDashboardScreen.styles';
import { CallerDashboardCharts } from './CallerDashboardCharts';
import { PlaceholderScreen } from '../../PlaceholderScreen';
import { getStoredUser } from '../../../lib/webShim';
import { DetailFilterBar } from './DetailFilterBar';
import { colors, spacing } from '../../../theme';
import { todayIST } from '../../../utils/dates';
import { secureApi } from '../../../api/client';



function ToneCard({
  label,
  value,
  tone,
  compact,
}: {
  label: string;
  value: string;
  tone: GtelCallerDashTone;
  compact?: boolean;
}) {
  const palette = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <View
      style={[
        compact ? styles.metric : styles.stat,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <View style={[compact ? styles.metricAccent : styles.statAccent, { backgroundColor: palette.accent }]} />
      <Text style={compact ? styles.metricLabel : styles.statLabel}>{label}</Text>
      <Text
        style={[
          compact ? styles.metricValue : styles.statValue,
          { color: palette.valueColor },
          !compact && tone === 'time' ? { fontSize: 14 } : null,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

type CallerCardProps = {
  item: GtelCallerDashRow;
  onOpenDisposition: (row: GtelCallerDashRow) => void;
  onOpenCalls: (row: GtelCallerDashRow) => void;
};

function isFlaggedMetric(key: string): boolean {
  const field = key.includes(':') ? key.split(':')[1] : key;
  const n = field.toLowerCase().replace(/[^a-z0-9]/g, '');
  return n === 'flagged' || n === 'flaggedcount';
}

const CallerCard = memo(function CallerCard({
  item,
  onOpenDisposition,
  onOpenCalls,
}: CallerCardProps) {
  const flaggedMetric = item.metrics.find((m) => isFlaggedMetric(m.key));
  const otherMetrics = item.metrics.filter((m) => !isFlaggedMetric(m.key));

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderMain}>
          <View style={styles.nameRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={styles.totalBesideName}>
              <Text style={styles.totalBesideLabel}>Total</Text>
              <Text style={styles.totalBesideValue}>{item.total}</Text>
            </View>
            {flaggedMetric ? (
              <View style={styles.flaggedBesideName}>
                <Text style={styles.flaggedBesideLabel}>Flagged words</Text>
                <Text style={styles.flaggedBesideValue}>{flaggedMetric.value}</Text>
              </View>
            ) : null}
          </View>
          {item.empCode ? <Text style={styles.cardEmp}>{item.empCode}</Text> : null}
          {item.talkTime && item.talkTime !== '—' ? (
            <Text style={styles.talkMeta}>Talk Time · {item.talkTime}</Text>
          ) : null}
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => onOpenDisposition(item)}
            accessibilityRole="button"
            accessibilityLabel="Show by disposition"
          >
            <MaterialIcons name="format-list-bulleted" size={18} color={colors.foreground} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.openCallsBtn}
            onPress={() => onOpenCalls(item)}
            accessibilityRole="button"
            accessibilityLabel="Open caller calls"
          >
            <Text style={styles.openCallsBtnText}>Calls</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.metricsRow}>
        <ToneCard
          label="Answered"
          value={item.answered}
          tone={gtelCallerDashStatTone('answered')}
          compact
        />
        {otherMetrics.map((m) => (
          <ToneCard key={m.key} label={m.label} value={m.value} tone={m.tone} compact />
        ))}
      </View>
    </View>
  );
});

export function CallerDashboardScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: object) => void;
    goBack?: () => void;
  }>();
  const params = (useRoute().params ?? {}) as Record<string, unknown>;
  const insets = useSafeAreaInsets();
  const admin = useMemo(() => getStoredUser<Record<string, unknown>>(), []);
  const canAccess = hasPermission('show_gtel_dashboard', admin);
  const loginEmpCode = String(admin?.empCode || '').trim();
  const loginUserId = String(admin?._id || '').trim();
  const roleId = String(admin?.Role_ID || '');
  const isCallerNew = roleId === EMPCODE_LIST_FILTER_ROLE_ID;
  const isCaller = CALLER_ROLE_IDS.has(roleId) || isCallerRole(admin);
  /** CALLER_HEAD roles only see callers assigned to them in Caller Allotment. */
  const restrictToAssignedCallers = isGtelCallerHeadDashboardRole(roleId);
  /** Match admin CallerDashboardPage — lock callers to their own empCode. */
  const lockEmpCode = (isCaller || isCallerNew) && Boolean(loginEmpCode);

  const initialFrom = typeof params.from === 'string' && params.from ? params.from : todayIST();
  const initialTo = typeof params.to === 'string' && params.to ? params.to : todayIST();
  const initialEmp =
    lockEmpCode && loginEmpCode
      ? loginEmpCode
      : typeof params.empCode === 'string'
        ? params.empCode
        : '';

  const [draftFrom, setDraftFrom] = useState(initialFrom);
  const [draftTo, setDraftTo] = useState(initialTo);
  const [draftEmp, setDraftEmp] = useState(initialEmp);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [empCode, setEmpCode] = useState(initialEmp);
  const [cards, setCards] = useState<GtelCallerDashCard[]>([]);
  const [callers, setCallers] = useState<GtelCallerDashRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [dispRow, setDispRow] = useState<GtelCallerDashRow | null>(null);
  const genRef = useRef(0);

  useEffect(() => {
    if (!lockEmpCode || !loginEmpCode) return;
    setDraftEmp(loginEmpCode);
    setEmpCode(loginEmpCode);
  }, [lockEmpCode, loginEmpCode]);

  const load = useCallback(async () => {
    const gen = ++genRef.current;
    setLoading(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {};
      if (from.trim()) payload.from = from.trim();
      if (to.trim()) payload.to = to.trim();
      const code = lockEmpCode ? loginEmpCode : empCode.trim();
      if (code) payload.empCode = code;

      const dashPromise = secureApi('gtel.callerDashboard', payload);
      const allotPromise = restrictToAssignedCallers
        ? secureApi('ops.callerAllotmentSubadmins', { filter: {} })
        : Promise.resolve(null);

      const [res, allotRes] = await Promise.all([dashPromise, allotPromise]);
      if (gen !== genRef.current) return;
      if (!res.ok) {
        setError(res.message || 'Failed to load caller dashboard');
        setCards([]);
        setCallers([]);
        return;
      }
      const parsed = normalizeGtelCallerDashboard(res.data);
      let nextCallers = parsed.callers;

      if (restrictToAssignedCallers) {
        if (!allotRes?.ok) {
          setError(allotRes?.message || 'Failed to load caller allotment');
          setCards([]);
          setCallers([]);
          return;
        }
        const byRole =
          allotRes.data && typeof allotRes.data === 'object'
            ? (allotRes.data as { byRole?: unknown }).byRole
            : null;
        const index = buildGtelCallerHeadIndex(byRole);
        const loginNames = [
          admin?.name,
          admin?.realName,
          admin?.chatName,
        ].map((n) => String(n || '').trim());
        const matchNames = gtelCallerHeadMatchNames(byRole, {
          roleId,
          userId: loginUserId,
          empCode: loginEmpCode,
          loginNames,
        });
        nextCallers = filterGtelCallerDashRowsForHead(parsed.callers, index, matchNames);
      }

      // CALLER_HEAD → recount from assigned rows; otherwise fill any Totals
      // the API envelope dropped (mobile decrypt often loses the totals block).
      const nextCards = restrictToAssignedCallers
        ? buildGtelTotalsCardsFromCallers(nextCallers)
        : mergeGtelTotalsCards(parsed.cards, nextCallers);

      setCards(nextCards);
      setCallers(nextCallers);
      if (!nextCards.length && !nextCallers.length) {
        setError(
          restrictToAssignedCallers
            ? 'No assigned callers for this head.'
            : 'No dashboard data for selected filters.',
        );
      }
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, [
    admin,
    empCode,
    from,
    lockEmpCode,
    loginEmpCode,
    loginUserId,
    restrictToAssignedCallers,
    roleId,
    to,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleApply = useCallback(() => {
    setFrom(draftFrom);
    setTo(draftTo);
    setEmpCode(lockEmpCode ? loginEmpCode : draftEmp);
  }, [draftEmp, draftFrom, draftTo, lockEmpCode, loginEmpCode]);

  const handleReset = useCallback(() => {
    const today = todayIST();
    setDraftFrom(today);
    setDraftTo(today);
    setDraftEmp(lockEmpCode ? loginEmpCode : '');
    setFrom(today);
    setTo(today);
    setEmpCode(lockEmpCode ? loginEmpCode : '');
  }, [lockEmpCode, loginEmpCode]);

  const openDisposition = useCallback((row: GtelCallerDashRow) => {
    const items = Object.entries(row.byDisposition || {});
    if (!items.length) {
      Alert.alert('By Disposition', 'No byDisposition data for this caller');
      return;
    }
    setDispRow(row);
  }, []);

  const openCallerCalls = useCallback(
    (row: GtelCallerDashRow) => {
      const code = String(row.empCode || '').trim();
      if (!code || code === '—') {
        Alert.alert('Calls', 'Emp code missing for this caller');
        return;
      }
      // Dedicated root-stack route (includeCalls load + Back → Dashboard).
      navigation.navigate('/gtel-caller-calls', {
        from: from.trim() || todayIST(),
        to: to.trim() || todayIST(),
        empCode: code,
        hideHeroActions: true,
      });
    },
    [from, navigation, to],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GtelCallerDashRow>) => (
      <CallerCard
        item={item}
        onOpenDisposition={openDisposition}
        onOpenCalls={openCallerCalls}
      />
    ),
    [openCallerCalls, openDisposition],
  );

  const dispItems = useMemo(() => {
    if (!dispRow) return [] as { label: string; value: number }[];
    return Object.entries(dispRow.byDisposition || {})
      .map(([label, value]) => ({ label, value: Number(value) || 0 }))
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
  }, [dispRow]);

  const listHeader = (
    <>
      <Text style={styles.title}>Caller Dashboard</Text>
      <Text style={styles.sub}>Caller-wise Gtel call metrics for the selected date range.</Text>

      {cards.length ? (
        <View style={styles.statsRow}>
          {cards.map((card) => (
            <ToneCard
              key={card.key}
              label={card.label}
              value={card.value}
              tone={card.tone || gtelCallerDashStatTone(card.key)}
            />
          ))}
        </View>
      ) : null}

      <DetailFilterBar
        collapsible
        filtersExpanded={filtersExpanded}
        onToggleFilters={() => setFiltersExpanded((o) => !o)}
        startDate={draftFrom}
        endDate={draftTo}
        loading={loading}
        onStartDateChange={setDraftFrom}
        onEndDateChange={setDraftTo}
        onApply={handleApply}
        onClearAllFilters={handleReset}
      >
        <Text style={styles.fieldLabel}>Employee Code</Text>
        <TextInput
          style={styles.textInput}
          value={draftEmp}
          onChangeText={setDraftEmp}
          editable={!lockEmpCode}
          placeholder="Emp Code"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
        />
      </DetailFilterBar>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {callers.length ? <CallerDashboardCharts rows={callers} /> : null}
    </>
  );

  if (!canAccess) {
    return <PlaceholderScreen title="You do not have permission to view this page." />;
  }

  const sheetPad = { paddingBottom: Math.max(insets.bottom, spacing(3)) };

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={callers}
        keyExtractor={(row, index) => `${row.empCode || row.name}-${index}`}
        renderItem={renderItem}
        listHeader={listHeader}
        loading={loading}
        emptyMessage="No callers found"
        refreshing={loading}
        onRefresh={() => void load()}
      />

      <Modal
        visible={dispRow != null}
        transparent
        animationType="slide"
        onRequestClose={() => setDispRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setDispRow(null)} />
          <View style={[styles.modalSheet, sheetPad]}>
            <Text style={styles.modalTitle}>By Disposition</Text>
            <Text style={styles.modalSub}>
              {dispRow?.name || 'Caller'}
              {dispRow?.empCode ? ` · ${dispRow.empCode}` : ''}
            </Text>
            <ScrollView style={{ marginTop: spacing(3) }}>
              {dispItems.length ? (
                dispItems.map((item) => (
                  <View key={item.label} style={styles.dispRow}>
                    <Text style={styles.dispLabel}>{item.label}</Text>
                    <Text style={styles.dispValue}>{item.value.toLocaleString('en-IN')}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyDisp}>No disposition breakdown</Text>
              )}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setDispRow(null)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}
