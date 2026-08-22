import { useEffect, useRef, useState } from 'react';

/** Table needs at least this much room before we stop shrinking it. */
export const MIN_TABLE_HEIGHT = 320;
const DEFAULT_BOTTOM_GAP = 12;
const DEFAULT_FALLBACK_SUBTRACT = 260;

export type FitTableHeightOptions = {
  bottomGap?: number;
  fallbackSubtract?: number;
};

function observePrecedingSiblings(
  el: HTMLElement,
  scroller: HTMLElement,
  observe: (node: Element | null) => void,
) {
  let current: HTMLElement | null = el;
  while (current && current !== scroller) {
    observe(current.parentElement);
    let sibling = current.previousElementSibling;
    while (sibling) {
      observe(sibling);
      sibling = sibling.previousElementSibling;
    }
    current = current.parentElement;
  }
}

/**
 * The app shell marks its single scrolling region, so the panel never measures
 * itself against one of its own auto-height wrappers.
 *
 * Sniffing `overflow-y` is not enough: `overflow-x: hidden` makes the computed
 * `overflow-y` resolve to `auto`, so a plain page wrapper looks scrollable. Its
 * height includes the panel, making the measurement self-referential — the panel
 * loses a few pixels on every pass until it bottoms out at MIN_TABLE_HEIGHT.
 */
function findScroller(el: HTMLElement): HTMLElement {
  const marked = el.closest('[data-app-scroll]');
  if (marked instanceof HTMLElement) return marked;

  // Portaled content (dialogs, drawers) sits outside the shell.
  let node = el.parentElement;
  while (node) {
    const overflowY = window.getComputedStyle(node).overflowY;
    if (overflowY === 'auto' || overflowY === 'scroll') return node;
    node = node.parentElement;
  }
  return document.documentElement;
}

/**
 * Sizes a table panel to the space left in the scroll viewport, so its
 * pagination bar stays visible at the bottom instead of falling below the fold.
 *
 * `fits` is false when the panel had to be clamped to MIN_TABLE_HEIGHT — a
 * sticky footer would then float over the rows, so callers should skip sticky.
 */
export function useFitTableHeight<T extends HTMLElement = HTMLDivElement>(
  options?: FitTableHeightOptions,
) {
  const bottomGap = options?.bottomGap ?? DEFAULT_BOTTOM_GAP;
  const fallbackSubtract =
    options?.fallbackSubtract ?? DEFAULT_FALLBACK_SUBTRACT;
  const ref = useRef<T | null>(null);
  const [available, setAvailable] = useState<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const scroller = findScroller(el);

    const measure = () => {
      // Scroll-independent: distance from the scroller's content top. The panel's
      // own height never feeds back into `top`, so this cannot oscillate.
      const top =
        el.getBoundingClientRect().top -
        scroller.getBoundingClientRect().top +
        scroller.scrollTop;
      // `clientHeight` covers padding while `top` starts at the padding box, so
      // the scroller's bottom padding has to come off too.
      const padBottom =
        parseFloat(window.getComputedStyle(scroller).paddingBottom) || 0;
      const next = Math.round(
        scroller.clientHeight - padBottom - top - bottomGap,
      );
      setAvailable((prev) =>
        prev != null && Math.abs(prev - next) < 2 ? prev : next,
      );
    };

    measure();

    // Anything above the panel (filters, collapsible summaries) shifts its top.
    // Walk up the tree so sections like Top Casino Games (uncle nodes) also
    // trigger a remeasure when collapsed or expanded.
    const observer = new ResizeObserver(measure);
    const observe = (node: Element | null) => {
      if (node instanceof HTMLElement) observer.observe(node);
    };

    observe(scroller);
    observePrecedingSiblings(el, scroller, observe);

    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [bottomGap]);

  return {
    ref,
    height:
      available == null
        ? `calc(100vh - ${fallbackSubtract}px)`
        : Math.max(MIN_TABLE_HEIGHT, available),
    fits: available == null || available >= MIN_TABLE_HEIGHT,
  };
}
