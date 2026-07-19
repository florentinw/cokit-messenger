import { useCallback, useEffect, useState, type RefObject } from "react";

/** Show a header bottom border only when the scroller can scroll content under it. */
export function useOverflowHeaderBorder(
  scrollRef: RefObject<HTMLElement | null>,
  /** Bump when scroll content size may change (list length, etc.). */
  contentKey: unknown = 0,
): boolean {
  const [headerBorder, setHeaderBorder] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      setHeaderBorder(false);
      return;
    }
    setHeaderBorder(el.scrollHeight > el.clientHeight + 1);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) {
      setHeaderBorder(false);
      return;
    }
    update();
    const ro = new ResizeObserver(() => update());
    ro.observe(el);
    return () => ro.disconnect();
  }, [update, contentKey]);

  return headerBorder;
}
