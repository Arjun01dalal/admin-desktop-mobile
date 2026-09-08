import React from 'react';
import { Image, Text, TextInput, TouchableOpacity } from 'react-native';
import { colors } from '../../../../theme';
import { replaceS3WithCloudfront } from '../../../../utils/cdnUrl';
import { styles } from '../BannersScreen.styles';
import { ModalShell } from './ModalShell';

type Props = {
  visible: boolean;
  name: string;
  imagePath: string;
  message: string;
  updating: boolean;
  onClose: () => void;
  onImagePathChange: (imagePath: string) => void;
  onSubmit: () => void;
};

export function BannerUpdateImageModal({
  visible,
  name,
  imagePath,
  message,
  updating,
  onClose,
  onImagePathChange,
  onSubmit,
}: Props) {
  const normalizedPath = imagePath.trim();
  const isVideo =
    normalizedPath.toLowerCase().includes('.mp4') || normalizedPath.toLowerCase().includes('video');

  return (
    <ModalShell
      visible={visible}
      title={`Update Banner Image${name ? ` — ${name}` : ''}`}
      onClose={onClose}
    >
      <Text style={styles.fieldLabel}>Image URL *</Text>
      <TextInput
        style={styles.input}
        value={imagePath}
        onChangeText={onImagePathChange}
        placeholder="https://d1abp4kt5r84bg.cloudfront.net/..."
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {normalizedPath && !isVideo ? (
        <Image
          source={{ uri: replaceS3WithCloudfront(normalizedPath) }}
          style={styles.previewImage}
          resizeMode="contain"
        />
      ) : null}
      {normalizedPath && isVideo ? (
        <Text style={styles.videoHint}>Video URL set — preview opens after save</Text>
      ) : null}
      {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, updating && styles.btnDisabled]}
        disabled={updating}
        onPress={onSubmit}
      >
        <Text style={styles.submitBtnText}>{updating ? 'Updating…' : 'Update Image'}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}
