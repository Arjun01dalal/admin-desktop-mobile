import { lazy, type ComponentType } from 'react';

/** Named-export pages → React.lazy default components. */
export function lazyNamed<M extends Record<string, unknown>>(
  loader: () => Promise<M>,
  exportName: keyof M,
) {
  return lazy(async () => {
    const mod = await loader();
    return { default: mod[exportName] as ComponentType<Record<string, unknown>> };
  });
}
