/** Add, game-launch and video-upload forms for BannersScreen. */
import React from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';
import { colors } from '../../../../theme';
import { styles } from '../BannersScreen.styles';
import {
  BANNER_CATEGORY_OPTIONS,
  BANNER_TYPE_OPTIONS,
  GAME_LAUNCH_PROVIDERS,
  MOBILE_PAGE_OPTIONS,
  MOBILE_PARAM_OPTIONS,
  VIDEO_TYPE_OPTIONS,
} from './constants';
import { ChipSelect } from './ChipSelect';
import { ModalShell } from './ModalShell';
import type { AddForm } from './helpers';

export function AddBannerForm({
  visible,
  submitting,
  form,
  message,
  onClose,
  onChange,
  onPickImage,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  form: AddForm;
  message: string;
  onClose: () => void;
  onChange: (patch: Partial<AddForm>) => void;
  onPickImage: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell visible={visible} title="Add" onClose={onClose}>
      <Text style={styles.fieldLabel}>Banner Image *</Text>
      <TouchableOpacity style={styles.pickBtn} onPress={onPickImage}>
        <Text style={styles.pickBtnText}>
          {form.fileName ? `Selected: ${form.fileName}` : 'Choose image'}
        </Text>
      </TouchableOpacity>
      <Text style={styles.fieldLabel}>Desktop Link *</Text>
      <TextInput
        style={styles.input}
        value={form.desktopLink}
        onChangeText={(v) => onChange({ desktopLink: v })}
        placeholder="https://…"
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
      />
      <Text style={styles.fieldLabel}>Game Name *</Text>
      <TextInput
        style={styles.input}
        value={form.gameName}
        onChangeText={(v) => onChange({ gameName: v })}
        placeholder="Game name"
        placeholderTextColor={colors.muted}
      />
      <Text style={styles.fieldLabel}>Mobile Page</Text>
      <ChipSelect
        options={MOBILE_PAGE_OPTIONS}
        value={form.mobilePage}
        onChange={(v) => onChange({ mobilePage: v })}
      />
      <Text style={styles.fieldLabel}>Mobile Page Options</Text>
      <ChipSelect
        options={MOBILE_PARAM_OPTIONS}
        value={form.mobileOptions}
        onChange={(v) => onChange({ mobileOptions: v })}
      />
      <Text style={styles.fieldLabel}>Select Type *</Text>
      <ChipSelect
        options={BANNER_TYPE_OPTIONS}
        value={form.type}
        onChange={(v) => onChange({ type: v })}
      />
      <Text style={styles.fieldLabel}>Category *</Text>
      <ChipSelect
        options={BANNER_CATEGORY_OPTIONS}
        value={form.category}
        onChange={(v) => onChange({ category: v })}
      />
      {form.type === 'bonusScreenBanners' ? (
        <>
          <Text style={styles.fieldLabel}>Banner Title *</Text>
          <TextInput
            style={styles.input}
            value={form.bonusTitle}
            onChangeText={(v) => onChange({ bonusTitle: v })}
            placeholder="Title"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.fieldLabel}>Banner Subtitle *</Text>
          <TextInput
            style={styles.input}
            value={form.bonusSubtitle}
            onChangeText={(v) => onChange({ bonusSubtitle: v })}
            placeholder="Subtitle"
            placeholderTextColor={colors.muted}
          />
        </>
      ) : null}
      {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        disabled={submitting}
        onPress={onSubmit}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}

export function AddGameBannerForm({
  visible,
  submitting,
  mode,
  existingGameId,
  existingGameName,
  existingProvider,
  newGameName,
  newGameId,
  newImagePath,
  newImageKey,
  newGameData,
  newType,
  newDeepLink,
  newStatus,
  message,
  onClose,
  onMode,
  onExistingGameId,
  onExistingGameName,
  onExistingProvider,
  onNewGameName,
  onNewGameId,
  onNewImagePath,
  onNewImageKey,
  onNewGameData,
  onNewType,
  onNewDeepLink,
  onNewStatus,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  mode: 'existing' | 'new';
  existingGameId: string;
  existingGameName: string;
  existingProvider: string;
  newGameName: string;
  newGameId: string;
  newImagePath: string;
  newImageKey: string;
  newGameData: string;
  newType: string;
  newDeepLink: string;
  newStatus: string;
  message: string;
  onClose: () => void;
  onMode: (v: 'existing' | 'new') => void;
  onExistingGameId: (v: string) => void;
  onExistingGameName: (v: string) => void;
  onExistingProvider: (v: string) => void;
  onNewGameName: (v: string) => void;
  onNewGameId: (v: string) => void;
  onNewImagePath: (v: string) => void;
  onNewImageKey: (v: string) => void;
  onNewGameData: (v: string) => void;
  onNewType: (v: string) => void;
  onNewDeepLink: (v: string) => void;
  onNewStatus: (v: string) => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell visible={visible} title="Add Banner" onClose={onClose}>
      <Text style={styles.fieldLabel}>Banner Type</Text>
      <ChipSelect
        options={[
          { value: 'existing', label: 'Already Exists' },
          { value: 'new', label: 'New' },
        ]}
        value={mode}
        onChange={(v) => onMode(v as 'existing' | 'new')}
      />
      {mode === 'existing' ? (
        <>
          <Text style={styles.fieldLabel}>Game ID *</Text>
          <TextInput
            style={styles.input}
            value={existingGameId}
            onChangeText={onExistingGameId}
            placeholder="Game ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Game Name *</Text>
          <TextInput
            style={styles.input}
            value={existingGameName}
            onChangeText={onExistingGameName}
            placeholder="Game name"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.fieldLabel}>Provider *</Text>
          <ChipSelect
            options={GAME_LAUNCH_PROVIDERS}
            value={existingProvider}
            onChange={onExistingProvider}
          />
        </>
      ) : (
        <>
          <Text style={styles.fieldLabel}>Game Name *</Text>
          <TextInput
            style={styles.input}
            value={newGameName}
            onChangeText={onNewGameName}
            placeholder="Game name"
            placeholderTextColor={colors.muted}
          />
          <Text style={styles.fieldLabel}>Game ID *</Text>
          <TextInput
            style={styles.input}
            value={newGameId}
            onChangeText={onNewGameId}
            placeholder="Game ID"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Image Path *</Text>
          <TextInput
            style={styles.input}
            value={newImagePath}
            onChangeText={onNewImagePath}
            placeholder="https://…"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Image Key *</Text>
          <TextInput
            style={styles.input}
            value={newImageKey}
            onChangeText={onNewImageKey}
            placeholder="Image key"
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Game Data (JSON) *</Text>
          <TextInput
            style={[styles.input, styles.multiline]}
            value={newGameData}
            onChangeText={onNewGameData}
            placeholder='{"key":"value"}'
            placeholderTextColor={colors.muted}
            multiline
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Type *</Text>
          <ChipSelect
            options={[
              { value: 'banner', label: 'Banner' },
              { value: 'game', label: 'Game' },
            ]}
            value={newType}
            onChange={onNewType}
          />
          <Text style={styles.fieldLabel}>Deep Link *</Text>
          <ChipSelect
            options={[
              { value: 'true', label: 'True' },
              { value: 'false', label: 'False' },
            ]}
            value={newDeepLink}
            onChange={onNewDeepLink}
          />
          <Text style={styles.fieldLabel}>Status *</Text>
          <ChipSelect
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            value={newStatus}
            onChange={onNewStatus}
          />
        </>
      )}
      {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        disabled={submitting}
        onPress={onSubmit}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Saving…' : 'Submit'}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}

export function UploadVideoForm({
  visible,
  submitting,
  type,
  name,
  message,
  onClose,
  onType,
  onPick,
  onSubmit,
}: {
  visible: boolean;
  submitting: boolean;
  type: string;
  name: string;
  message: string;
  onClose: () => void;
  onType: (v: string) => void;
  onPick: () => void;
  onSubmit: () => void;
}) {
  return (
    <ModalShell visible={visible} title="Upload Video" onClose={onClose}>
      <Text style={styles.fieldLabel}>Video Type *</Text>
      <ChipSelect options={VIDEO_TYPE_OPTIONS} value={type} onChange={onType} />
      <Text style={styles.fieldLabel}>Video File *</Text>
      <TouchableOpacity style={styles.pickBtn} onPress={onPick}>
        <Text style={styles.pickBtnText}>{name ? `Selected: ${name}` : 'Choose video'}</Text>
      </TouchableOpacity>
      {message ? <Text style={styles.modalMsg}>{message}</Text> : null}
      <TouchableOpacity
        style={[styles.submitBtn, submitting && styles.btnDisabled]}
        disabled={submitting}
        onPress={onSubmit}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Uploading…' : 'Submit'}</Text>
      </TouchableOpacity>
    </ModalShell>
  );
}
