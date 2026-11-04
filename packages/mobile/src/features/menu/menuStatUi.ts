/**
 * Shared Menu KPI formatters + tile styles (Balance + Unique Pending).
 */
import type { ThemeColors } from '../../themeTokens/palettes';

export function formatMenuInr(value: number): string {
  return `₹${value.toLocaleString('en-IN')}`;
}

export function formatMenuCount(value: number): string {
  return value.toLocaleString('en-IN');
}

export function createMenuStatStyles(c: ThemeColors) {
  const tileBase = {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    backgroundColor: c.surface,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'flex-start' as const,
  };

  return {
    sectionTitle: {
      color: c.muted,
      fontSize: 10,
      fontWeight: '800' as const,
      letterSpacing: 0.4,
      textAlign: 'center' as const,
      marginBottom: 4,
    },
    statsAsOf: {
      color: c.muted,
      fontSize: 9,
      fontWeight: '700' as const,
      marginTop: 4,
      letterSpacing: 0.2,
      textAlign: 'center' as const,
    },
    statsRow: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: 6,
      marginTop: 6,
      width: '100%' as const,
    },
    tileHalf: {
      ...tileBase,
      width: '48%' as const,
      flexGrow: 1,
      minWidth: '46%' as const,
      maxWidth: '49%' as const,
    },
    tileThird: {
      ...tileBase,
      width: '31%' as const,
      flexGrow: 1,
      minWidth: '30%' as const,
      maxWidth: '33%' as const,
    },
    statLabel: {
      color: c.muted,
      fontSize: 11,
      fontWeight: '700' as const,
      lineHeight: 14,
      marginBottom: 2,
    },
    statLabelCompact: {
      color: c.muted,
      fontSize: 10,
      fontWeight: '700' as const,
      lineHeight: 13,
      marginBottom: 2,
    },
    statValue: {
      color: c.foreground,
      fontSize: 14,
      fontWeight: '800' as const,
      width: '100%' as const,
    },
    statAmount: {
      color: c.muted,
      fontSize: 11,
      fontWeight: '700' as const,
      width: '100%' as const,
      marginTop: 2,
    },
    wrap: {
      marginTop: 8,
      width: '100%' as const,
    },
    errorRow: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      flexWrap: 'wrap' as const,
      gap: 8,
      marginTop: 4,
      paddingHorizontal: 4,
    },
    errorText: {
      color: c.destructive,
      fontSize: 11,
      fontWeight: '600' as const,
      flexShrink: 1,
      textAlign: 'center' as const,
    },
    retryText: {
      color: c.primary,
      fontSize: 11,
      fontWeight: '800' as const,
    },
    primary: { color: c.primary },
    success: { color: c.success },
    info: { color: c.info },
    destructive: { color: c.destructive },
  };
}
