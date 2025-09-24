const { spawn } = require('node:child_process');
const path = require('node:path');

const [, , command, ...restArgs] = process.argv;

if (!command) {
  console.error('Usage: node scripts/run-next.cjs <command> [...args]');
  process.exit(1);
}

const projectRoot = path.resolve(__dirname, '..');
process.chdir(projectRoot);

const isWindows = process.platform === 'win32';
const nextExecutable = path.join(
  projectRoot,
  'node_modules',
  '.bin',
  `next${isWindows ? '.cmd' : ''}`
);

const child = spawn(nextExecutable, [command, ...restArgs], {
  stdio: 'inherit',
  shell: isWindows
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
