/**
 * Banners List — port of desktop BannersPage / Laxmi Banner Games.
 * Header actions (Add_Banner permission): Add, Add Banner, Upload Video.
 */
import React from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { colors } from '../../../theme';
import { UpdateGameImageModal } from './UpdateGameImageModal';
import { BannerActionHeader } from './banners/BannerActionHeader';
import { BannerDetailSheet } from './banners/BannerDetailSheet';
import { AddBannerForm, AddGameBannerForm, UploadVideoForm } from './banners/BannerForms';
import { BannerList } from './banners/BannerList';
import { BannerPositionModal } from './banners/BannerPositionModal';
import { BannerUpdateImageModal } from './banners/BannerUpdateImageModal';
import { display } from './banners/helpers';
import { useBannersScreen } from './banners/useBannersScreen';
import { styles } from './BannersScreen.styles';

export function BannersScreen() {
  const banners = useBannersScreen();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={banners.loading}
          onRefresh={() => void banners.load()}
          tintColor={colors.primary}
        />
      }
    >
      <Text style={styles.title}>Banners List</Text>
      <Text style={styles.sub}>Total: {banners.rows.length.toLocaleString('en-IN')}</Text>

      {banners.canAdd ? (
        <BannerActionHeader
          onAdd={banners.openAdd}
          onAddBanner={banners.openLaunch}
          onUploadVideo={banners.openVideo}
        />
      ) : null}

      {banners.error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{banners.error}</Text>
        </View>
      ) : null}

      {banners.loading && banners.rows.length === 0 ? (
        <Text style={styles.hint}>Loading…</Text>
      ) : null}
      {!banners.loading && banners.rows.length === 0 ? (
        <Text style={styles.hint}>No banners found</Text>
      ) : null}

      <BannerList rows={banners.rows} onSelect={banners.setSheetRow} />

      <BannerDetailSheet
        row={banners.sheetRow}
        columns={banners.columns}
        actions={banners.sheetActions}
        onClose={() => banners.setSheetRow(null)}
      />

      <BannerPositionModal
        visible={banners.positionRow !== null}
        title={`Set position${
          banners.positionRow ? ` — ${display(banners.positionRow.gameName)}` : ''
        }`}
        position={banners.positionDraft}
        message={banners.positionMsg}
        saving={banners.savingPosition}
        onClose={() => banners.setPositionRow(null)}
        onPositionChange={banners.setPositionDraft}
        onSave={() => void banners.submitPosition()}
      />

      <BannerUpdateImageModal
        visible={banners.updateImageOpen}
        name={banners.updateImageName}
        imagePath={banners.updateImagePath}
        message={banners.updateImageMsg}
        updating={banners.updatingImage}
        onClose={banners.closeUpdateImage}
        onImagePathChange={banners.setUpdateImagePath}
        onSubmit={() => void banners.submitUpdateImage()}
      />

      <UpdateGameImageModal
        visible={banners.gameImageTarget !== null}
        loading={banners.gameImageSaving}
        target={banners.gameImageTarget}
        onClose={() => !banners.gameImageSaving && banners.setGameImageTarget(null)}
        onSubmit={(path) => void banners.handleGameImageUpdate(path)}
      />

      <AddBannerForm
        visible={banners.addOpen}
        submitting={banners.submitting}
        form={banners.addForm}
        message={banners.addMsg}
        onClose={banners.closeAdd}
        onChange={banners.updateAddForm}
        onPickImage={() => void banners.pickBannerImage()}
        onSubmit={() => void banners.submitAdd()}
      />

      <AddGameBannerForm
        visible={banners.launchOpen}
        submitting={banners.submitting}
        mode={banners.launchMode}
        existingGameId={banners.existingGameId}
        existingGameName={banners.existingGameName}
        existingProvider={banners.existingProvider}
        newGameName={banners.newGameName}
        newGameId={banners.newGameId}
        newImagePath={banners.newImagePath}
        newImageKey={banners.newImageKey}
        newGameData={banners.newGameData}
        newType={banners.newType}
        newDeepLink={banners.newDeepLink}
        newStatus={banners.newStatus}
        message={banners.launchMsg}
        onClose={banners.closeLaunch}
        onMode={banners.setLaunchMode}
        onExistingGameId={banners.setExistingGameId}
        onExistingGameName={banners.setExistingGameName}
        onExistingProvider={banners.setExistingProvider}
        onNewGameName={banners.setNewGameName}
        onNewGameId={banners.setNewGameId}
        onNewImagePath={banners.setNewImagePath}
        onNewImageKey={banners.setNewImageKey}
        onNewGameData={banners.setNewGameData}
        onNewType={banners.setNewType}
        onNewDeepLink={banners.setNewDeepLink}
        onNewStatus={banners.setNewStatus}
        onSubmit={() => void banners.submitLaunch()}
      />

      <UploadVideoForm
        visible={banners.videoOpen}
        submitting={banners.submitting}
        type={banners.videoType}
        name={banners.videoName}
        message={banners.videoMsg}
        onClose={banners.closeVideo}
        onType={banners.setVideoType}
        onPick={() => void banners.pickVideo()}
        onSubmit={() => void banners.submitVideo()}
      />
    </ScrollView>
  );
}
