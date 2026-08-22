import React, { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import type { GameImageUpdateTarget } from '@astro/shared/updateGameImage';
import { colors, radius, spacing } from '../../../theme';
import { replaceS3WithCloudfront } from '../../../utils/cdnUrl';

type Props = {
  visible: boolean;
  loading: boolean;
  target: GameImageUpdateTarget | null;
  onClose: () => void;
  onSubmit: (imagePath: string) => void;
};

export function UpdateGameImageModal({
  visible,
  loading,
  target,
  onClose,
  onSubmit,
}: Props) {
  const [imagePath, setImagePath] = useState('');
  const trimmed = imagePath.trim();

  useEffect(() => {
    if (visible) setImagePath(target?.currentImageUrl || '');
  }, [visible, target?.currentImageUrl]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => !loading && onClose()}>
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

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: spacing(4),
    paddingBottom: spacing(6),
    paddingTop: spacing(2),
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing(3),
  },
  title: { color: colors.foreground, fontSize: 18, fontWeight: '800' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(3), marginTop: spacing(3) },
  metaBlock: { minWidth: '28%', flex: 1 },
  metaLabel: { color: colors.muted, fontSize: 11, fontWeight: '600' },
  metaValue: { color: colors.foreground, fontSize: 13, fontWeight: '700', marginTop: 2 },
  fieldLabel: { color: colors.muted, fontSize: 12, fontWeight: '600', marginTop: spacing(4) },
  input: {
    marginTop: spacing(1.5),
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.foreground,
    fontSize: 14,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2.5),
  },
  previewRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(3) },
  previewBlock: { flex: 1, minWidth: 0 },
  previewLabel: { color: colors.muted, fontSize: 11, fontWeight: '600', marginBottom: spacing(1) },
  previewImage: {
    width: '100%',
    height: 110,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewEmpty: { color: colors.muted, fontSize: 12, paddingVertical: spacing(4) },
  actions: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(4) },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.foreground, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    backgroundColor: '#ff9f0a',
    borderRadius: radius.md,
    paddingVertical: spacing(2.5),
    alignItems: 'center',
  },
  saveBtnText: { color: '#1a1200', fontWeight: '700' },
  btnDisabled: { opacity: 0.55 },
});
