/**
 * Recursive renderer for the bot-validation `details` blob on a withdrawal row.
 * Purely presentational — arbitrary nested objects/arrays in, labelled rows out.
 */
import React from 'react';
import { Text, View } from 'react-native';
import { formatPrimitive, isRecord } from './helpers';
import { styles } from './ValidationDetails.styles';

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

