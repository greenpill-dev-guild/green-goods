#!/usr/bin/env node
import { isDirectRun, parseOptions, runCommands } from '../lib/command-runner.mjs';

const commands = {
  workbook: { handler: 'qa-workbook-build.ts', flags: ['--local'], values: ['--surface', '--cases', '--tag', '--out'] },
  pull: { handler: 'qa-state-pull.ts', flags: ['--force'], values: ['--slug', '--run', '--out'] },
  status: { handler: 'qa-status.ts', values: ['--stale-days', '--issues'] },
  report: { handler: 'qa-report.ts', flags: ['--public'], values: ['--slug', '--window', '--previous', '--build', '--stale-days', '--out', '--skipped'] },
};
export function resolveQa(argv) {
  const args = [...argv];
  if (args[0] === '--') args.shift();
  const command = args.shift();
  if (['help', '--help', '-h'].includes(command) && args.length) {
    if (command === 'help' && args.length === 1) return resolveQa([args[0], '--help']);
    throw new Error('Unexpected arguments after help');
  }
  if (!command || ['help', '--help', '-h'].includes(command)) return { help: 'Usage: bun run qa <workbook|pull|status|report> [options]\nUse <command> --help for options.' };
  const spec = commands[command];
  if (!spec) throw new Error(`Unknown QA command: ${command}`);
  const options = parseOptions(args, { flags: [...(spec.flags || []), '--help', '-h'], values: spec.values });
  if (options['--help'] || options['-h']) return { help: `Usage: bun run qa ${command} [options]\n${[...(spec.flags || []), ...spec.values.map((key) => `${key} <value>`)].join('\n')}` };
  if (options['--stale-days'] && (!Number.isInteger(Number(options['--stale-days'])) || Number(options['--stale-days']) <= 0)) throw new Error('--stale-days requires a positive whole number');
  if (command === 'report' && !options['--slug']) throw new Error('--slug is required');
  if (options['--run'] && !/^(open|latest-closed|run-[1-9]\d{0,5})$/.test(options['--run'])) throw new Error('--run requires open, latest-closed, or run-N');
  const forwarded = Object.entries(options).flatMap(([key, value]) => value === true ? [key] : [key, value]);
  return [{ command: 'bun', args: [`scripts/agents/${spec.handler}`, ...forwarded] }];
}
if (isDirectRun(import.meta.url)) {
  try { const plan = resolveQa(process.argv.slice(2)); if (plan.help) console.log(plan.help); else process.exitCode = await runCommands(plan); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
