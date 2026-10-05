import React, { useState } from 'react';
import { Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  gameFilterOptions,
  tournamentFilterOptions,
  type FinalBookFilterOption,
  type FinalBookFilters,
  type FinalBookSortBy,
} from '@astro/shared';
import { styles } from './LiveMatchBookFilters.styles';

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

