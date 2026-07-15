/**
 * @file demo/index.ts
 * @description Bun dev server for the demo harness. Serves the demo app on a
 * fixed port so selenium-webdriver e2e tests have a stable target.
 *
 * Not shipped to npm — the published package contains only `dist/`.
 */
import { serve } from "bun";
import index from "./index.html";

export const DEMO_PORT = 3000;

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

console.log(`🚀 @humber-asv/visualizer demo running at ${server.url}`);
