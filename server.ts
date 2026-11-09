import fs from "fs";
import path from "path";
process.on("unhandledRejection", (reason) => {
  console.warn("Notice: Unhandled promise rejection in server.ts:", reason);
});
process.on("uncaughtException", (error) => {
  console.error("Notice: Uncaught exception in server.ts:", error);
});

// Polyfill __filename when tsx or dynamic loader sets it to '[eval]'
if (typeof (globalThis as any).__filename === "string" && (globalThis as any).__filename === "[eval]") {
  (globalThis as any).__filename = path.resolve(process.cwd(), "package.json");
}

const isProduction = process.env.NODE_ENV === "production";
const distServerPath = path.join(process.cwd(), "dist", "server.cjs");

// In production, delegate directly to the pre-bundled server so plain Node.js executes without requiring TypeScript loaders.
if (isProduction && fs.existsSync(distServerPath)) {
  await import("./dist/server.cjs");
} else {
  // In development, load server.impl.ts with Vite dev middleware
  await import("./server.impl.ts");
}
