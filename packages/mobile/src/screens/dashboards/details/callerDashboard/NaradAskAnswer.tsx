/**
 * Renders Narad Ask answer — text paragraphs + horizontal scroll tables.
 */
import React, { useMemo } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { parseNaradAskBlocks, type NaradAskTableBlock } from '@astro/shared/naradAskMarkdown';
import { colors, spacing } from '../../../../theme';

type Props = {
  answer: string;
};

function AnswerTable({ table }: { table: NaradAskTableBlock }) {
  const colCount = Math.max(table.headers.length, 1);
  const minColWidth = colCount <= 3 ? 110 : colCount <= 5 ? 96 : 84;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator
      style={{ marginTop: spacing(2) }}
      contentContainerStyle={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        overflow: 'hidden',
        backgroundColor: colors.surfaceAlt,
      }}
    >
      <View>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: 'rgba(255,159,10,0.16)',
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          {table.headers.map((h, i) => (
            <Text
              key={`h-${i}`}
              style={{
                width: minColWidth,
                paddingHorizontal: spacing(2),
                paddingVertical: spacing(2),
                color: colors.foreground,
                fontSize: 11,
                fontWeight: '800',
              }}
              numberOfLines={2}
            >
              {h || '—'}
            </Text>
          ))}
        </View>
        {table.rows.map((row, rIdx) => (
          <View
            key={`r-${rIdx}`}
            style={{
              flexDirection: 'row',
              borderBottomWidth: rIdx === table.rows.length - 1 ? 0 : 1,
              borderBottomColor: colors.border,
              backgroundColor: rIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.03)',
            }}
          >
            {row.map((cell, cIdx) => (
              <Text
                key={`c-${rIdx}-${cIdx}`}
                style={{
                  width: minColWidth,
                  paddingHorizontal: spacing(2),
                  paddingVertical: spacing(1.75),
                  color: colors.foreground,
                  fontSize: 12,
                  fontWeight: cIdx === 0 ? '700' : '500',
                }}
                numberOfLines={3}
              >
                {cell || '—'}
              </Text>
            ))}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

export function NaradAskAnswer({ answer }: Props) {
  const blocks = useMemo(() => parseNaradAskBlocks(answer), [answer]);

  return (
    <View
      style={{
        marginTop: spacing(2),
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 10,
        backgroundColor: colors.surfaceAlt,
        padding: spacing(2.5),
      }}
    >
      <Text style={{ color: colors.muted, fontSize: 11, fontWeight: '800' }}>ANSWER</Text>
      {blocks.map((block, idx) => {
        if (block.type === 'table') {
          return <AnswerTable key={`t-${idx}`} table={block} />;
        }
        return (
          <Text
            key={`p-${idx}`}
            style={{
              color: colors.foreground,
              fontWeight: '600',
              marginTop: spacing(1.5),
              lineHeight: 20,
              fontSize: 13,
            }}
          >
            {block.text}
          </Text>
        );
      })}
    </View>
  );
}
