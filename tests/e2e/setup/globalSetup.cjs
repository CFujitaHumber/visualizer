/**
 * Jest globalSetup for the selenium e2e suite: boots the Bun demo server on
 * port 3000 and waits until it responds.
 */
const { spawn } = require('node:child_process');

const DEMO_URL = 'http://localhost:3000';
const BOOT_TIMEOUT_MS = 60000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

module.exports = async function globalSetup() {
  // Reuse an already-running demo server (e.g. a local `bun run dev`).
  try {
    const res = await fetch(DEMO_URL);
    if (res.ok) {
      console.log('\n[e2e] demo server already running — reusing it');
      globalThis.__DEMO_SERVER__ = null;
      return;
    }
  } catch {
    // not running — spawn it below
  }

  console.log('\n[e2e] starting demo server (bun demo/index.ts)…');
  const child = spawn('bun', ['demo/index.ts'], {
    cwd: process.cwd(),
    stdio: 'pipe',
    shell: process.platform === 'win32',
    env: { ...process.env, NODE_ENV: 'production' },
  });
  child.stdout.on('data', (d) => process.stdout.write(`[demo] ${d}`));
  child.stderr.on('data', (d) => process.stderr.write(`[demo] ${d}`));
  globalThis.__DEMO_SERVER__ = child;

  const deadline = Date.now() + BOOT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(DEMO_URL);
      if (res.ok) {
        console.log('[e2e] demo server is up');
        return;
      }
    } catch {
      // keep polling
    }
    await sleep(500);
  }
  throw new Error(`[e2e] demo server did not respond within ${BOOT_TIMEOUT_MS} ms`);
};
