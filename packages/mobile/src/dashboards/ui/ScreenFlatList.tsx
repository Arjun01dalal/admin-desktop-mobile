/**
 * Shared virtualized list root for report/detail screens.
 * Use as the screen scroll container — do not wrap in ScrollView.
 */
import React from 'react';
import {
  FlatList,
  Platform,
  RefreshControl,
  Text,
  type FlatListProps,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors } from '../../theme';

type Props<T> = {
  data: readonly T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: ListRenderItem<T>;
  listHeader?: React.ReactElement | null;
  listFooter?: React.ReactElement | null;
  loading?: boolean;
  emptyMessage?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  keyboardShouldPersistTaps?: FlatListProps<T>['keyboardShouldPersistTaps'];
  ListEmptyComponent?: React.ReactElement | null;
  extraData?: unknown;
};

export function ScreenFlatList<T>({
  data,
  keyExtractor,
  renderItem,
  listHeader,
  listFooter,
  loading,
  emptyMessage = 'No data',
  refreshing,
  onRefresh,
  refreshEnabled = true,
  style,
  contentContainerStyle,
  onEndReached,
  onEndReachedThreshold,
  keyboardShouldPersistTaps = 'handled',
  ListEmptyComponent,
  extraData,
}: Props<T>) {
  return (
    <FlatList
      data={data as T[]}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      extraData={extraData}
      ListHeaderComponent={listHeader ?? undefined}
      ListFooterComponent={listFooter ?? undefined}
      ListEmptyComponent={
        ListEmptyComponent ?? (
          <Text style={{ color: colors.muted, textAlign: 'center', marginVertical: 24 }}>
            {loading ? 'Loading…' : emptyMessage}
          </Text>
        )
      }
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            enabled={refreshEnabled}
          />
        ) : undefined
      }
      style={style}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      windowSize={7}
      maxToRenderPerBatch={8}
      initialNumToRender={10}
      updateCellsBatchingPeriod={50}
      removeClippedSubviews={Platform.OS === 'android'}
      onEndReached={onEndReached}
      onEndReachedThreshold={onEndReachedThreshold}
    />
  );
}
