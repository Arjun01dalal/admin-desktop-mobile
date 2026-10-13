/**
 * Game metric helpers — shared core + Jyotish metric labels for mobile cards.
 */
import {
  buildGameMetricRows as buildGameMetricRowsShared,
  gameNames,
  parseLudoGameOptions,
  parseLudoGameStats,
  type LudoGameStats,
} from '@astro/shared/opsDashboard';
import type { MetricRow } from '@astro/shared/opsDashboard';
import { metricJyotishLabel } from './constants';

export { gameNames, parseLudoGameOptions, parseLudoGameStats };
export type { LudoGameStats };

export function buildGameMetricRows(raw: unknown, selectedGame: string): MetricRow[] {
  return buildGameMetricRowsShared(raw, selectedGame, metricJyotishLabel);
}
