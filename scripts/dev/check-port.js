#!/usr/bin/env node
import { spawnSync } from 'node:child_process';

const [rawPort, label = 'dev surface'] = process.argv.slice(2);
const port = Number(rawPort);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error(`[check-port] Invalid port "${rawPort}".`);
  process.exit(2);
}

const result = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN'], {
  encoding: 'utf8',
  stdio: ['ignore', 'pipe', 'ignore'],
});

if (result.status === 0 && result.stdout.trim()) {
  console.error(`[check-port] ${label} needs port ${port}, but it is already in use.`);
  console.error(result.stdout.trim());
  console.error('[check-port] Stop the owning process yourself or use dev-surfaces for owned cleanup.');
  process.exit(1);
}
