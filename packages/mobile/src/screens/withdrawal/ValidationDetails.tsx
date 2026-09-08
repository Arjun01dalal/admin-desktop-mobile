/**
 * Recursive renderer for the bot-validation `details` blob on a withdrawal row.
 * Purely presentational — arbitrary nested objects/arrays in, labelled rows out.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import { formatPrimitive, isRecord } from './helpers';

function NestedDetailValue({
  label,
  value,
  depth = 0,
}: {
  label: string;
  value: unknown;
  depth?: number;
}) {
  if (depth > 6) {
    return (
      <View style={styles.row}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatPrimitive(value)}</Text>
      </View>
    );
  }

  if (Array.isArray(value)) {
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{label}</Text>
        {value.length === 0 ? (
          <Text style={styles.muted}>—</Text>
        ) : (
          value.map((entry, i) => (
            <View key={`${label}-${i}`} style={styles.nestedBox}>
              {isRecord(entry) ? (
                Object.entries(entry).map(([k, v]) => (
                  <NestedDetailValue key={k} label={k} value={v} depth={depth + 1} />
                ))
              ) : (
                <Text style={styles.value}>{formatPrimitive(entry)}</Text>
              )}
            </View>
          ))
        )}
      </View>
    );
  }

  if (isRecord(value)) {
    const keys = Object.keys(value);
    return (
      <View style={styles.group}>
        <Text style={styles.groupTitle}>{label}</Text>
        <View style={styles.objectBox}>
          {keys.length === 0 ? (
            <Text style={styles.muted}>—</Text>
          ) : (
            keys.map((k) => (
              <NestedDetailValue key={k} label={k} value={value[k]} depth={depth + 1} />
            ))
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{formatPrimitive(value)}</Text>
    </View>
  );
}

export function ValidationDetailsBlock({ details }: { details: unknown }) {
  if (!isRecord(details) || Object.keys(details).length === 0) return null;
  return (
    <View style={styles.detailsBox}>
      <Text style={styles.detailsLabel}>Details</Text>
      {Object.entries(details).map(([k, v]) => (
        <NestedDetailValue key={k} label={k} value={v} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  detailsBox: {
    marginTop: spacing(2),
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing(2),
    gap: spacing(1),
  },
  detailsLabel: {
    color: colors.foreground,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: spacing(0.5),
  },
  group: { marginTop: spacing(0.5), marginBottom: spacing(0.5) },
  groupTitle: {
    color: colors.foreground,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing(0.75),
  },
  nestedBox: {
    marginLeft: spacing(0.5),
    marginTop: spacing(0.75),
    padding: spacing(1.5),
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    gap: spacing(0.5),
  },
  objectBox: {
    marginLeft: spacing(0.5),
    padding: spacing(1.5),
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    gap: spacing(0.5),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing(2),
    paddingVertical: 4,
  },
  label: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '700',
    minWidth: 96,
    flexShrink: 0,
  },
  value: {
    color: colors.foreground,
    fontSize: 12,
    flex: 1,
  },
  muted: { color: colors.muted, fontSize: 12 },
});
