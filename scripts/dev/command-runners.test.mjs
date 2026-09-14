import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test from 'node:test';
import { createCommandRunner, REPO_ROOT, runCommands } from '../lib/command-runner.mjs';
import { resolveBrowser } from './browser.js';
import { executeE2e, resolveE2e } from './test-e2e.js';
import { resolveTests } from './test.js';
import { resolveQa } from '../agents/qa.mjs';

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough(); child.stderr = new PassThrough();
  child.exitCode = null; child.signalCode = null;
  child.kill = (signal) => { child.signalCode = signal; queueMicrotask(() => child.emit('close', 0, signal)); return true; };
  return child;
}
function recorder({ failure = -1, signalHost, signalAt = -1 } = {}) {
  const calls = [];
  return { calls, spawnImpl(command, args, options) {
    const child = fakeChild(); const index = calls.length;
    calls.push({ command, args, ...options });
    queueMicrotask(() => {
      if (index === signalAt) signalHost.emit('SIGINT');
      else { child.exitCode = index === failure ? 19 : 0; child.emit('close', child.exitCode, null); }
    });
    return child;
  } };
}

test('all browser presets preserve project, environment, and startup selection', () => {
  const expected = {
    all: { stack: true, args: ['test', '--project=client-full', '--project=chromium', '--project=performance'], env: { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } },
    smoke: { stack: true, args: ['test', 'tests/specs/client.smoke.spec.ts', 'tests/specs/admin.smoke.spec.ts', '--project=client-ci', '--project=admin-ci'], env: { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } },
    ui: { args: ['test', '--ui'], env: { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } },
    fork: { args: ['test', '--project=anvil-fork'], env: { RUN_FORK_TESTS: 'true' } },
    passkey: { args: ['test', '--project=passkey-mock'], env: {} },
    testnet: { args: ['test', '--project=testnet'], env: { TESTNET: 'true' } },
  };
  for (const [preset, wanted] of Object.entries(expected)) {
    const selected = resolveE2e(['--preset', preset, '--', '--grep', 'focus']);
    assert.equal(selected.stack, Boolean(wanted.stack));
    assert.deepEqual(selected.args, [...wanted.args, '--grep', 'focus']);
    assert.deepEqual(selected.env, { APP_ENV: 'test', ...wanted.env });
    assert.deepEqual(resolveBrowser(['e2e', '--preset', preset])[0].env, { APP_ENV: 'test' });
  }
  assert.equal(resolveE2e([]).preset, 'all');
});

test('browser route policy failure prevents builds and browser proof', async () => {
  const fake = recorder({ failure: 0 });
  assert.equal(await runCommands(resolveBrowser(['routes']), fake), 19);
  assert.equal(fake.calls.length, 1);
  assert.deepEqual(fake.calls[0].args, ['scripts/require-authenticated-browser-qa.mjs']);
});

test('browser routes build all original surfaces in order before proof', () => {
  assert.deepEqual(resolveBrowser(['routes']).map(({ args }) => args), [
    ['scripts/require-authenticated-browser-qa.mjs'],
    ['run', '--cwd', 'packages/client', 'build'], ['run', '--cwd', 'packages/admin', 'build'], ['run', '--cwd', 'docs', 'build'],
    ['scripts/agentic-browser-proof.mjs'],
  ]);
});

test('Lighthouse runs client then admin, builds each, and keeps collection client-only', () => {
  const plan = resolveBrowser(['lighthouse']);
  assert.deepEqual(plan.filter((entry) => entry.command === 'bun').map(({ args }) => args), [['run', '--cwd', 'packages/client', 'build'], ['run', '--cwd', 'packages/admin', 'build']]);
  assert.deepEqual(plan.filter((entry) => entry.command === 'node').map((entry) => entry.args.at(-1)), ['autorun', 'autorun']);
  assert.ok(plan[1].cwd.endsWith('packages/client'));
  assert.ok(plan[3].cwd.endsWith('packages/admin'));
  const collect = resolveBrowser(['lighthouse', '--app', 'client', '--action', 'collect']);
  assert.equal(collect[1].args.at(-1), 'collect');
  for (const app of ['admin', 'all']) assert.throws(() => resolveBrowser(['lighthouse', '--app', app, '--action', 'collect']), /client only/);
});

test('test runner preserves ordered stages and Turbo scope', () => {
  const plan = resolveTests([]);
  assert.deepEqual(plan.map((item) => item.args), [
    ['--bun', 'x', 'vitest', 'run', '--dir', 'scripts/agents'],
    ['run', '--cwd', 'packages/contracts', 'test'],
    ['run', '--parallel', '--filter', '@green-goods/shared', '--filter', '@green-goods/docs', 'test'],
    ['run', '--cwd', 'packages/indexer', 'test'],
    ['run', '--parallel', '--filter', '@green-goods/client', '--filter', '@green-goods/admin', '--filter', '@green-goods/agent', 'test'],
  ]);
  assert.deepEqual(resolveTests(['--cache'])[0].args, ['./node_modules/.bin/turbo', 'run', 'test', '--concurrency=2']);
  assert.deepEqual(resolveTests(['--cache', '--force'])[0].args, ['./node_modules/.bin/turbo', 'run', 'test', '--force', '--concurrency=2']);
  assert.throws(() => resolveTests(['--force']), /requires --cache/);
});

test('QA commands retain handler selection and options without importing handlers', () => {
  assert.deepEqual(resolveQa(['workbook', '--surface', 'pwa', '--local'])[0].args, ['scripts/agents/qa-workbook-build.ts', '--surface', 'pwa', '--local']);
  assert.deepEqual(resolveQa(['pull', '--run', 'run-2', '--force'])[0].args, ['scripts/agents/qa-state-pull.ts', '--run', 'run-2', '--force']);
  assert.deepEqual(resolveQa(['status', '--stale-days', '30'])[0].args, ['scripts/agents/qa-status.ts', '--stale-days', '30']);
  assert.deepEqual(resolveQa(['report', '--slug', '2026-09-13', '--public'])[0].args, ['scripts/agents/qa-report.ts', '--slug', '2026-09-13', '--public']);
});

test('help and malformed arguments resolve before any executor is created', () => {
  for (const resolve of [resolveBrowser, resolveQa, resolveTests, resolveE2e]) assert.ok(resolve(['--help']).help);
  for (const command of ['workbook', 'pull', 'status', 'report']) assert.ok(resolveQa([command, '--help']).help);
  for (const args of [['e2e', '--preset', 'unknown'], ['e2e', '--preset'], ['routes', '--surprise'], ['lighthouse', '--app', 'client', '--app', 'admin'], ['lighthouse', '--action', 'unknown']]) assert.throws(() => resolveBrowser(args));
  for (const args of [['status', '--stale-days', '0'], ['pull', '--run', 'all'], ['report'], ['pull', '--out'], ['workbook', '--unsafe']]) assert.throws(() => resolveQa(args));
  assert.throws(() => resolveTests(['unknown']));
});

test('executor preserves cwd/env/argv and fails before subsequent operations', async () => {
  const fake = recorder({ failure: 1 });
  const calls = [{ command: 'first', args: ['space value'], cwd: '/tmp/example', env: { APP_ENV: 'test' } }, { command: 'second', args: [] }, { command: 'third', args: [] }];
  assert.equal(await runCommands(calls, { ...fake, env: { EXAMPLE: 'value' } }), 19);
  assert.equal(fake.calls.length, 2);
  assert.deepEqual(fake.calls[0].env, { EXAMPLE: 'value', APP_ENV: 'test' });
  assert.equal(fake.calls[0].cwd, '/tmp/example');
  assert.equal(fake.calls[0].shell, false);
  assert.equal(fake.calls[1].cwd, REPO_ROOT);
});

test('cancellation stays terminal when interrupted process handles signal and exits zero', async () => {
  const host = new EventEmitter();
  const fake = recorder({ signalHost: host, signalAt: 0 });
  const runner = createCommandRunner({ ...fake, signalHost: host });
  try {
    assert.equal(await runner.run([{ command: 'first', args: [] }, { command: 'second', args: [] }]), 130);
    assert.equal(fake.calls.length, 1);
    assert.equal(await runner.run([{ command: 'third', args: [] }]), 130);
  } finally { runner.dispose(); }
  assert.equal(host.listenerCount('SIGINT'), 0);
  assert.equal(host.listenerCount('SIGTERM'), 0);
});

test('nonstack browser preset never starts or stops services', async () => {
  const fake = recorder();
  assert.equal(await executeE2e(resolveE2e(['--preset', 'passkey']), { ...fake, systemNode: 'node' }), 0);
  assert.equal(fake.calls.length, 1);
  assert.ok(fake.calls[0].args[0].endsWith('@playwright/test/cli.js'));
  assert.equal(fake.calls[0].env.APP_ENV, 'test');
});

test('web stack startup failure stops only its unique owner and does not run Playwright', async () => {
  const calls = [];
  let stack;
  const spawnImpl = (command, args, options) => {
    const child = fakeChild(); calls.push({ command, args, ...options });
    if (args.includes('web')) stack = child;
    else queueMicrotask(() => { child.exitCode = 0; child.emit('close', 0, null); });
    return child;
  };
  assert.equal(await executeE2e(resolveE2e([]), { spawnImpl, wait: async () => ({ ok: false }), systemNode: 'node' }), 1);
  assert.equal(stack.signalCode, 'SIGTERM');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[1].args, ['run', 'dev', '--', 'stop']);
  assert.match(calls[0].env.GREEN_GOODS_DEV_OWNER, /^e2e-/);
  assert.equal(calls[0].env.GREEN_GOODS_DEV_OWNER, calls[1].env.GREEN_GOODS_DEV_OWNER);
  assert.equal(calls[0].env.VITE_ENABLE_SW_DEV, 'true');
});

test('E2E rejects unknown flags and preset overrides before startup', () => {
  for (const rest of [['--typo'], ['--project', 'admin-ci'], ['--config=other.ts'], ['--browser', 'webkit'], ['--ui'], ['--grep'], ['--grep', '['], ['--workers', '0'], ['--shard', '3/2'], ['--trace', 'everything']]) {
    assert.throws(() => resolveE2e(['--preset', 'all', '--', ...rest]));
  }
  assert.equal(resolveE2e(['--', '--list']).stack, false);
  assert.ok(resolveE2e(['--', '--help']).help);
  assert.deepEqual(resolveE2e(['--', '--grep', 'focus']).rest, ['--grep', 'focus']);
});

test('QA pull preserves valid run selector limits and rejects zero stale days', () => {
  for (const run of ['run-0', 'run-1000000', 'run-01']) assert.throws(() => resolveQa(['pull', '--run', run]));
  assert.ok(resolveQa(['pull', '--run', 'run-999999']));
  for (const command of ['status', 'report']) assert.throws(() => resolveQa([command, ...(command === 'report' ? ['--slug', 'sample'] : []), '--stale-days', '0']));
  assert.ok(resolveQa(['status', '--stale-days', '30.0']));
});

test('reused healthy web services permit tests without acquiring cleanup rights to another owner', async () => {
  const calls = [];
  const spawnImpl = (command, args, options) => {
    const child = fakeChild(); calls.push({ command, args, ...options });
    queueMicrotask(() => { child.exitCode = 0; child.emit('close', 0, null); });
    return child;
  };
  assert.equal(await executeE2e(resolveE2e([]), { spawnImpl, wait: async () => ({ ok: true }), systemNode: 'node' }), 0);
  assert.equal(calls.length, 3);
  assert.ok(calls[1].args[0].endsWith('@playwright/test/cli.js'));
  assert.equal(calls[2].env.GREEN_GOODS_DEV_OWNER, calls[0].env.GREEN_GOODS_DEV_OWNER);
});
