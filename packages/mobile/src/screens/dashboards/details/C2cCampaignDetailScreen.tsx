import React, { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View, type ListRenderItemInfo } from 'react-native';

import { useNavigation, useRoute } from '@react-navigation/native';
import {
  canShowGtelC2c,
  formatC2cCallerChipLabel,
  formatC2cCreatorLabel,
  type C2cCampaignCustomer,
} from '@astro/shared';

import { CampaignCallStartModal } from '../../../components/CampaignCallStartModal';
import { useC2cCampaignDetail } from './c2cCampaign/useC2cCampaignDetail';
import { C2cCampaignFormModal } from './c2cCampaign/C2cCampaignFormModal';
import { getSessionUser, hasPermission } from '../../../auth/permissions';
import { ScreenFlatList } from '../../../dashboards/ui/ScreenFlatList';
import { C2cCustomerCard } from './c2cCampaign/C2cCustomerCard';
import { formatC2cCreatedStamp } from './c2cCampaign/format';
import { StatStrip } from '../../../components/StatStrip';
import { colors, spacing } from '../../../theme';
import {
  GtelClick2CallModal,
  type GtelC2cTarget,
} from '../../../components/GtelClick2CallModal';
import { styles } from './c2cCampaign/styles';


export function C2cCampaignDetailScreen() {
  const navigation = useNavigation();
  const params = (useRoute().params ?? {}) as {
    campaignId?: string;
    campaignName?: string;
  };
  const campaignId = String(params.campaignId || '').trim();

  const admin = useMemo(() => getSessionUser(), []);
  const canShowMobile = hasPermission('show_mobile', admin);
  const canShowC2c = canShowGtelC2c(admin);

  const detail = useC2cCampaignDetail(campaignId);
  const [callStartOpen, setCallStartOpen] = useState(false);
  const [c2cTarget, setC2cTarget] = useState<GtelC2cTarget | null>(null);

  const title = detail.selected?.campaignName || params.campaignName || 'Campaign';
  useLayoutEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const callCustomer = useCallback((row: C2cCampaignCustomer) => {
    const phone = String(row.mobile || row.phone || '');
    if (!phone) return;
    setC2cTarget({
      phoneNumber: phone,
      userId: row.userId || row.dp_id,
      userName: row.name,
      appName: row.appName,
      lastActivity: row.lastActivity,
      campaignDataId: row._id,
      source: 'Campaign',
    });
  }, []);

  const renderCustomer = useCallback(
    ({ item }: ListRenderItemInfo<C2cCampaignCustomer>) => (
      <C2cCustomerCard
        item={item}
        canShowMobile={canShowMobile}
        canShowC2c={canShowC2c}
        onCall={callCustomer}
      />
    ),
    [canShowC2c, canShowMobile, callCustomer],
  );

  if (!campaignId) {
    return (
      <View style={[styles.screen, styles.content]}>
        <Text style={styles.errorText}>Missing campaign id</Text>
      </View>
    );
  }

  const createdStamp = detail.selected
    ? formatC2cCreatedStamp(detail.selected.createdAt)
    : '';

  return (
    <>
      <ScreenFlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={detail.customers}
        keyExtractor={(row, i) => row._id || String(i)}
        renderItem={renderCustomer}
        loading={detail.detailLoading || detail.customersLoading}
        emptyMessage="No customers in this campaign"
        refreshing={detail.customersLoading}
        onRefresh={() => void detail.loadCustomers()}
        listHeader={
          <>
            <View style={styles.detailHeader}>
              <View style={styles.heroRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.sub}>
                    {detail.selected?.isActive ? 'Active' : 'Inactive'} ·{' '}
                    {detail.customerTotal} customers
                  </Text>
                  {detail.selected ? (
                    <Text style={styles.sub}>
                      Created by {formatC2cCreatorLabel(detail.selected)}
                      {createdStamp ? ` · ${createdStamp}` : ''}
                    </Text>
                  ) : null}
                </View>
                {canShowC2c ? (
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => setCallStartOpen(true)}
                  >
                    <Text style={styles.primaryBtnText}>Call Start</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {detail.selected ? (
                <StatStrip
                  style={{ marginTop: spacing(2) }}
                  items={[
                    { key: 't', label: 'Total', value: detail.selected.data.total },
                    { key: 'p', label: 'Pending', value: detail.selected.data.pending },
                    { key: 'a', label: 'Assigned', value: detail.selected.data.assigned },
                    { key: 'd', label: 'Done', value: detail.selected.data.completed },
                  ]}
                />
              ) : null}
              {detail.selected ? (
                <View style={styles.callersBar}>
                  <Text style={styles.fieldLabel}>Callers</Text>
                  <View style={styles.chipRow}>
                    {detail.selected.callers.length ? (
                      detail.selected.callers.map((c, index) => (
                        <View key={c._id || `${c.name}-${index}`} style={styles.callerChip}>
                          <Text style={styles.callerChipText} numberOfLines={1}>
                            {formatC2cCallerChipLabel(c)}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.cardMeta}>No callers</Text>
                    )}
                  </View>
                </View>
              ) : null}
              <View style={styles.cardActions}>
                <TouchableOpacity
                  style={[styles.actionBtn, styles.actionBtnGhost]}
                  onPress={detail.openEdit}
                  disabled={!detail.selected}
                >
                  <Text style={styles.actionBtnGhostText}>Edit</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterBox}>
              <Text style={styles.fieldLabel}>Search customers</Text>
              <TextInput
                style={styles.textInput}
                value={detail.customerSearch}
                onChangeText={detail.setCustomerSearch}
                placeholder="Name / mobile / user id"
                placeholderTextColor={colors.muted}
              />
              <Text style={styles.fieldLabel}>Status</Text>
              <View style={styles.chipRow}>
                {(
                  [
                    ['', 'All'],
                    ['pending', 'Pending'],
                    ['assigned', 'Assigned'],
                    ['completed', 'Done'],
                  ] as const
                ).map(([value, label]) => (
                  <TouchableOpacity
                    key={value || 'all'}
                    style={[styles.chip, detail.customerStatus === value && styles.chipActive]}
                    onPress={() => detail.setCustomerStatus(value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        detail.customerStatus === value && styles.chipTextActive,
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
                  onPress={detail.applyCustomerFilters}
                >
                  <Text style={styles.formBtnPrimaryText}>Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          </>
        }
        listFooter={
          <View style={styles.pager}>
            <Text
              style={[styles.pagerBtn, detail.customerPage <= 1 && styles.pagerDisabled]}
              onPress={() =>
                detail.customerPage > 1 && detail.setCustomerPage((p) => p - 1)
              }
            >
              ‹ Prev
            </Text>
            <Text style={styles.pagerLabel}>
              Page {detail.customerPage} / {detail.customerTotalPages}
            </Text>
            <Text
              style={[
                styles.pagerBtn,
                detail.customerPage >= detail.customerTotalPages && styles.pagerDisabled,
              ]}
              onPress={() =>
                detail.customerPage < detail.customerTotalPages &&
                detail.setCustomerPage((p) => p + 1)
              }
            >
              Next ›
            </Text>
          </View>
        }
      />

      <CampaignCallStartModal
        open={callStartOpen}
        onClose={() => setCallStartOpen(false)}
        canShowMobile={canShowMobile}
      />
      <GtelClick2CallModal
        target={c2cTarget}
        canShowMobile={canShowMobile}
        onClose={() => setC2cTarget(null)}
        onEnded={() => {
          setC2cTarget(null);
          void detail.loadCustomers();
        }}
      />

      <C2cCampaignFormModal
        visible={detail.formOpen}
        title="Edit campaign"
        submitLabel="Save"
        values={detail.formValues}
        callers={detail.callers}
        saving={detail.saving}
        onChange={detail.setFormValues}
        onClose={() => detail.setFormOpen(false)}
        onSubmit={() => void detail.saveEdit()}
      />
    </>
  );
}
