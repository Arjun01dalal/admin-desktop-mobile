/**
 * Game metric helpers — shared core + Jyotish metric labels for desktop cards.
 */
import {
  buildGameMetricRows as buildGameMetricRowsShared,
  gameNames,
  parseLudoGameOptions,
  parseLudoGameStats,
  type LudoGameStats,
  type MetricRow,
} from '@astro/shared/opsDashboard';
import { metricJyotishLabel } from './jyotishMapping';

export { gameNames, parseLudoGameOptions, parseLudoGameStats };
export type { LudoGameStats };

export function buildGameMetricRows(raw: unknown, selectedGame: string): MetricRow[] {
  return buildGameMetricRowsShared(raw, selectedGame, metricJyotishLabel);
}
