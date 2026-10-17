import React from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import type { C2cCampaign } from '@astro/shared';

import { styles } from './styles';

type Props = {
  campaign: C2cCampaign | null;
  visible: boolean;
  onClose: () => void;
};

export function C2cCallersListModal({ campaign, visible, onClose }: Props) {
  const callers = campaign?.callers ?? [];
  const count = callers.length;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            Callers · {campaign?.campaignName || 'Campaign'}
          </Text>
          <Text style={styles.modalBody}>
            {count
              ? `${count} caller${count === 1 ? '' : 's'} assigned`
              : 'No callers assigned to this campaign'}
          </Text>
          <ScrollView>
            {callers.map((c, index) => (
              <View key={c._id || `${c.name}-${index}`} style={styles.callersListRow}>
                <Text style={styles.callersListName} numberOfLines={1}>
                  {String(c.name || 'Caller').trim() || 'Caller'}
                </Text>
                {c.empCode ? (
                  <Text style={styles.callersListMeta} numberOfLines={1}>
                    Emp code: {c.empCode}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
          <View style={styles.modalActionsCol}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnPrimary]}
              onPress={onClose}
            >
              <Text style={styles.modalBtnPrimaryText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
