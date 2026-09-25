import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Polyfill/guard against uncaught network rejections
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
        console.warn("Handled network rejection safely:", msg);
      }
    },
    true
  );
}

const mountApp = () => {
  const rootElement = document.getElementById("root");
  if (!rootElement) return;

  try {
    const root = createRoot(rootElement);
    root.render(
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  } catch (err: any) {
    console.error("Critical mount error caught:", err);
    rootElement.innerHTML = `
      <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;background:#090d16;color:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;text-align:center;">
        <div style="max-width:440px;width:100%;padding:28px;background:#111827;border:1px solid #1f2937;border-radius:16px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.5);">
          <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;color:#ffffff;">Application Recovered</h2>
          <p style="font-size:14px;color:#9ca3af;margin-bottom:20px;line-height:1.5;">An unexpected initialization state was detected. Tap below to refresh and load the workspace.</p>
          <button onclick="sessionStorage.clear();window.location.reload();" style="padding:10px 24px;border-radius:10px;background:#50c8fb;color:#030712;font-weight:600;font-size:14px;border:none;cursor:pointer;">Reload Workspace</button>
        </div>
      </div>
    `;
  }
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", mountApp);
} else {
  mountApp();
}
