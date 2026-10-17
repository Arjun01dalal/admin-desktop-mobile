/** Customer row card for C2C campaign detail. */
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import {
  c2cCustomerStatusTone,
  formatC2cAssignedLabel,
  type C2cCampaignCustomer,
} from '@astro/shared';

import { StatusPill, type StatusPillTone } from '../../../../components/StatusPill';
import { maskMobile } from '../../../../utils/display';
import { styles } from './styles';

function customerTone(status?: string): StatusPillTone {
  const t = c2cCustomerStatusTone(status);
  return t === 'muted' ? 'muted' : t;
}

type Props = {
  item: C2cCampaignCustomer;
  canShowMobile: boolean;
  canShowC2c: boolean;
  onCall: (row: C2cCampaignCustomer) => void;
};

export const C2cCustomerCard = memo(function C2cCustomerCard({
  item,
  canShowMobile,
  canShowC2c,
  onCall,
}: Props) {
  const phone = String(item.mobile || item.phone || '');
  return (
    <View style={styles.customerCard}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.name || '—'}
        </Text>
        {item.status ? <StatusPill label={item.status} tone={customerTone(item.status)} /> : null}
      </View>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {maskMobile(phone, canShowMobile)}
        {item.appName ? ` · ${item.appName}` : ''}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        {formatC2cAssignedLabel(item.assignedTo) || 'Unassigned'}
        {item.userId ? ` · ${item.userId}` : ''}
      </Text>
      {canShowC2c && phone ? (
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => onCall(item)}>
            <Text style={styles.actionBtnText}>Call</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </View>
  );
});
