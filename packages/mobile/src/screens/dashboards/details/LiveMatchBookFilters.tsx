import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  gameFilterOptions,
  tournamentFilterOptions,
  type FinalBookFilterOption,
  type FinalBookFilters,
  type FinalBookSortBy,
} from '@astro/shared';
import { makeStyles } from '../../../styles/common';
import { colors, radius, spacing } from '../../../theme';

type Props = {
  filters: FinalBookFilters;
  sportName: string;
  tournamentName: string;
  gameName: string;
  sortBy: '' | FinalBookSortBy;
  onSportName: (sportName: string) => void;
  onTournament: (sportName: string, tournamentName: string) => void;
  onGame: (sportName: string, tournamentName: string, gameName: string) => void;
  onSortBy: (sortBy: '' | FinalBookSortBy) => void;
};

type PickerKind = 'sport' | 'tournament' | 'game';

export function LiveMatchBookFilters({
  filters,
  sportName,
  tournamentName,
  gameName,
  sortBy,
  onSportName,
  onTournament,
  onGame,
  onSortBy,
}: Props) {
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const tournaments = tournamentFilterOptions(filters, sportName);
  const games = gameFilterOptions(filters, sportName, tournamentName);

  const options: FinalBookFilterOption[] =
    picker === 'sport'
      ? filters.sports.map((sport) => ({
          value: sport,
          label: sport,
          sportName: sport,
          tournamentName: '',
          gameName: '',
        }))
      : picker === 'tournament'
        ? tournaments
        : picker === 'game'
          ? games
          : [];

  const title =
    picker === 'sport' ? 'Sport' : picker === 'tournament' ? 'Tournament' : 'Game';

  const choose = (option: FinalBookFilterOption | null) => {
    if (picker === 'sport') onSportName(option?.sportName || '');
    if (picker === 'tournament') {
      onTournament(option?.sportName || '', option?.tournamentName || '');
    }
    if (picker === 'game') {
      onGame(option?.sportName || '', option?.tournamentName || '', option?.gameName || '');
    }
    setPicker(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <FilterField
          label="Sport"
          value={sportName || 'All sports'}
          onPress={() => setPicker('sport')}
        />
        <FilterField
          label="Tournament"
          value={tournamentName || 'All tournaments'}
          onPress={() => setPicker('tournament')}
        />
      </View>
      <FilterField
        label="Game"
        value={gameName || 'All games'}
        onPress={() => setPicker('game')}
      />
      <View style={styles.sortRow}>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === '' && styles.sortBtnActive]}
          onPress={() => onSortBy('')}
        >
          <Text style={[styles.sortText, sortBy === '' && styles.sortTextActive]}>A–Z</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortBtn, sortBy === 'betVolume' && styles.sortBtnActive]}
          onPress={() => onSortBy('betVolume')}
        >
          <Text style={[styles.sortText, sortBy === 'betVolume' && styles.sortTextActive]}>
            Bet volume
          </Text>
        </TouchableOpacity>
      </View>

      <Modal visible={picker != null} transparent animationType="fade" onRequestClose={() => setPicker(null)}>
        <View style={styles.backdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setPicker(null)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <ScrollView style={styles.sheetList}>
              <TouchableOpacity style={styles.option} onPress={() => choose(null)}>
                <Text style={styles.optionText}>All</Text>
              </TouchableOpacity>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={styles.option}
                  onPress={() => choose(option)}
                >
                  <Text style={styles.optionText}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FilterField({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.field} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue} numberOfLines={1}>
        {value}
      </Text>
    </TouchableOpacity>
  );
}

const styles = makeStyles({
  wrap: { gap: spacing(2), marginBottom: spacing(2) },
  row: { flexDirection: 'row', gap: spacing(2) },
  field: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  fieldLabel: { color: colors.muted, fontSize: 11, marginBottom: 2 },
  fieldValue: { color: colors.foreground, fontSize: 14, fontWeight: '600' },
  sortRow: { flexDirection: 'row', gap: spacing(2) },
  sortBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing(3),
    paddingVertical: spacing(2),
  },
  sortBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  sortText: { color: colors.foreground, fontWeight: '700', fontSize: 13 },
  sortTextActive: { color: colors.primaryForeground },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  sheet: {
    maxHeight: '70%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing(4),
  },
  sheetTitle: {
    color: colors.foreground,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: spacing(2),
  },
  sheetList: { maxHeight: 420 },
  option: {
    paddingVertical: spacing(3),
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionText: { color: colors.foreground, fontSize: 15 },
});
