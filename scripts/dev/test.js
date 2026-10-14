#!/usr/bin/env node
import { isDirectRun, parseOptions, runCommands } from '../lib/command-runner.mjs';

export function resolveTests(argv) {
  const options = parseOptions(argv, { flags: ['--cache', '--force', '--help', '-h'] });
  if (options['--force'] && !options['--cache']) throw new Error('--force requires --cache');
  if (options['--help'] || options['-h']) return { help: 'Usage: bun run test [--cache [--force]]\nDefault: uncached ordered package suite. --cache: existing Turbo full test scope.' };
  if (options['--cache']) return [{ command: 'node', args: ['./node_modules/.bin/turbo', 'run', 'test', ...(options['--force'] ? ['--force'] : []), '--concurrency=2'] }];
  return [
    { command: 'bun', args: ['--bun', 'x', 'vitest', 'run', '--dir', 'scripts/agents'] },
    { command: 'bun', args: ['run', '--cwd', 'packages/contracts', 'test'] },
    { command: 'bun', args: ['run', '--parallel', '--filter', '@green-goods/shared', '--filter', '@green-goods/docs', 'test'] },
    { command: 'bun', args: ['run', '--cwd', 'packages/indexer', 'test'] },
    { command: 'bun', args: ['run', '--parallel', '--filter', '@green-goods/client', '--filter', '@green-goods/admin', '--filter', '@green-goods/agent', 'test'] },
  ];
}
if (isDirectRun(import.meta.url)) {
  try {
    const plan = resolveTests(process.argv.slice(2));
    if (plan.help) console.log(plan.help);
    else process.exitCode = await runCommands(plan);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
