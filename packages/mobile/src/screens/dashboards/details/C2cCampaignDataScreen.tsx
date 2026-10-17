/**
 * C2C Campaign Data — list screen.
 * Open pushes `/c2c-campaign-detail` on the root stack (native header back).
 */
import React, { useCallback, useRef } from 'react';
import { Text, TextInput, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { C2cCampaign } from '@astro/shared';
import { colors } from '../../../theme';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { C2cCampaignCard } from './c2cCampaign/C2cCampaignCard';
import { C2cCampaignFormModal } from './c2cCampaign/C2cCampaignFormModal';
import { C2cDuplicateModals } from './c2cCampaign/C2cDuplicateModals';
import { useC2cCampaignList } from './c2cCampaign/useC2cCampaignList';
import { styles } from './c2cCampaign/styles';

export function C2cCampaignDataScreen() {
  const navigation = useNavigation<{
    navigate: (name: string, params?: { campaignId: string; campaignName?: string }) => void;
  }>();
  const list = useC2cCampaignList();
  const skipFocusReload = useRef(true);

  // Refresh after returning from detail (skip first mount — hook already loads).
  useFocusEffect(
    useCallback(() => {
      if (skipFocusReload.current) {
        skipFocusReload.current = false;
        return;
      }
      void list.loadCampaigns();
    }, [list.loadCampaigns]),
  );

  const openCampaign = useCallback(
    (item: C2cCampaign) => {
      const params = {
        campaignId: item._id,
        campaignName: item.campaignName,
      };
      const parent = (
        navigation as unknown as {
          getParent?: () => { navigate: (n: string, p?: object) => void } | undefined;
        }
      ).getParent?.();
      if (parent) parent.navigate('/c2c-campaign-detail', params);
      else navigation.navigate('/c2c-campaign-detail', params);
    },
    [navigation],
  );

  const renderCampaign = useCallback(
    ({ item }: ListRenderItemInfo<C2cCampaign>) => (
      <C2cCampaignCard
        item={item}
        onOpen={openCampaign}
        onDuplicate={list.openDuplicate}
      />
    ),
    [list.openDuplicate, openCampaign],
  );

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={list.campaigns}
        keyExtractor={(row, i) => row._id || String(i)}
        renderItem={renderCampaign}
        loading={list.loading}
        emptyMessage="No campaigns found"
        refreshing={list.loading}
        onRefresh={() => void list.loadCampaigns()}
        listHeader={
          <>
            <View style={styles.heroRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>C2C Campaign Data</Text>
                <Text style={styles.sub}>
                  {list.total.toLocaleString('en-IN')} campaigns · manage callers & leads
                </Text>
              </View>
              <TouchableOpacity style={styles.primaryBtn} onPress={list.openCreate}>
                <Text style={styles.primaryBtnText}>Create</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.filterBox}>
              <Text style={styles.fieldLabel}>Search</Text>
              <TextInput
                style={styles.textInput}
                value={list.searchInput}
                onChangeText={list.setSearchInput}
                placeholder="Campaign name"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['', 'All'],
                    ['true', 'Active'],
                    ['false', 'Inactive'],
                  ] as const
                ).map(([value, label]) => (
                  <TouchableOpacity
                    key={value || 'all'}
                    style={[styles.chip, list.activeFilter === value && styles.chipActive]}
                    onPress={() => list.setActiveFilter(value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        list.activeFilter === value && styles.chipTextActive,
                      ]}
                    >
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.filterActions}>
                <TouchableOpacity
                  style={[styles.formBtn, styles.formBtnPrimary]}
                  onPress={list.applyFilters}
                >
                  <Text style={styles.formBtnPrimaryText}>Search</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.formBtn, styles.formBtnGhost]}
                  onPress={list.clearFilters}
                >
                  <Text style={styles.formBtnGhostText}>Clear</Text>
                </TouchableOpacity>
              </View>
            </View>

            {list.error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{list.error}</Text>
              </View>
            ) : null}
          </>
        }
        listFooter={
          <View style={styles.pager}>
            <Text
              style={[styles.pagerBtn, list.page <= 1 && styles.pagerDisabled]}
              onPress={() => list.page > 1 && list.setPage((p) => p - 1)}
            >
              ‹ Prev
            </Text>
            <Text style={styles.pagerLabel}>
              Page {list.page} / {list.totalPages} · {list.total.toLocaleString('en-IN')}
            </Text>
            <Text
              style={[styles.pagerBtn, list.page >= list.totalPages && styles.pagerDisabled]}
              onPress={() => list.page < list.totalPages && list.setPage((p) => p + 1)}
            >
              Next ›
            </Text>
          </View>
        }
      />

      <C2cCampaignFormModal
        visible={list.formOpen}
        title="Create campaign"
        submitLabel="Save"
        values={list.formValues}
        callers={list.callers}
        saving={list.saving}
        onChange={list.setFormValues}
        onClose={() => list.setFormOpen(false)}
        onSubmit={() => void list.saveCreate()}
      />

      <C2cDuplicateModals
        choiceOpen={list.duplicateChoiceOpen}
        formOpen={list.duplicateFormOpen}
        source={list.duplicateSource}
        duplicating={list.duplicating}
        formValues={list.dupFormValues}
        callers={list.callers}
        onClose={list.closeDuplicateFlow}
        onKeepSame={() => void list.runDuplicate()}
        onChangeDetails={list.openDuplicateForm}
        onFormChange={list.setDupFormValues}
        onSubmitForm={() => void list.submitDuplicateForm()}
      />
    </>
  );
}
