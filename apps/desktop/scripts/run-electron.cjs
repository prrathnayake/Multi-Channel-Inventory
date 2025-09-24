#!/usr/bin/env node

const { spawn } = require('node:child_process');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const [, , ...forwardedArgs] = process.argv;
const electronVersion = process.env.DESKTOP_ELECTRON_VERSION || '28.2.0';

const isWindows = process.platform === 'win32';
const npxExecutable = isWindows ? 'npx.cmd' : 'npx';

const child = spawn(
  npxExecutable,
  ['--yes', `electron@${electronVersion}`, '.', ...forwardedArgs],
  {
    stdio: 'inherit',
    env: process.env,
    shell: false
  }
);

child.on('error', (error) => {
  console.error('[desktop] Failed to launch Electron via npx:', error);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
