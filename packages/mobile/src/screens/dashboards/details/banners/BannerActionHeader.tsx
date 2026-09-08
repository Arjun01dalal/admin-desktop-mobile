import React from 'react';
import { ScrollView, Text, TouchableOpacity } from 'react-native';
import { styles } from '../BannersScreen.styles';

type Props = {
  onAdd: () => void;
  onAddBanner: () => void;
  onUploadVideo: () => void;
};

export function BannerActionHeader({ onAdd, onAddBanner, onUploadVideo }: Props) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.actionRow}
      contentContainerStyle={styles.actionRowContent}
    >
      <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
        <Text style={styles.addBtnText}>Add</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtn} onPress={onAddBanner}>
        <Text style={styles.addBtnText}>Add Banner</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.addBtn} onPress={onUploadVideo}>
        <Text style={styles.addBtnText}>Upload Video</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
