#!/usr/bin/env node
import path from 'node:path';
import { isDirectRun, parseOptions, REPO_ROOT, runCommands } from '../lib/command-runner.mjs';
import { resolveE2e } from './test-e2e.js';

export function resolveBrowser(argv) {
  const args = [...argv];
  if (args[0] === '--') args.shift();
  const command = args.shift();
  if (['help', '--help', '-h'].includes(command) && args.length) {
    if (command === 'help' && args.length === 1) return resolveBrowser([args[0], '--help']);
    throw new Error('Unexpected arguments after help');
  }
  if (!command || ['help', '--help', '-h'].includes(command)) return { help: 'Usage: bun run browser <e2e|routes|lighthouse> [options]\nUse <command> --help for details. Browser policy and authentication requirements still apply.' };
  if (command === 'e2e') {
    const selection = resolveE2e(args);
    if (selection.help) return selection;
    return [{ command: 'node', args: ['scripts/dev/test-e2e.js', '--preset', selection.preset, ...(selection.rest.length ? ['--', ...selection.rest] : [])], env: { APP_ENV: 'test' } }];
  }
  if (command === 'routes') {
    const options = parseOptions(args, { flags: ['--help', '-h'] });
    if (options['--help'] || options['-h']) return { help: 'Usage: bun run browser routes\nPrints the clean-room evidence label, builds client/admin/docs, then runs route proof.' };
    return [
      { command: 'bun', args: ['scripts/browser-evidence-label.mjs'] },
      ...['packages/client', 'packages/admin', 'docs'].map((cwd) => ({ command: 'bun', args: ['run', '--cwd', cwd, 'build'] })),
      { command: 'bun', args: ['scripts/agentic-browser-proof.mjs'] },
    ];
  }
  if (command === 'lighthouse') {
    const options = parseOptions(args, { flags: ['--help', '-h'], values: ['--app', '--action'] });
    if (options['--help'] || options['-h']) return { help: 'Usage: bun run browser lighthouse [--app client|admin|all] [--action autorun|collect]\nDefaults: all, autorun. collect supports client only.' };
    const app = options['--app'] || 'all';
    const action = options['--action'] || 'autorun';
    if (!['client', 'admin', 'all'].includes(app)) throw new Error('Unknown Lighthouse app');
    if (!['autorun', 'collect'].includes(action)) throw new Error('Unknown Lighthouse action');
    if (action === 'collect' && app !== 'client') throw new Error('Lighthouse collect supports --app client only');
    return (app === 'all' ? ['client', 'admin'] : [app]).flatMap((surface) => [
      { command: 'bun', args: ['run', '--cwd', `packages/${surface}`, 'build'] },
      { command: 'node', args: [path.join(REPO_ROOT, 'node_modules/@lhci/cli/src/cli.js'), action], cwd: path.join(REPO_ROOT, `packages/${surface}`) },
    ]);
  }
  throw new Error(`Unknown browser command: ${command}`);
}
if (isDirectRun(import.meta.url)) {
  try { const plan = resolveBrowser(process.argv.slice(2)); if (plan.help) console.log(plan.help); else process.exitCode = await runCommands(plan); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
