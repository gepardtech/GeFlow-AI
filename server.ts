import fs from "fs";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const distServerPath = path.join(process.cwd(), "dist", "server.cjs");

// In production, delegate directly to the pre-bundled server so plain Node.js executes without requiring TypeScript loaders.
if (isProduction && fs.existsSync(distServerPath)) {
  await import("./dist/server.cjs");
} else {
  // In development, load server.impl.ts with Vite dev middleware
  await import("./server.impl.ts");
}
