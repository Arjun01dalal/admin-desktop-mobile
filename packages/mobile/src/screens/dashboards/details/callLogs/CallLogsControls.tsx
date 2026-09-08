import React from 'react';
import { ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { CampaignItem } from '@astro/shared/campaignList';
import { colors } from '../../../../theme';
import { COMMENT_OPTIONS, PAGE_SIZES, STATUS_OPTIONS } from './helpers';
import { styles } from '../CallLogsScreen.styles';

export type CallLogTextFilter = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboard?: 'phone-pad' | 'number-pad';
};

type SearchFiltersProps = {
  open: boolean;
  loading: boolean;
  textFilters: CallLogTextFilter[];
  selectedStatus: string;
  commentFilter: string;
  onToggle: () => void;
  onStatusChange: (status: string) => void;
  onCommentChange: (comment: string) => void;
  onClear: () => void;
  onSearch: () => void;
};

export function SearchFilters({
  open,
  loading,
  textFilters,
  selectedStatus,
  commentFilter,
  onToggle,
  onStatusChange,
  onCommentChange,
  onClear,
  onSearch,
}: SearchFiltersProps) {
  return (
    <>
      <TouchableOpacity style={styles.collapseHeader} onPress={onToggle}>
        <Text style={styles.collapseTitle}>Search Filters {open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.filterCard}>
          {textFilters.map((filter) => (
            <View key={filter.label} style={styles.filterRow}>
              <Text style={styles.filterLabel}>{filter.label}</Text>
              <TextInput
                style={styles.filterInput}
                value={filter.value}
                onChangeText={filter.onChangeText}
                placeholder={filter.label}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={filter.keyboard ?? 'default'}
              />
            </View>
          ))}

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Status</Text>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status}
                  style={[styles.chip, selectedStatus === status && styles.chipActive]}
                  onPress={() => onStatusChange(status)}
                >
                  <Text
                    style={[styles.chipText, selectedStatus === status && styles.chipTextActive]}
                  >
                    {status}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Text style={styles.chipRowLabel}>Comment</Text>
              {['All', ...COMMENT_OPTIONS].map((comment) => (
                <TouchableOpacity
                  key={comment}
                  style={[styles.chip, commentFilter === comment && styles.chipActive]}
                  onPress={() => onCommentChange(comment)}
                >
                  <Text
                    style={[styles.chipText, commentFilter === comment && styles.chipTextActive]}
                  >
                    {comment}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.clearBtn} onPress={onClear} disabled={loading}>
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.searchBtn} onPress={onSearch} disabled={loading}>
              <Text style={styles.searchBtnText}>Search</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </>
  );
}

type PageSizePickerProps = {
  pageSize: number;
  onChange: (pageSize: number) => void;
};

export function PageSizePicker({ pageSize, onChange }: PageSizePickerProps) {
  return (
    <View style={styles.chipRowSpaced}>
      <Text style={styles.chipRowLabel}>Per page</Text>
      {PAGE_SIZES.map((size) => (
        <TouchableOpacity
          key={size}
          style={[styles.chip, pageSize === size && styles.chipActive]}
          onPress={() => onChange(size)}
        >
          <Text style={[styles.chipText, pageSize === size && styles.chipTextActive]}>{size}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

type DialerControlsProps = {
  open: boolean;
  campaignId: string;
  campaignOptions: CampaignItem[];
  isCaller: boolean;
  selectedCount: number;
  pushing: boolean;
  message: string;
  onToggle: () => void;
  onCampaignSelect: (campaignId: string) => void;
  onAdd: () => void;
};

export function DialerControls({
  open,
  campaignId,
  campaignOptions,
  isCaller,
  selectedCount,
  pushing,
  message,
  onToggle,
  onCampaignSelect,
  onAdd,
}: DialerControlsProps) {
  return (
    <>
      <TouchableOpacity style={styles.collapseHeader} onPress={onToggle}>
        <Text style={styles.collapseTitle}>
          Add to Dialer{campaignId ? ` · ${campaignId}` : ''}
          {selectedCount ? ` · ${selectedCount} selected` : ''} {open ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {open ? (
        <View style={styles.filterCard}>
          <Text style={styles.filterLabel}>Campaign</Text>
          {campaignOptions.length === 0 ? (
            <Text style={styles.dialerHint}>
              {isCaller
                ? 'No campaign ID on this login. Ask admin to assign an extension / campaign.'
                : 'No campaigns available.'}
            </Text>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                {campaignOptions.map((campaign, index) => {
                  const id = campaign.id.trim();
                  return (
                    <TouchableOpacity
                      key={`camp-${index}`}
                      style={[styles.chip, campaignId === id && styles.chipActive]}
                      onPress={() => onCampaignSelect(campaignId === id ? '' : id)}
                    >
                      <Text style={[styles.chipText, campaignId === id && styles.chipTextActive]}>
                        {id}
                        {campaign.name && campaign.name !== id ? ` · ${campaign.name}` : ''}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          )}
          <Text style={styles.dialerHint}>Tick cards (☐), pick a campaign, then push.</Text>
          <TouchableOpacity
            style={[
              styles.dialerBtn,
              (pushing || !selectedCount || !campaignId) && styles.btnDisabled,
            ]}
            onPress={onAdd}
            disabled={pushing || !selectedCount || !campaignId}
          >
            <Text style={styles.searchBtnText}>
              {pushing ? 'Adding…' : `Add ${selectedCount || ''} to Dialer`}
            </Text>
          </TouchableOpacity>
          {message ? <Text style={styles.dialerMsg}>{message}</Text> : null}
        </View>
      ) : null}
    </>
  );
}
