/**
 * @file demo/frontend-live.tsx
 * @description Browser entry point for the live demo harness — mounts DemoAppLive.
 * Included from `demo/index-live.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoAppLive } from "./DemoAppLive";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <DemoAppLive />
  </StrictMode>
);

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
(import.meta.hot.data.root ??= createRoot(elem)).render(app);
