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
        window.scrollTo(0, 0);
        if (document.documentElement) {
          document.documentElement.scrollTop = 0;
          document.documentElement.scrollLeft = 0;
        }
        if (document.body) {
          document.body.scrollTop = 0;
          document.body.scrollLeft = 0;
        }
      };

      // Run immediately
      resetScroll();
      // Run on next animation frame
      const raf = requestAnimationFrame(resetScroll);
      // Run shortly after DOM paint
      const t = setTimeout(resetScroll, 20);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(t);
      };
    } else {
      const id = hash.replace("#", "");
      const element = document.getElementById(id);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [pathname, search, hash]);

  return null;
}
