/**
 * Jest globalTeardown for the selenium e2e suite: stops the demo server
 * started by globalSetup (if we started one).
 */
module.exports = async function globalTeardown() {
  const child = globalThis.__DEMO_SERVER__;
  if (!child) return;

  console.log('\n[e2e] stopping demo server…');
  if (process.platform === 'win32' && child.pid) {
    // child was spawned through a shell — kill the whole tree.
    const { spawnSync } = require('node:child_process');
    spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    child.kill('SIGTERM');
  }
};
