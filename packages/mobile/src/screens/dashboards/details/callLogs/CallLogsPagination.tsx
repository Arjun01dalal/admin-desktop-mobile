import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../CallLogsScreen.styles';

type CallLogsPaginationProps = {
  page: number;
  total: number;
  totalPages: number;
  onPrevious: () => void;
  onNext: () => void;
};

export function CallLogsPagination({
  page,
  total,
  totalPages,
  onPrevious,
  onNext,
}: CallLogsPaginationProps) {
  return (
    <View style={styles.pagerRow}>
      <TouchableOpacity
        style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
        onPress={onPrevious}
        disabled={page <= 1}
      >
        <Text style={styles.pagerBtnText}>‹ Prev</Text>
      </TouchableOpacity>
      <Text style={styles.pagerInfo}>
        {total > 0 ? `${total.toLocaleString()} calls · page ${page} of ${totalPages}` : 'No calls'}
      </Text>
      <TouchableOpacity
        style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
        onPress={onNext}
        disabled={page >= totalPages}
      >
        <Text style={styles.pagerBtnText}>Next ›</Text>
      </TouchableOpacity>
    </View>
  );
}
