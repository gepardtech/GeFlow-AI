// Polyfill/guard against getter-only window.fetch in iframe/sandboxed environments
try {
  if (typeof window !== "undefined" && typeof window.fetch === "function") {
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
} catch {
  // Ignore if already configured
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
