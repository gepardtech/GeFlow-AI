// Polyfill/guard against uncaught network rejections and ensure robust window.fetch
try {
  if (typeof window !== "undefined") {
    window.addEventListener(
      "unhandledrejection",
      (event) => {
        const reason = event.reason;
        const msg = (reason?.message || String(reason || "")).toLowerCase();
        if (
          msg.includes("failed to fetch") ||
          msg.includes("networkerror") ||
          msg.includes("load failed") ||
          msg.includes("aborted") ||
          msg.includes("non-2xx")
        ) {
          event.preventDefault();
          if (event.stopImmediatePropagation) event.stopImmediatePropagation();
          console.warn("Handled network rejection safely:", msg);
        }
      },
      true
    );
  }
} catch {
  // Ignore if already configured
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
