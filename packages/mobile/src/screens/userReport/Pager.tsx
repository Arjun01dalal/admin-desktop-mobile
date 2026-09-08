/** Prev / Next pager shared by the User Report tabs. */
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { styles } from '../UserReportScreen.styles';

export function Pager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <View style={styles.pagerRow}>
      <TouchableOpacity
        style={[styles.pagerBtn, page <= 1 && styles.pagerBtnDisabled]}
        disabled={page <= 1}
        onPress={() => onPage(page - 1)}
      >
        <Text style={styles.pagerBtnText}>‹ Prev</Text>
      </TouchableOpacity>
      <Text style={styles.pagerText}>
        Page {page} / {totalPages}
      </Text>
      <TouchableOpacity
        style={[styles.pagerBtn, page >= totalPages && styles.pagerBtnDisabled]}
        disabled={page >= totalPages}
        onPress={() => onPage(page + 1)}
      >
        <Text style={styles.pagerBtnText}>Next ›</Text>
      </TouchableOpacity>
    </View>
  );
}
