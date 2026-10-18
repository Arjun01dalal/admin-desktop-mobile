/**
 * Pure helpers for panel deep-link params (unit-tested; no screen imports).
 */

export type PanelDetailParams = Record<string, unknown>;

export type PanelDetailTarget = {
  href?: string;
  search?: string;
  state?: Record<string, unknown>;
};

/** Merge `search` query params and router `state` into one params object. */
export function mergeTargetParams(target: PanelDetailTarget): PanelDetailParams {
  const params: PanelDetailParams = {};
  if (target.search) {
    const qs = target.search.startsWith('?') ? target.search.slice(1) : target.search;
    new URLSearchParams(qs).forEach((value, key) => {
      params[key] = value;
    });
  }
  if (target.state) Object.assign(params, target.state);
  return params;
}
