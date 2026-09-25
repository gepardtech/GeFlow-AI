import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Disable browser default scroll restoration so it never restores footer position
    if (typeof window !== "undefined" && "scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    if (!hash) {
      const resetScroll = () => {
        try {
          if (typeof window !== "undefined" && typeof window.scrollTo === "function") {
            window.scrollTo(0, 0);
          }
          if (document.documentElement) {
            document.documentElement.scrollTop = 0;
            document.documentElement.scrollLeft = 0;
          }
          if (document.body) {
            document.body.scrollTop = 0;
            document.body.scrollLeft = 0;
          }
        } catch {
          // Ignore scroll errors in restricted iframes
        }
      };

      // Run immediately
      resetScroll();
      // Run on next animation frame
      const raf = typeof requestAnimationFrame === "function" ? requestAnimationFrame(resetScroll) : 0;
      // Run shortly after DOM paint
      const t = setTimeout(resetScroll, 20);

      return () => {
        if (typeof cancelAnimationFrame === "function" && raf) {
          cancelAnimationFrame(raf);
        }
        clearTimeout(t);
      };
    } else {
      try {
        const id = hash.replace("#", "");
        const element = document.getElementById(id);
        if (element && typeof element.scrollIntoView === "function") {
          element.scrollIntoView({ behavior: "smooth" });
        }
      } catch {
        // Ignore scrollIntoView errors
      }
    }
  }, [pathname, search, hash]);

  return null;
}
