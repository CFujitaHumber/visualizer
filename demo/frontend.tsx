/**
 * @file demo/frontend.tsx
 * @description Browser entry point for the demo harness — mounts DemoApp.
 * Included from `demo/index.html`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DemoApp } from "./DemoApp";

const elem = document.getElementById("root")!;
const app = (
  <StrictMode>
    <DemoApp />
  </StrictMode>
);

// https://bun.com/docs/bundler/hot-reloading#import-meta-hot-data
(import.meta.hot.data.root ??= createRoot(elem)).render(app);
