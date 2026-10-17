/** List header: hero, CX summary, status cards, filters. */
import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import {
  GTEL_STATUS_FILTER_CARDS,
  GTEL_VERTICAL_LABELS,
  type GtelFilters,
  type GtelStatusFilter,
} from '@astro/shared';

import { type CxQuickFilter, GTEL_PAGE_SIZE_OPTIONS, gtelStatusCardTone } from './format';
import { DetailFilterBar } from '../DetailFilterBar';
import { colors } from '../../../../theme';
import { styles } from './styles';

type StatusCard = { key: Exclude<GtelStatusFilter, ''>; label: string; value: number };

type Props = {
  hideHeroActions: boolean;
  routeEmp: string;
  routeFrom: string;
  routeTo: string;
  applied: GtelFilters;
  draft: GtelFilters;
  setDraft: React.Dispatch<React.SetStateAction<GtelFilters>>;
  canShowGtelDashboard: boolean;
  canShowC2c: boolean;
  canShowMobile: boolean;
  shouldLockEmpCode: boolean;
  loginEmpCode: string;
  navigation: { navigate: (n: string, p?: object) => void; getParent?: () => { navigate: (n: string, p?: object) => void } | undefined };
  setCallStartOpen: (v: boolean) => void;
  setManualPhone: (v: string) => void;
  setManualUsers: (v: Record<string, unknown>[]) => void;
  setManualOpen: (v: boolean) => void;
  cxCounts: { E: number; C: number; S: number; flagged: number } | null;
  cxQuickFilter: CxQuickFilter;
  setCxQuickFilter: React.Dispatch<React.SetStateAction<CxQuickFilter>>;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  filteredSourceLen: number;
  allCallsLen: number;
  statusFilter: GtelStatusFilter;
  setStatusFilter: React.Dispatch<React.SetStateAction<GtelStatusFilter>>;
  statusCards: StatusCard[];
  toggleStatusFilter: (key: Exclude<GtelStatusFilter, ''>) => void;
  total: number;
  filtersExpanded: boolean;
  setFiltersExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  loading: boolean;
  handleSearch: () => void;
  handleReset: () => void;
  pageSize: number;
  setPageSize: (n: number) => void;
  error: string | null;
  setPicker: (v: null | 'extension' | 'disposition') => void;
};

export function GtelCallsListHeader(p: Props) {
  const {
    hideHeroActions, routeEmp, routeFrom, routeTo, applied, draft, setDraft,
    canShowGtelDashboard, canShowC2c, canShowMobile, shouldLockEmpCode, loginEmpCode,
    navigation, setCallStartOpen, setManualPhone, setManualUsers, setManualOpen,
    cxCounts, cxQuickFilter, setCxQuickFilter, setPage, filteredSourceLen, allCallsLen,
    statusFilter, setStatusFilter, statusCards, toggleStatusFilter, total,
    filtersExpanded, setFiltersExpanded, loading, handleSearch, handleReset,
    pageSize, setPageSize, error, setPicker,
  } = p;

  return (
    <>
      <View style={styles.heroRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {hideHeroActions
              ? `Caller Calls${routeEmp ? ` · ${routeEmp}` : ''}`
              : 'Gtel Calls'}
          </Text>
          <Text style={styles.sub}>
            {hideHeroActions
              ? `${routeFrom || applied.from || '—'} → ${routeTo || applied.to || '—'}`
              : 'Search dialer call history by date, extension, phone number, or disposition.'}
          </Text>
        </View>
        {!hideHeroActions && (canShowGtelDashboard || canShowC2c) ? (
          <View style={styles.heroActions}>
            {canShowGtelDashboard ? (
              <TouchableOpacity
                style={styles.dashboardBtn}
                onPress={() => {
                  const from = applied.from || draft.from;
                  const to = applied.to || draft.to;
                  const code = shouldLockEmpCode
                    ? loginEmpCode
                    : applied.empCode || draft.empCode;
                  const params: Record<string, string> = {};
                  if (from) params.from = from;
                  if (to) params.to = to;
                  if (code) params.empCode = code;
                  const parent = (
                    navigation as {
                      getParent?: () => { navigate: (n: string, p?: object) => void };
                    }
                  ).getParent?.();
                  if (parent) parent.navigate('/gtel-caller-dashboard', params);
                  else navigation.navigate('/gtel-caller-dashboard', params);
                }}
              >
                <Text style={styles.dashboardBtnText}>Dashboard</Text>
              </TouchableOpacity>
            ) : null}
            {canShowC2c ? (
              <>
                <TouchableOpacity
                  style={styles.manualCallBtn}
                  onPress={() => setCallStartOpen(true)}
                >
                  <Text style={styles.manualCallBtnText}>Call Start</Text>
                </TouchableOpacity>
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
              </>
            ) : null}
          </View>
        ) : null}
      </View>

      {hideHeroActions && cxCounts ? (
        <View style={styles.cxSummaryWrap}>
          <Text style={styles.cxSummaryLabel}>CX Summary</Text>
          <View style={styles.cxChipRow}>
            {(['E', 'C', 'S'] as const).map((vert) => {
              const active = cxQuickFilter === vert;
              return (
                <TouchableOpacity
                  key={vert}
                  style={[styles.cxChip, active && styles.cxChipActive]}
                  onPress={() => {
                    setCxQuickFilter((prev) => (prev === vert ? 'all' : vert));
                    setPage(1);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cxChipText, active && styles.cxChipTextActive]}>
                    {GTEL_VERTICAL_LABELS[vert]}
                  </Text>
                  <Text style={[styles.cxChipCount, active && styles.cxChipTextActive]}>
                    {cxCounts[vert].toLocaleString('en-IN')}
                  </Text>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity
              style={[styles.cxChip, styles.cxChipFlagged, cxQuickFilter === 'flagged' && styles.cxChipActive]}
              onPress={() => {
                setCxQuickFilter((prev) => (prev === 'flagged' ? 'all' : 'flagged'));
                setPage(1);
              }}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.cxChipText,
                  styles.cxChipFlaggedText,
                  cxQuickFilter === 'flagged' && styles.cxChipTextActive,
                ]}
              >
                Flagged words
              </Text>
              <Text
                style={[
                  styles.cxChipCount,
                  styles.cxChipFlaggedText,
                  cxQuickFilter === 'flagged' && styles.cxChipTextActive,
                ]}
              >
                {cxCounts.flagged.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.filterHint}>
            Showing: {filteredSourceLen.toLocaleString('en-IN')}
            {filteredSourceLen !== allCallsLen
              ? ` / ${allCallsLen.toLocaleString('en-IN')}`
              : ''}
          </Text>
        </View>
      ) : null}

      <View style={styles.statsRow}>
        <TouchableOpacity
          style={[styles.stat, !statusFilter && styles.statActive]}
          onPress={() => {
            if (!statusFilter) return;
            setStatusFilter('');
            setPage(1);
          }}
          activeOpacity={0.75}
        >
          <Text style={styles.statLabel}>Total</Text>
          <Text style={styles.statValue}>
            {(hideHeroActions ? allCallsLen : total).toLocaleString('en-IN')}
          </Text>
        </TouchableOpacity>
        {statusCards.map((card) => {
          const tone = gtelStatusCardTone(card.key);
          const active = statusFilter === card.key;
          return (
            <TouchableOpacity
              key={card.key}
              style={[
                styles.stat,
                {
                  backgroundColor: tone.bg,
                  borderColor: active ? tone.accent : tone.border,
                },
                active && styles.statActive,
              ]}
              onPress={() => toggleStatusFilter(card.key)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={[styles.statAccent, { backgroundColor: tone.accent }]} />
              <Text style={styles.statLabel}>{card.label}</Text>
              <Text style={[styles.statValue, { color: tone.value }]}>
                {card.value.toLocaleString('en-IN')}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {statusFilter ? (
        <Text style={styles.filterHint}>
          Showing {GTEL_STATUS_FILTER_CARDS.find((c) => c.key === statusFilter)?.label} · tap
          again to clear
        </Text>
      ) : null}

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
}

