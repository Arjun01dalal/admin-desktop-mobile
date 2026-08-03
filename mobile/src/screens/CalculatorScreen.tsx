import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '../theme';

const UNLOCK_CODE = '9100';

const KEYS: string[][] = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['00', '0', '.', '='],
];

function evaluate(expr: string): string {
  try {
    const js = expr.replace(/÷/g, '/').replace(/×/g, '*').replace(/−/g, '-');
    if (!/^[\d+\-*/.%\s]+$/.test(js)) return 'Error';
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${js})`)() as number;
    if (!Number.isFinite(result)) return 'Error';
    return String(Math.round(result * 1e10) / 1e10);
  } catch {
    return 'Error';
  }
}

/** Calculator disguise — entering 9100 then "=" reveals the admin login. */
export function CalculatorScreen({ onUnlock }: { onUnlock: () => void }) {
  const [expr, setExpr] = useState('');
  const [display, setDisplay] = useState('0');

  const press = (key: string) => {
    if (key === 'C') {
      setExpr('');
      setDisplay('0');
      return;
    }
    if (key === '⌫') {
      const next = expr.slice(0, -1);
      setExpr(next);
      setDisplay(next || '0');
      return;
    }
    if (key === '=') {
      if (expr === UNLOCK_CODE) {
        setExpr('');
        setDisplay('0');
        onUnlock();
        return;
      }
      const result = evaluate(expr);
      setExpr(result === 'Error' ? '' : result);
      setDisplay(result);
      return;
    }
    const next = expr + key;
    setExpr(next);
    setDisplay(next);
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.display}>
        <Text style={styles.displayText} numberOfLines={1} adjustsFontSizeToFit>
          {display}
        </Text>
      </View>
      <View style={styles.pad}>
        {KEYS.map((row) => (
          <View key={row.join('')} style={styles.row}>
            {row.map((key) => {
              const isOp = ['÷', '×', '−', '+', '='].includes(key);
              const isFn = ['C', '⌫', '%'].includes(key);
              return (
                <Pressable
                  key={key}
                  onPress={() => press(key)}
                  style={({ pressed }) => [
                    styles.key,
                    isOp && { backgroundColor: colors.primary },
                    isFn && { backgroundColor: colors.surfaceAlt },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.keyText,
                      isOp && { color: colors.primaryForeground },
                      isFn && { color: colors.primary },
                    ]}
                  >
                    {key}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  display: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: spacing(6),
  },
  displayText: { color: colors.foreground, fontSize: 64, fontWeight: '300' },
  pad: { padding: spacing(3), paddingBottom: spacing(5) },
  row: { flexDirection: 'row' },
  key: {
    flex: 1,
    margin: spacing(1.5),
    height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { color: colors.foreground, fontSize: 26, fontWeight: '500' },
});
