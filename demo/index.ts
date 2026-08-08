/**
 * @file demo/index.ts
 * @description Bun dev server for the demo harness. Serves the demo app on a
 * fixed port so selenium-webdriver e2e tests have a stable target.
 *
 * `bun run dev` serves the sim harness (index.html / DemoApp.tsx); passing
 * `--live` (as `bun run sync-dev` does) serves the live harness
 * (index-live.html / DemoAppLive.tsx), which connects to the real ASV
 * basestation via `initConnection()` instead of running the local simulator.
 *
 * Not shipped to npm — the published package contains only `dist/`.
 */
import { serve } from "bun";
import simIndex from "./index.html";
import liveIndex from "./index-live.html";

export const DEMO_PORT = 3000;

const live = process.argv.includes("--live");
const index = live ? liveIndex : simIndex;

const server = serve({
  port: DEMO_PORT,
  routes: {
    // Serve index.html for all unmatched routes.
    "/*": index,
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 @humber-asv/visualizer demo running at ${server.url} (${live ? "live" : "simulation"} mode)`);
