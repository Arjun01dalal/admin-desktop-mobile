/**
 * Gtel Calls — mobile port of admin-panel-domains GtelCalls.
 * Logic: gtelCalls/useGtelCalls · UI pieces under gtelCalls/.
 */
import React, { useCallback } from 'react';
import { Text, View, type ListRenderItemInfo } from 'react-native';
import type { GtelCall } from '@astro/shared';
import { CampaignCallStartModal } from '../../../components/CampaignCallStartModal';
import { GtelClick2CallModal } from '../../../components/GtelClick2CallModal';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { GtelCallCard } from './gtelCalls/GtelCallCard';
import { GtelCallsListHeader } from './gtelCalls/GtelCallsListHeader';
import { GtelCallsModals } from './gtelCalls/GtelCallsModals';
import { useGtelCalls } from './gtelCalls/useGtelCalls';
import { styles } from './gtelCalls/styles';

export function GtelCallsScreen() {
  const g = useGtelCalls();

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<GtelCall>) => (
      <GtelCallCard
        call={item}
        index={index}
        page={g.page}
        pageSize={g.pageSize}
        canShowMobile={g.canShowMobile}
        canShowC2c={g.canShowC2c}
        canShowRecording={g.canShowRecording}
        callerDashMode={g.hideHeroActions}
        flaggedMediaLoading={
          g.flaggedMedia?.loading === true &&
          g.flaggedMedia.callId ===
            String(item.callId || (item as { call_id?: unknown }).call_id || '').trim()
        }
        onOpenReport={g.openUserReport}
        onStartC2c={g.startC2c}
        onOpenDetails={g.openDetails}
        onOpenFlaggedMedia={(c) => void g.openFlaggedMedia(c)}
      />
    ),
    [
      g.canShowC2c,
      g.canShowMobile,
      g.canShowRecording,
      g.flaggedMedia?.callId,
      g.flaggedMedia?.loading,
      g.hideHeroActions,
      g.openDetails,
      g.openFlaggedMedia,
      g.openUserReport,
      g.page,
      g.pageSize,
      g.startC2c,
    ],
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={g.visibleRows}
        keyExtractor={(call, index) => `${call.callId || call._id || index}`}
        renderItem={renderItem}
        listHeader={
          <GtelCallsListHeader
            hideHeroActions={g.hideHeroActions}
            routeEmp={g.routeEmp}
            routeFrom={g.routeFrom}
            routeTo={g.routeTo}
            applied={g.applied}
            draft={g.draft}
            setDraft={g.setDraft}
            canShowGtelDashboard={g.canShowGtelDashboard}
            canShowC2c={g.canShowC2c}
            canShowMobile={g.canShowMobile}
            shouldLockEmpCode={g.shouldLockEmpCode}
            loginEmpCode={g.loginEmpCode}
            navigation={g.navigation}
            setCallStartOpen={g.setCallStartOpen}
            setManualPhone={g.setManualPhone}
            setManualUsers={g.setManualUsers}
            setManualOpen={g.setManualOpen}
            cxCounts={g.cxCounts}
            cxQuickFilter={g.cxQuickFilter}
            setCxQuickFilter={g.setCxQuickFilter}
            setPage={g.setPage}
            filteredSourceLen={g.filteredSource.length}
            allCallsLen={g.allCalls.length}
            statusFilter={g.statusFilter}
            setStatusFilter={g.setStatusFilter}
            statusCards={g.statusCards}
            toggleStatusFilter={g.toggleStatusFilter}
            total={g.total}
            filtersExpanded={g.filtersExpanded}
            setFiltersExpanded={g.setFiltersExpanded}
            loading={g.loading}
            handleSearch={g.handleSearch}
            handleReset={g.handleReset}
            pageSize={g.pageSize}
            setPageSize={(n) => {
              g.setPageSize(n);
              g.setPage(1);
            }}
            error={g.error}
            setPicker={g.setPicker}
          />
        }
        listFooter={
          <View style={styles.pager}>
            <Text
              style={[styles.pagerBtn, g.page <= 1 && styles.pagerDisabled]}
              onPress={() => g.page > 1 && g.setPage((p) => p - 1)}
            >
              ‹ Prev
            </Text>
            <Text style={styles.pagerLabel}>
              Page {g.page} / {g.pagerPages} · {g.pagerTotal.toLocaleString('en-IN')}
              {g.statusFilter ? ' shown' : ''}
            </Text>
            <Text
              style={[styles.pagerBtn, g.page >= g.pagerPages && styles.pagerDisabled]}
              onPress={() => g.page < g.pagerPages && g.setPage((p) => p + 1)}
            >
              Next ›
            </Text>
          </View>
        }
        loading={g.loading}
        emptyMessage={g.statusFilter ? 'No calls for this status' : 'No calls found'}
        refreshing={g.loading}
        onRefresh={g.refresh}
      />

      <GtelCallsModals
        sheetBottomPad={g.sheetBottomPad}
        canShowMobile={g.canShowMobile}
        picker={g.picker}
        setPicker={g.setPicker}
        draft={g.draft}
        setDraft={g.setDraft}
        extensions={g.extensions}
        dispositions={g.dispositions}
        detailsOpen={g.detailsOpen}
        setDetailsOpen={g.setDetailsOpen}
        detailsCallId={g.detailsCallId}
        detailsLoading={g.detailsLoading}
        detailEntries={g.detailEntries}
        flaggedMedia={g.flaggedMedia}
        setFlaggedMedia={g.setFlaggedMedia}
        playFlaggedRecording={() => void g.playFlaggedRecording()}
        manualOpen={g.manualOpen}
        setManualOpen={g.setManualOpen}
        manualPhone={g.manualPhone}
        setManualPhone={g.setManualPhone}
        manualSearching={g.manualSearching}
        searchManualUsers={() => void g.searchManualUsers()}
        manualUsersOpen={g.manualUsersOpen}
        setManualUsersOpen={g.setManualUsersOpen}
        manualUsers={g.manualUsers}
        setC2cTarget={g.setC2cTarget}
      />

      <CampaignCallStartModal
        open={g.callStartOpen}
        onClose={() => g.setCallStartOpen(false)}
        canShowMobile={g.canShowMobile}
      />
      <GtelClick2CallModal
        target={g.c2cTarget}
        onClose={() => g.setC2cTarget(null)}
        onEnded={() => void g.refresh()}
        canShowMobile={g.canShowMobile}
      />
    </>
  );
}
