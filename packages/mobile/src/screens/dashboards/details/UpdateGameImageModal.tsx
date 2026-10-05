import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { GameImageUpdateTarget } from '@astro/shared/updateGameImage';
import { colors } from '../../../theme';
import { replaceS3WithCloudfront } from '../../../utils/cdnUrl';
import { styles } from './UpdateGameImageModal.styles';

type Props = {
  visible: boolean;
  loading: boolean;
  target: GameImageUpdateTarget | null;
  onClose: () => void;
  onSubmit: (imagePath: string) => void;
};

export function UpdateGameImageModal({ visible, loading, target, onClose, onSubmit }: Props) {
  const [imagePath, setImagePath] = useState('');
  const trimmed = imagePath.trim();

  useEffect(() => {
    if (visible) setImagePath(target?.currentImageUrl || '');
  }, [visible, target?.currentImageUrl]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={() => !loading && onClose()}
    >
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={() => !loading && onClose()}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Update Game Image</Text>

          <View style={styles.metaRow}>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Game</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {target?.name || '—'}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Game ID</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {target?.gameId || '—'}
              </Text>
            </View>
            <View style={styles.metaBlock}>
              <Text style={styles.metaLabel}>Provider</Text>
              <Text style={styles.metaValue} numberOfLines={1}>
                {target?.provider || '—'}
              </Text>
            </View>
          </View>

          <Text style={styles.fieldLabel}>Image URL</Text>
          <TextInput
            style={styles.input}
            value={imagePath}
            onChangeText={setImagePath}
            placeholder="https://d1abp4kt5r84bg.cloudfront.net/snake&ladder"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!loading}
          />

          <View style={styles.previewRow}>
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>Current</Text>
              {target?.currentImageUrl ? (
                <Image
                  source={{ uri: replaceS3WithCloudfront(target.currentImageUrl) }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.previewEmpty}>No image</Text>
              )}
            </View>
            <View style={styles.previewBlock}>
              <Text style={styles.previewLabel}>New preview</Text>
              {trimmed ? (
                <Image
                  source={{ uri: replaceS3WithCloudfront(trimmed) }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <Text style={styles.previewEmpty}>Enter URL</Text>
              )}
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.cancelBtn} disabled={loading} onPress={onClose}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!trimmed || loading) && styles.btnDisabled]}
              disabled={!trimmed || loading}
              onPress={() => onSubmit(trimmed)}
            >
              <Text style={styles.saveBtnText}>{loading ? 'Saving…' : 'Submit'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

