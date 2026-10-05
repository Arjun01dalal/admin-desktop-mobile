/**
 * Laxmi-style column filters for User Report history tabs.
 * Desktop puts these under table headers; on mobile they sit above the cards.
 */
import React, { useCallback, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { DateField } from '../../components/DateField';
import { colors } from '../../theme';
import { styles } from './HistoryFilterBar.styles';

/** Drop empty strings so the API only gets active Laxmi filters. */
export function filledFilters(src: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) {
    const t = v.trim();
    if (t) out[k] = t;
  }
  return out;
}

export function useHistoryFilters(initial: Record<string, string>) {
  const [draft, setDraft] = useState(initial);
  const [applied, setApplied] = useState(initial);
  const [page, setPage] = useState(1);

  const onChange = useCallback((key: string, value: string) => {
    setDraft((d) => {
      const next = { ...d, [key]: value };
      if (key === 'status' || key === 'betStatus') {
        setApplied(next);
        setPage(1);
      }
      return next;
    });
  }, []);

  const onSearch = useCallback(() => {
    setApplied({ ...draft });
    setPage(1);
  }, [draft]);

  return { draft, applied, page, setPage, onChange, onSearch };
}

export type HistoryFilterField =
  | {
      type: 'text';
      key: string;
      placeholder: string;
      keyboard?: 'default' | 'number-pad';
    }
  | { type: 'date'; key: string; placeholder: string }
  | { type: 'status'; key: string; options: { id: string; label: string }[] };

type Props = {
  fields: HistoryFilterField[];
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSearch: () => void;
};

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <View style={styles.collapseWrap}>
      <TouchableOpacity
        style={styles.collapseHeader}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.8}
      >
        <Text style={styles.collapseTitle}>{title}</Text>
        <Text style={styles.collapseChevron}>{open ? '▲' : '▼'}</Text>
      </TouchableOpacity>
      {open ? <View style={styles.collapseBody}>{children}</View> : null}
    </View>
  );
}

export function HistoryFilterBar({ fields, values, onChange, onSearch }: Props) {
  return (
    <CollapsibleSection title="Search Filters">
      <View style={styles.grid}>
        {fields.map((field) => {
          if (field.type === 'status') {
            return (
              <View key={field.key} style={styles.statusRow}>
                {field.options.map((opt) => {
                  const active = (values[field.key] ?? '') === opt.id;
                  return (
                    <TouchableOpacity
                      key={opt.id || 'all'}
                      style={[styles.chip, active && styles.chipActive]}
                      onPress={() => onChange(field.key, opt.id)}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            );
          }
          if (field.type === 'date') {
            return (
              <View key={field.key} style={styles.cell}>
                <DateField
                  value={values[field.key] ?? ''}
                  onChange={(v) => onChange(field.key, v)}
                  placeholder={field.placeholder}
                />
              </View>
            );
          }
          return (
            <View key={field.key} style={styles.cell}>
              <TextInput
                style={styles.input}
                value={values[field.key] ?? ''}
                onChangeText={(v) => onChange(field.key, v)}
                placeholder={field.placeholder}
                placeholderTextColor={colors.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType={field.keyboard ?? 'default'}
                returnKeyType="search"
                onSubmitEditing={onSearch}
              />
            </View>
          );
        })}
      </View>
      <TouchableOpacity style={styles.searchBtn} onPress={onSearch}>
        <Text style={styles.searchBtnText}>Search</Text>
      </TouchableOpacity>
    </CollapsibleSection>
  );
}

