#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCommandRunner, isDirectRun, parseOptions, REPO_ROOT } from '../lib/command-runner.mjs';
import { waitForService, findSystemNode } from '../lib/dev-shared.js';

const presets = {
  all: { stack: true, args: ['test', '--project=client-full', '--project=chromium', '--project=performance'] },
  smoke: { stack: true, args: ['test', 'tests/specs/client.smoke.spec.ts', 'tests/specs/admin.smoke.spec.ts', '--project=client-ci', '--project=admin-ci'] },
  ui: { args: ['test', '--ui'], env: { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } },
  fork: { args: ['test', '--project=anvil-fork'], env: { RUN_FORK_TESTS: 'true' } },
  passkey: { args: ['test', '--project=passkey-mock'] },
  testnet: { args: ['test', '--project=testnet'], env: { TESTNET: 'true' } },
};

export function validatePlaywrightArgs(args, preset) {
  const boolean = new Set(['--fail-on-flaky-tests', '--forbid-only', '--fully-parallel', '--headed', '--ignore-snapshots', '--last-failed', '--list', '--no-deps', '--pass-with-no-tests', '--quiet', '-x', '--help', '-h']);
  const values = new Set(['--grep', '-g', '--global-timeout', '--grep-invert', '--workers', '-j', '--max-failures', '--output', '--repeat-each', '--reporter', '--retries', '--run-agents', '--shard', '--test-list', '--test-list-invert', '--timeout', '--trace', '--tsconfig', '--ui-host', '--ui-port', '--update-source-method']);
  const optional = new Set(['--debug', '--only-changed', '--update-snapshots', '-u']);
  const choices = { '--trace': ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure', 'retain-on-failure-and-retries'], '--run-agents': ['missing', 'all', 'none'], '--update-source-method': ['overwrite', '3way', 'patch'], '--debug': ['inspector', 'cli'], '--update-snapshots': ['all', 'changed', 'missing', 'none'], '-u': ['all', 'changed', 'missing', 'none'] };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith('-')) { try { new RegExp(token); } catch { throw new Error(`Invalid test-file filter: ${token}`); } continue; }
    const [flag, ...inline] = token.split('=');
    if (['--project', '--config', '-c', '--browser', '--ui'].includes(flag)) throw new Error(`${flag} conflicts with the selected preset; choose --preset instead`);
    if (!boolean.has(flag) && !values.has(flag) && !optional.has(flag)) throw new Error(`Unknown Playwright argument: ${flag}`);
    const identity = ({ '-g': '--grep', '-j': '--workers', '-u': '--update-snapshots', '-h': '--help' })[flag] || flag;
    if (seen.has(identity)) throw new Error(`Duplicate Playwright option: ${flag}`);
    seen.add(identity);
    if (boolean.has(flag)) { if (inline.length) throw new Error(`${flag} does not take a value`); continue; }
    let value = inline.length ? inline.join('=') : undefined;
    if (value === undefined && args[index + 1] && !args[index + 1].startsWith('-')) value = args[++index];
    if (!value && !optional.has(flag)) throw new Error(`${flag} requires a value`);
    if (value !== undefined && choices[flag] && !choices[flag].includes(value)) throw new Error(`Invalid ${flag} value`);
    if (['--global-timeout', '--max-failures', '--repeat-each', '--retries', '--timeout', '--ui-port'].includes(flag) && (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error(`${flag} requires a non-negative integer`);
    if (['--workers', '-j'].includes(flag) && !/^[1-9]\d*%?$/.test(value)) throw new Error(`${flag} requires a positive worker count or percentage`);
    if (flag === '--shard' && (!/^[1-9]\d*\/[1-9]\d*$/.test(value) || Number(value.split('/')[0]) > Number(value.split('/')[1]))) throw new Error('--shard requires current/total with current <= total');
    if (['--grep', '-g', '--grep-invert'].includes(flag)) { try { new RegExp(value); } catch { throw new Error(`Invalid ${flag} regular expression`); } }
    if (['--ui-host', '--ui-port'].includes(flag) && preset !== 'ui') throw new Error(`${flag} requires --preset ui`);
  }
  return { list: seen.has('--list'), help: seen.has('--help') };
}

export function resolveE2e(argv) {
  const options = parseOptions(argv, { flags: ['--help', '-h'], values: ['--preset'], passthrough: true });
  if (options['--help'] || options['-h']) return { help: 'Usage: bun run browser e2e [--preset all|smoke|ui|fork|passkey|testnet] [-- <Playwright arguments>]\nDefault: all. all/smoke start and clean up an owner-bound web stack; other presets preserve Playwright startup policy.' };
  const preset = options['--preset'] || 'all';
  if (!Object.hasOwn(presets, preset)) throw new Error(`Unknown E2E preset: ${preset}`);
  const selection = presets[preset];
  const downstream = validatePlaywrightArgs(options.rest || [], preset);
  if (downstream.help) return resolveE2e(['--help']);
  return { preset, stack: Boolean(selection.stack) && !downstream.list, rest: options.rest || [], args: [...selection.args, ...(options.rest || [])], env: { APP_ENV: 'test', ...selection.env, ...(selection.stack ? { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } : {}) } };
}

export async function executeE2e(selection, dependencies = {}) {
  const spawnImpl = dependencies.spawnImpl || spawn;
  const wait = dependencies.wait || waitForService;
  const runner = createCommandRunner({ ...dependencies, spawnImpl });
  let stack;
  let stackDone;
  let logStream;
  const owner = `e2e-${randomUUID()}`;
  const stackEnv = { ...process.env, APP_ENV: 'test', VITE_ENABLE_SW_DEV: 'true', GREEN_GOODS_DEV_OWNER: owner };
  try {
    if (selection.stack) {
      const directory = fs.mkdtempSync(path.join(tmpdir(), 'green-goods-e2e-'));
      const logFile = path.join(directory, 'dev.log');
      logStream = fs.createWriteStream(logFile, { flags: 'wx' });
      console.log(`E2E web-stack log: ${logFile}`);
      stack = runner.track(spawnImpl('bun', ['run', 'dev', '--', 'web'], { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'pipe'], detached: false, shell: false, env: stackEnv }));
      stack.stdout.pipe(logStream);
      stack.stderr.pipe(logStream);
      stackDone = new Promise((resolve) => { stack.once('error', () => resolve(1)); stack.once('close', (code) => resolve(code ?? 1)); });
      const deadlineMs = Date.now() + 90_000;
      for (const port of [3001, 3002]) {
        const ready = await Promise.race([
          wait({ urls: [`https://localhost:${port}`, `http://localhost:${port}`], deadlineMs }),
          runner.cancellation.then(() => ({ ok: false })),
          stackDone.then((code) => code === 0 ? new Promise(() => {}) : ({ ok: false })),
        ]);
        if (!ready.ok) { console.error(`E2E service on ${port} did not become ready; see ${logFile}`); return runner.cancelled || 1; }
      }
    }
    if (runner.cancelled) return runner.cancelled;
    const systemNode = dependencies.systemNode || findSystemNode() || process.execPath;
    return await runner.run([{ command: systemNode, args: [path.join(REPO_ROOT, 'node_modules/@playwright/test/cli.js'), ...selection.args], env: selection.env }]);
  } finally {
    if (stack) {
      if (stack.exitCode === null && stack.signalCode === null) stack.kill('SIGTERM');
      // The owning launcher performs PM2 cleanup on termination. Its unique owner is
      // also passed to an explicit stop if startup failed before handlers attached.
      await Promise.race([stackDone, new Promise((resolve) => { const timer = setTimeout(resolve, 5000); timer.unref(); })]);
      const cleanup = createCommandRunner({ ...dependencies, spawnImpl });
      try { await cleanup.run([{ command: 'bun', args: ['run', 'dev', '--', 'stop'], env: { GREEN_GOODS_DEV_OWNER: owner } }]); }
      finally { cleanup.dispose(); }
    }
    logStream?.end();
    runner.dispose();
  }
}
if (isDirectRun(import.meta.url)) {
  try { const plan = resolveE2e(process.argv.slice(2)); if (plan.help) console.log(plan.help); else process.exitCode = await executeE2e(plan); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
