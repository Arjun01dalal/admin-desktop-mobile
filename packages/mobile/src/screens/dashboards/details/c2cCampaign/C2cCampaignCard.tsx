/** Campaign row card for C2C list. */
import React, { memo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { formatC2cCreatorLabel, type C2cCampaign } from '@astro/shared';
import { spacing } from '../../../../theme';
import { StatStrip } from '../../../../components/StatStrip';
import { StatusPill } from '../../../../components/StatusPill';
import { C2cCallersListModal } from './C2cCallersListModal';
import { formatC2cCreatedStamp } from './format';
import { styles } from './styles';

type Props = {
  item: C2cCampaign;
  onOpen: (item: C2cCampaign) => void;
  onDuplicate: (item: C2cCampaign) => void;
};

export const C2cCampaignCard = memo(function C2cCampaignCard({
  item,
  onOpen,
  onDuplicate,
}: Props) {
  const [callersOpen, setCallersOpen] = useState(false);
  const stats = item.data;
  const createdStamp = formatC2cCreatedStamp(item.createdAt);
  const callerCount = item.callers.length;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {item.campaignName || '—'}
        </Text>
        <StatusPill
          label={item.isActive ? 'Active' : 'Inactive'}
          tone={item.isActive ? 'answer' : 'muted'}
        />
      </View>
      <Text style={styles.cardMeta} numberOfLines={2}>
        Created by {formatC2cCreatorLabel(item)}
        {createdStamp ? ` · ${createdStamp}` : ''}
      </Text>
      <Text style={styles.cardMeta} numberOfLines={1}>
        Callers: {callerCount}
      </Text>
      <StatStrip
        style={{ marginTop: spacing(2) }}
        items={[
          { key: 't', label: 'Total', value: stats.total },
          { key: 'p', label: 'Pending', value: stats.pending },
          { key: 'a', label: 'Assigned', value: stats.assigned },
          { key: 'd', label: 'Done', value: stats.completed },
        ]}
      />
      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onOpen(item)}>
          <Text style={styles.actionBtnText}>Open</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGhost]}
          onPress={() => setCallersOpen(true)}
        >
          <Text style={styles.actionBtnGhostText}>
            Callers{callerCount ? ` (${callerCount})` : ''}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnGhost]}
          onPress={() => onDuplicate(item)}
        >
          <Text style={styles.actionBtnGhostText}>Duplicate</Text>
        </TouchableOpacity>
      </View>

      <C2cCallersListModal
        campaign={item}
        visible={callersOpen}
        onClose={() => setCallersOpen(false)}
      />
    </View>
  );
});
