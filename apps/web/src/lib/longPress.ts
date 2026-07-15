import type React from "react";

/**
 * Long-press → context-menu affordance for touch devices (T3). Right-click
 * has no finger equivalent (iOS never fires contextmenu), so surfaces with
 * right-click menus spread these props too: hold ~500ms to open the same
 * menu at the touch point. Movement cancels (scrolling isn't a press).
 */
export function longPressProps(onTrigger: (x: number, y: number) => void, ms = 500) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return {
    onTouchStart: (e: React.TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const { clientX, clientY } = t;
      timer = setTimeout(() => onTrigger(clientX, clientY), ms);
    },
    onTouchMove: cancel,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
    // Suppress iOS's own press-and-hold callout on these elements.
    style: { WebkitTouchCallout: "none" } as React.CSSProperties,
  };
}
