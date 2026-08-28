// Polyfill/guard against getter-only window.fetch and uncaught network rejections in sandboxed environments
try {
  if (typeof window !== "undefined") {
    if (typeof window.fetch === "function") {
      let currentFetch = window.fetch.bind(window);
      Object.defineProperty(window, "fetch", {
        get: () => currentFetch,
        set: (fn: typeof fetch) => {
          currentFetch = typeof fn === "function" ? fn : window.fetch;
        },
        configurable: true,
        enumerable: true,
      });
    }

    window.addEventListener("unhandledrejection", (event) => {
      const reason = event.reason;
      const msg = (reason?.message || String(reason || "")).toLowerCase();
      if (
        msg.includes("failed to fetch") ||
        msg.includes("networkerror") ||
        msg.includes("load failed") ||
        msg.includes("aborted")
      ) {
        // Prevent uncaught network errors from breaking application UI
        event.preventDefault();
        console.warn("Handled network rejection safely:", msg);
      }
    });
  }
} catch {
  // Ignore if already configured
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
