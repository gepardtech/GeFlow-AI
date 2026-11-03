import React, { useState, useEffect, useRef } from "react";

export interface LazyHydrateProps {
  children: React.ReactNode;
  /**
   * Hydrates when the component enters or nears the viewport via IntersectionObserver.
   * Can be a boolean or an object with rootMargin configuration.
   */
  whenVisible?: boolean | { rootMargin?: string };
  /**
   * Hydrates when the browser main thread is idle (using requestIdleCallback or fallback).
   */
  whenIdle?: boolean | { timeout?: number };
  /**
   * Hydrates immediately upon user interaction with the container.
   * Pass true for default events (pointerover, focus, click, touchstart) or an array of event names.
   */
  onInteraction?: boolean | string[];
  /**
   * Optional wrapper container element type (default: 'div').
   */
  as?: any;
  /**
   * Optional CSS className for the wrapper container.
   */
  className?: string;
  /**
   * Custom placeholder rendered before hydration occurs.
   */
  placeholder?: React.ReactNode;
}

/**
 * LazyHydrate wrapper component
 * Defers mounting and execution of heavy non-critical React subtrees until
 * visible in the viewport, idle, or interacted with by the user.
 * Dramatically improves Total Blocking Time (TBT), First Contentful Paint (FCP),
 * and main-thread responsiveness.
 */
export const LazyHydrate: React.FC<LazyHydrateProps> = ({
  children,
  whenVisible,
  whenIdle,
  onInteraction,
  as: Component = "div",
  className = "",
  placeholder = null,
}) => {
  // If no deferral triggers are specified, hydrate immediately
  const shouldDefer = Boolean(whenVisible || whenIdle || onInteraction);
  const [hydrated, setHydrated] = useState<boolean>(!shouldDefer);
  const containerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (hydrated) return;

    let cleanupFns: Array<() => void> = [];

    // Trigger hydration helper
    const triggerHydration = () => {
      setHydrated(true);
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
      cleanupFns = [];
    };

    // 1. When Visible trigger (IntersectionObserver)
    if (whenVisible) {
      if (typeof window !== "undefined" && "IntersectionObserver" in window) {
        const rootMargin =
          typeof whenVisible === "object" && whenVisible.rootMargin
            ? whenVisible.rootMargin
            : "250px";

        const observer = new IntersectionObserver(
          (entries) => {
            const entry = entries[0];
            if (entry && entry.isIntersecting) {
              triggerHydration();
            }
          },
          { rootMargin, threshold: 0.01 }
        );

        if (containerRef.current) {
          observer.observe(containerRef.current);
        }

        cleanupFns.push(() => observer.disconnect());
      } else {
        triggerHydration();
      }
    }

    // 2. When Idle trigger (requestIdleCallback)
    if (whenIdle) {
      const timeout = typeof whenIdle === "object" && whenIdle.timeout ? whenIdle.timeout : 2000;
      if (typeof window !== "undefined" && "requestIdleCallback" in window) {
        const handle = (window as any).requestIdleCallback(triggerHydration, { timeout });
        cleanupFns.push(() => (window as any).cancelIdleCallback(handle));
      } else {
        const timer = setTimeout(triggerHydration, Math.min(timeout, 1200));
        cleanupFns.push(() => clearTimeout(timer));
      }
    }

    // 3. On Interaction trigger
    if (onInteraction && containerRef.current) {
      const defaultEvents = ["pointerover", "focusin", "click", "touchstart"];
      const events = Array.isArray(onInteraction) ? onInteraction : defaultEvents;
      const el = containerRef.current;

      const handleEvent = () => triggerHydration();

      events.forEach((evt) => {
        el.addEventListener(evt, handleEvent, { once: true, passive: true });
        cleanupFns.push(() => el.removeEventListener(evt, handleEvent));
      });
    }

    return () => {
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch {
          /* ignore */
        }
      });
    };
  }, [hydrated, whenVisible, whenIdle, onInteraction]);

  if (!hydrated) {
    return (
      <Component ref={containerRef} className={className}>
        {placeholder}
      </Component>
    );
  }

  return (
    <Component ref={containerRef} className={className}>
      {children}
    </Component>
  );
};

export default LazyHydrate;
