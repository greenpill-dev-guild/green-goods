import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { executeOperation } from './execute.mjs';
import { migrateLegacyCommand } from './migration.mjs';
import { explainOperation, OPERATIONS, OPERATOR, PACKAGE_ROOT, resolveCommand, resolveMintingTransaction, resolveOperatorBoundary } from './operations.mjs';

const resolve = (text) => resolveCommand(text.split(' '));
test('standalone reporting policy separates offline, RPC, keystore broadcast and reconciliation', () => {
  const preflight = resolve('deploy single-attestation-policy --network arbitrum --mode preflight');
  assert.deepEqual(preflight.args, ['script/deploy/single-attestation-policy.ts', 'deploy', '--network', 'arbitrum', '--preflight']);
  assert.ok(!preflight.capabilities.includes('configured RPC'));
  assert.ok(resolve('deploy single-attestation-policy --network arbitrum --mode simulate').args.includes('--simulate'));
  assert.throws(() => resolve('deploy single-attestation-policy --network arbitrum --mode broadcast'), /expected-nonce/);
  assert.throws(() => resolve('deploy single-attestation-policy --network arbitrum --mode plan --expected-nonce 0'), /sender/);
  assert.throws(() => resolve('deploy single-attestation-policy --network arbitrum --mode broadcast --expected-nonce 0 --private-key secret'), /Unknown/);
  const broadcast = resolve('deploy single-attestation-policy --network arbitrum --mode broadcast --expected-nonce 0');
  assert.equal(broadcast.env.FOUNDRY_KEYSTORE_ACCOUNT, 'green-goods-deployer');
  assert.equal(broadcast.env.PINATA_JWT, '');
  assert.equal(broadcast.env.PINATA_GATEWAY, '');
  assert.deepEqual(resolve('verify single-attestation-policy --network arbitrum').args, ['script/deploy/single-attestation-policy.ts', 'verify', '--network', 'arbitrum']);
  const published = resolve('verify single-attestation-policy --network arbitrum --publish-source');
  assert.deepEqual(published.args, ['script/deploy/single-attestation-policy.ts', 'verify', '--network', 'arbitrum', '--publish-source']);
  assert.ok(published.capabilities.includes('explorer API key'));
  assert.ok(!published.capabilities.includes('authorized signer'));
  assert.throws(() => resolve('verify single-attestation-policy --network localhost --publish-source'), /explorer/);
  assert.throws(() => resolve('deploy single-attestation-policy --network arbitrum --mode preflight --publish-source'), /Unknown/);
  assert.deepEqual(resolve('verify reporting-kernel --network arbitrum --mode simulate').args, ['script/reporting-kernel-compatibility.ts', '--network', 'arbitrum', '--simulate']);
  assert.throws(() => resolve('verify reporting-kernel --network arbitrum --mode broadcast'), /Unsupported mode/);
});
test('help and explain run in a fresh process without handler imports or env loading', () => {
  for (const args of [['help'], ['deploy', 'core', '--network', 'arbitrum', '--mode', 'preflight', '--explain', '--json']]) {
    const result = spawnSync(process.execPath, ['script/cli.mjs', ...args], { cwd: PACKAGE_ROOT, env: { PATH: process.env.PATH }, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Green Goods|deploy core/);
  }
});
test('minting retains its exact transaction signature, deployment account and RPC argument', () => {
  const address = `0x${'1'.repeat(40)}`;
  assert.deepEqual(resolveMintingTransaction('arbitrum', address, 'https://rpc.invalid'), { command: 'cast', args: ['send', address, 'setOpenMinting(bool)', 'true', '--rpc-url', 'https://rpc.invalid', '--account', 'green-goods-deployer'] });
  assert.throws(() => resolveMintingTransaction('celo', address, 'https://rpc.invalid'), /supported network/);
  assert.throws(() => resolveMintingTransaction('arbitrum', `0x${'0'.repeat(40)}`, 'https://rpc.invalid'), /GardenToken/);
  assert.throws(() => resolveMintingTransaction('arbitrum', address, ''), /Missing/);
});
test('deployment and upgrade simulation preserve different underlying flags', () => {
  assert.deepEqual(resolve('deploy core --network arbitrum --mode simulate').args, ['script/deploy.ts', 'core', '--network', 'arbitrum', '--dry-run']);
  const upgrade = resolve('upgrade all --network arbitrum --mode simulate');
  assert.deepEqual(upgrade.args, ['script/upgrade.ts', 'all', '--network', 'arbitrum']);
  assert.equal(upgrade.cwd, PACKAGE_ROOT);
  assert.equal(upgrade.env.FOUNDRY_KEYSTORE_ACCOUNT, 'green-goods-deployer');
});
test('specialist dry modes cannot be mistaken for RPC simulation', () => {
  for (const command of ['deploy octant-factory', 'repair octant-assets']) {
    assert.ok(!resolve(`${command} --network arbitrum --mode simulate`).args.includes('--dry-run'));
    assert.ok(resolve(`${command} --network arbitrum --mode preflight`).args.includes('--pure-simulation'));
  }
  assert.throws(() => resolve('deploy greenwill --network arbitrum --mode preflight'), /Unsupported mode/);
  assert.throws(() => resolve('deploy badge-locks --network arbitrum --mode simulate'), /Unsupported mode/);
  assert.throws(() => resolve('deploy core --network arbitrum --mode plan'), /Unsupported mode/);
});
test('migration local previews, live capability check and uploads remain distinct', () => {
  assert.ok(resolve('migrate action-instructions-v2 --network arbitrum --mode preflight').args.includes('--dry-run'));
  assert.ok(resolve('migrate action-instructions-v2 check --network arbitrum --mode simulate').args.includes('--preflight-only'));
  assert.ok(resolve('migrate action-instructions-v2 --network arbitrum --mode upload').args.includes('--upload-only'));
  assert.throws(() => resolve('migrate action-instructions-v2 --network arbitrum --mode simulate'), /Unsupported mode/);
});
test('invalid arguments fail before child execution', () => {
  for (const command of [
    'deploy core --mode simulate', 'upgrade all --network arbitrum',
    'deploy core --network arbitrum --mode broadcast --dry-run',
    'deploy core --network arbitrum --mode simulate unexpected',
    'deploy core --network', 'verify --network arbitrum --bogus',
    'verify --network arbitrum --network celo', 'verify --network arbitrum --json',
    'upgrade all --network arbitrum --mode plan --step 0',
    'settlement garden-roles plan --network celo --step 1',
    'settlement garden-accounts plan --network celo --inventory foo',
    'pooling backfill --network celo --mode simulate',
    'ens sponsor top-up --network arbitrum --mode simulate',
    'ens migrate --network mainnet --mode preflight',
  ]) assert.throws(() => resolve(command), undefined, command);
});
test('Hats and assessment mandatory safeguards remain ordered', () => {
  const hats = resolve('upgrade hats-module --network arbitrum --mode broadcast');
  assert.deepEqual(hats.checks.map((check) => [check.command, ...check.args]), [['bash', 'script/check-storage-layout.sh', '--contract', 'HatsModule'], ['bun', 'script/utils/fork-shards.mjs', 'run', 'hats-module-upgrade-arbitrum']]);
  assert.ok(hats.args.includes(OPERATOR));
  assert.deepEqual(resolve('upgrade assessment-resolver --network arbitrum --mode broadcast').checks.map((check) => check.args), [['run', 'check:storage-layout']]);
});
test('CookieJarModule upgrade is storage-gated and rehearsed against live Arbitrum before broadcast', () => {
  const jars = resolve('upgrade cookie-jar-module --network arbitrum --mode broadcast');
  assert.deepEqual(jars.checks.map((check) => [check.command, ...check.args]), [['bash', 'script/check-storage-layout.sh', '--contract', 'CookieJarModule'], ['bun', 'script/utils/fork-shards.mjs', 'run', 'cookie-jar-module-upgrade-arbitrum']]);
  assert.ok(jars.args.includes(OPERATOR));
  assert.deepEqual(resolve('upgrade cookie-jar-module --network arbitrum --mode simulate').checks, []);
  assert.deepEqual(resolve('upgrade cookie-jar-module --network sepolia --mode broadcast').checks.map((check) => check.args), [['script/check-storage-layout.sh', '--contract', 'CookieJarModule']]);
});
test('operator boundary resolution is fixed and cannot recurse or override network', () => {
  const roles = resolveOperatorBoundary('garden-roles', ['--plan', 'reviewed.json', '--step', '1', '--broadcast', 'true']);
  assert.deepEqual(roles.args, ['script/deploy/garden-roles.ts', 'deploy', '--broadcast', '--plan', 'reviewed.json', '--step', '1']);
  assert.throws(() => resolveOperatorBoundary('garden-roles', ['--step', '1', '--network', 'mainnet']), /override/);
  assert.throws(() => resolveOperatorBoundary('garden-roles', ['--step', '1', '--broadcast', 'false']), /override/);
  assert.throws(() => resolveOperatorBoundary('arbitrary', []), /Unknown/);
});
test('release sessions keep an explicit exact commit and strict flags', () => {
  assert.throws(() => resolve('release operator --stage garden-roles'), /commit/);
  assert.throws(() => resolve('release operator --commit HEAD'), /40-character/);
  const session = resolve(`release operator --stage garden-roles --commit ${'a'.repeat(40)}`);
  assert.equal(session.args[0], 'script/release-operator.ts');
  // The session's own process, and the keystore check it starts first, get no upload credentials.
  assert.equal(session.env.PINATA_JWT, '');
  assert.equal(session.env.PINATA_GATEWAY, '');
  // The capability check shares the keystore default and keeps the caller's upload credentials.
  const capabilityCheck = resolve('migrate action-instructions-v2 check --network arbitrum --mode simulate');
  assert.equal(capabilityCheck.env.FOUNDRY_KEYSTORE_ACCOUNT, 'green-goods-deployer');
  assert.ok(!('PINATA_JWT' in capabilityCheck.env));
});
test('repeatable selection filters survive forwarding; explanations redact all supplied values', () => {
  const resolution = resolve('migrate action-instructions-v2 --network arbitrum --mode preflight --slug first --slug second --rpc-url https://secret.invalid/token');
  assert.equal(resolution.args.filter((arg) => arg === '--slug').length, 2);
  assert.ok(resolution.args.includes('second'));
  assert.doesNotMatch(JSON.stringify(explainOperation(resolution)), /secret.invalid|first|second/);
});
function fakeRunner(exitCodes, hook) {
  const calls = [];
  return { calls, spawnImpl(command, args, options) {
    const child = new EventEmitter(); child.kill = (signal) => calls.push({ signal });
    calls.push({ command, args, options });
    queueMicrotask(() => { hook?.(); child.emit('exit', exitCodes.shift() ?? 0, null); });
    return child;
  } };
}
test('a failed mandatory check stops before broadcast and preserves failure code', async () => {
  const runner = fakeRunner([7]);
  const result = await executeOperation(resolve('upgrade hats-module --network arbitrum --mode broadcast'), { ...runner, env: { TEST_VALUE: 'retained', FOUNDRY_KEYSTORE_ACCOUNT: 'caller-account' } });
  assert.equal(result.code, 7);
  assert.equal(runner.calls.length, 1);
  assert.equal(runner.calls[0].options.shell, false);
  assert.equal(runner.calls[0].options.env.TEST_VALUE, 'retained');
  assert.equal(runner.calls[0].options.env.FOUNDRY_KEYSTORE_ACCOUNT, 'green-goods-deployer');
});
test('successful checks execute handler only after all checks', async () => {
  const runner = fakeRunner([0, 0, 0]);
  const result = await executeOperation(resolve('upgrade hats-module --network sepolia --mode broadcast'), { ...runner, env: {} });
  assert.equal(result.code, 0);
  assert.equal(runner.calls.length, 3);
  assert.equal(runner.calls[2].args[0], 'script/upgrade.ts');
});
test('cancellation remains terminal even when a child handles signal and exits zero', async () => {
  const signalHost = new EventEmitter();
  const runner = fakeRunner([0], () => signalHost.emit('SIGINT'));
  const result = await executeOperation(resolve('upgrade hats-module --network arbitrum --mode broadcast'), { ...runner, signalHost, env: {} });
  assert.equal(result.code, 130);
  assert.equal(runner.calls.filter((call) => call.args).length, 1);
  assert.equal(signalHost.listenerCount('SIGINT'), 0);
});
test('legacy compound upgrade keeps handler identity rather than migrating prerequisite', () => {
  const scripts = { 'check:storage-layout': 'bash check.sh' };
  assert.deepEqual(migrateLegacyCommand('package', 'assessment:upgrade:arbitrum', 'bun run check:storage-layout && bun script/upgrade.ts assessment-resolver --network arbitrum --broadcast', scripts), ['upgrade', 'assessment-resolver', '--network', 'arbitrum', '--mode', 'broadcast']);
});
test('legacy live migration preflight becomes an explicit check subcommand', () => {
  const args = migrateLegacyCommand('package', 'migrate:action-instructions:v2:preflight:arbitrum', 'bun script/migrate-action-instructions-v2.ts --network arbitrum --preflight-only', {});
  assert.equal(resolveCommand(args).operation, 'migrate action-instructions-v2 check');
});
test('definitions are unique and every handler is package owned', () => {
  assert.equal(new Set(OPERATIONS.map((operation) => operation.command)).size, OPERATIONS.length);
  assert.ok(OPERATIONS.every((operation) => operation.handler.startsWith('script/') && !operation.handler.includes('..')));
});

const migration = JSON.parse(readFileSync(new URL('../../config/command-migration.json', import.meta.url), 'utf8'));
function resolveMigration(entry) {
  const args = entry.cliArgs.map((arg) => arg === '<network>' ? 'arbitrum' : arg === '<target>' ? 'all' : arg === '<exact-commit>' ? 'a'.repeat(40) : arg);
  const operation = [...OPERATIONS].sort((left, right) => right.command.length - left.command.length).find((candidate) => candidate.command.split(' ').every((part, index) => args[index] === part));
  assert.ok(operation, `Missing operation for ${entry.name}`);
  const mode = args.indexOf('<mode>');
  if (mode !== -1) args[mode] = Object.keys(operation.modes)[0];
  // Old wrappers also required boundary inputs from the operator; provide inert values only for pure resolution.
  const evidence = { 'expected-nonce': '0', step: '1', receipt: `0x${'a'.repeat(64)}`, commit: 'a'.repeat(40) };
  for (let attempt = 0; attempt <= Object.keys(evidence).length; attempt++) {
    try { return resolveCommand(args); } catch (error) {
      const missing = Object.keys(evidence).find((key) => error.message.includes(`--${key}`) && !args.includes(`--${key}`));
      if (!missing) throw new Error(`${entry.name}: ${error.message}`, { cause: error });
      args.push(`--${missing}`, evidence[missing]);
    }
  }
  throw new Error(`Could not resolve ${entry.name}`);
}
test('every recorded contract alias resolves and has been removed from its manifest', () => {
  const root = JSON.parse(readFileSync(new URL('../../../../package.json', import.meta.url), 'utf8')).scripts;
  const contracts = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')).scripts;
  const entries = migration.entries.filter((entry) => entry.cliArgs);
  assert.equal(entries.length, 264);
  for (const entry of entries) {
    assert.equal(Object.hasOwn(entry.scope === 'root' ? root : contracts, entry.name), false, `${entry.scope}:${entry.name} remains runnable`);
    const resolution = resolveMigration(entry);
    assert.equal(resolution.cwd, PACKAGE_ROOT);
    assert.equal(resolution.command, 'bun');
  }
});
test('recorded operator environment policies survive consolidation', () => {
  for (const entry of migration.entries.filter((entry) => entry.scope === 'root' && entry.cliArgs)) {
    const resolution = resolveMigration(entry);
    for (const match of entry.original.command.matchAll(/(?:^|\s)([A-Z][A-Z_]+)=([^\s]*)/g)) {
      assert.ok(resolution.env[match[1]] === match[2] || match[2] !== '' && resolution.args.includes(match[2]), `${entry.name} lost ${match[1]}`);
    }
  }
});
test('legacy direct handler identity and mandatory checks survive consolidation', () => {
  for (const entry of migration.entries.filter((entry) => entry.cliArgs)) {
    const handler = entry.original.command.match(/bun (?:--cwd packages\/contracts )?(script\/[\w/.-]+)(?:\s|$)/)?.[1];
    if (!handler) continue;
    const resolution = resolveMigration(entry);
    const ensMigration = handler === 'script/deploy.ts' && entry.original.command.includes(' ens-migrate');
    assert.equal(resolution.args[0], ensMigration ? 'script/upgrade-ens-receiver.ts' : handler, entry.name);
    if (entry.name === 'upgrade:hats-module:sepolia' || entry.name === 'upgrade:hats-module:arbitrum') {
      assert.deepEqual([resolution.checks[0].command, ...resolution.checks[0].args], ['bash', 'script/check-storage-layout.sh', '--contract', 'HatsModule']);
      assert.equal(resolution.checks[1].args[0], 'script/utils/fork-shards.mjs');
    } else if (entry.original.command.includes('bun run check:storage-layout')) assert.equal(resolution.checks[0].args[1], 'check:storage-layout');
    if (entry.original.command.includes('UPGRADE_PLAN_OUTPUT_DIR=')) assert.equal(resolution.env.UPGRADE_PLAN_OUTPUT_DIR, '.generated/release-upgrades');
  }
});

test('release boundaries share the operator allowlist and require ownership boundary identity', () => {
  assert.throws(() => resolveOperatorBoundary('ownership-arbitrum', ['--step', '1', '--expected-nonce', '0', '--force', 'true']), /override/);
  assert.throws(() => resolveOperatorBoundary('ownership-arbitrum', ['--step', '1']), /expected-nonce/);
  assert.throws(() => resolveOperatorBoundary('garden-roles-enable', ['--safe-plan', 'unexpected.json', '--step', '1']), /override/);
  assert.throws(() => resolveOperatorBoundary('garden-roles', ['--step']), /requires a value/);
  assert.equal(resolveOperatorBoundary('ownership-arbitrum', ['--step', '1', '--expected-nonce', '0']).mode, 'broadcast');
});

test('release explanation discloses the credential session and transaction boundaries without execution', () => {
  const explanation = explainOperation(resolve(`release operator --commit ${'a'.repeat(40)} --explain`));
  assert.ok(explanation.capabilities.includes('authorized keystore credential session'));
  assert.ok(explanation.effects.some((effect) => effect.includes('broadcast')));
  assert.ok(explanation.safeguards.includes('ordered boundaries with nonce/receipt binding'));
});

test('ordinary replacements retain native commands, runner arguments and explicit environment', () => {
  const rootUrl = new URL('../../../../', import.meta.url);
  for (const entry of migration.entries.filter((item) => !item.cliArgs)) {
    const match = entry.replacement.match(/^(?:(APP_ENV=development) )?bun run (?:--cwd ([\w/.-]+) )?([\w:-]+)(.*)$/);
    if (!match) {
      assert.equal(entry.replacement, entry.original.command, entry.name);
      continue;
    }
    const [, environment, directory = '', command, suffix] = match;
    const manifest = JSON.parse(readFileSync(new URL(`${directory ? `${directory}/` : ''}package.json`, rootUrl), 'utf8'));
    assert.ok(Object.hasOwn(manifest.scripts, command), entry.name);
    if (command === 'contracts') resolveCommand(suffix.trim().split(/\s+/));
    const forwarding = entry.original.command.match(/^cd ([\w/.-]+) && bun run ([\w:-]+)$/);
    if (forwarding && forwarding[2] === command) assert.deepEqual([directory, command, suffix], [forwarding[1], forwarding[2], ''], entry.name);
    if (entry.scope === 'contracts') {
      const args = suffix.trim().replace(/^-- /, '');
      assert.equal(`${manifest.scripts[command]} ${args}`.trim(), entry.original.command, entry.name);
    }
    if (entry.original.command.startsWith('APP_ENV=development')) {
      assert.ok(environment || manifest.scripts[command].startsWith('APP_ENV=development'), entry.name);
    }
  }
});

test('network-scoped chain selections cannot conflict before execution', () => {
  assert.throws(() => resolve('verify --network arbitrum --chain-id 1'), /conflicts/);
  assert.throws(() => resolve('verify --network arbitrum --chain-id nope'), /positive safe integer/);
  assert.ok(resolve('verify --network arbitrum --chain-id 42161').args.includes('42161'));
});

test('voucher release preparation separates offline planning from isolated simulation and has no broadcast mode', () => {
  const preflight = resolve('release vouchers --mode preflight');
  assert.equal(preflight.network, undefined);
  assert.deepEqual(preflight.args, ['script/deploy/voucher-release.ts', '--preflight']);
  assert.ok(!preflight.capabilities.includes('configured RPC'));
  assert.ok(resolve('release vouchers --mode plan').args.includes('--plan-only'));
  const simulation = resolve('release vouchers --mode simulate --plan .generated/voucher-release/pilot.plan.json');
  assert.ok(simulation.capabilities.includes('owned isolated Anvil forks'));
  assert.ok(!simulation.capabilities.includes('authorized signer'));
  for (const suffix of ['--mode broadcast', '--mode simulate --private-key secret', '--mode preflight --network gnosis', '--mode preflight --rpc-url https://rpc.invalid', '--mode preflight --mode plan']) {
    assert.throws(() => resolve(`release vouchers ${suffix}`));
  }
});

test('steward Safe release prepares roster-driven custody without a broadcast path', () => {
  const preflight = resolve('release steward-safe --mode preflight');
  assert.deepEqual(preflight.args, ['script/deploy/steward-safe-release.ts', '--preflight']);
  assert.match(preflight.safeguards[0], /^roster-driven threshold: one valid steward signs alone, two or more need two signatures;/);
  assert.ok(resolve('release steward-safe --mode plan').args.includes('--plan-only'));
  assert.ok(resolve('release steward-safe --mode simulate --plan .generated/steward-safe/pilot.plan.json').args.includes('--simulate'));
  for (const suffix of ['--mode broadcast', '--mode preflight --private-key secret', '--mode plan --network gnosis', '--mode preflight --rpc-url https://rpc.invalid']) {
    assert.throws(() => resolve(`release steward-safe ${suffix}`));
  }
});

test('CLC and source upgrade preparation expose only their owned fork modes', () => {
  for (const [command, handler, rpc] of [
    ['clc', 'clc-release.ts', 'Gnosis RPC'],
    ['source-upgrades', 'source-upgrade-release.ts', 'Arbitrum RPC'],
  ]) {
    const preflight = resolve(`release ${command} --mode preflight`);
    assert.deepEqual(preflight.args, [`script/deploy/${handler}`, '--preflight']);
    assert.equal(preflight.network, undefined);
    assert.ok(!preflight.capabilities.includes(rpc));
    assert.ok(resolve(`release ${command} --mode plan`).args.includes('--plan-only'));
    const simulation = resolve(`release ${command} --mode simulate --plan .generated/example.plan.json`);
    assert.ok(simulation.capabilities.includes(rpc));
    assert.ok(simulation.capabilities.includes('owned isolated Anvil forks'));
    assert.ok(!simulation.capabilities.includes('authorized signer'));
    for (const suffix of ['--mode broadcast', '--mode simulate', '--mode preflight --plan unwanted.json', '--mode plan --plan unwanted.json', '--mode preflight --output unwanted.json', '--mode preflight --network gnosis', '--mode preflight --rpc-url https://rpc.invalid', '--mode plan --private-key secret']) {
      assert.throws(() => resolve(`release ${command} ${suffix}`));
    }
  }
  const members = resolve('release clc --mode simulate --members config/member-extension.json --plan .generated/clc-release/member.plan.json --receipts .generated/clc-release/member.receipts.json');
  assert.ok(members.args.includes('--members'));
  assert.ok(members.args.includes('--receipts'));
  assert.ok(!members.capabilities.includes('authorized signer'));
  assert.throws(() => resolve('release clc --mode preflight --receipts .generated/clc-release/receipt.json'), /simulate mode/);
  assert.ok(resolve('release pilot --mode preflight --clc-members config/member-extension.json').args.includes('--clc-members'));
});

test('live pilot packaging requires four component plans and has no compound simulator', () => {
  assert.deepEqual(resolve('release pilot --mode preflight').args, ['script/deploy/live-pilot-package.ts', '--preflight']);
  const inputs = '--source-upgrades-plan source.json --steward-safe-plan steward.json --vouchers-plan vouchers.json --clc-plan clc.json';
  const planned = resolve(`release pilot --mode plan ${inputs} --output .generated/live-pilot/pilot.json`);
  assert.equal(planned.args[0], 'script/deploy/live-pilot-package.ts');
  assert.ok(planned.args.includes('--plan-only'));
  assert.ok(!planned.capabilities.some((capability) => /RPC|signer|fork/.test(capability)));
  for (const suffix of ['--mode plan', '--mode plan --clc-plan clc.json', '--mode preflight --clc-plan clc.json', '--mode preflight --output unwanted.json', '--mode simulate', '--mode broadcast', '--mode preflight --private-key secret', '--mode preflight --network gnosis']) {
    assert.throws(() => resolve(`release pilot ${suffix}`));
  }
});

test('CLC and pilot handlers reject unsafe paths and modes before compilation', () => {
  for (const [handler, args, expected] of [
    ['clc-release.ts', ['--preflight', '--plan', 'unexpected.json'], /exactly one CLC release mode/],
    ['clc-release.ts', ['--preflight', '--manifest', '../outside.json'], /owned JSON directory/],
    ['clc-release.ts', ['--simulate', '--plan', '.generated/voucher-release/foreign.json'], /owned JSON directory/],
    ['clc-release.ts', ['--preflight', '--rpc-url', 'https://rpc.invalid'], /Unknown option/],
    ['clc-release.ts', ['--preflight', '--receipts', '.generated/clc-release/member.receipts.json'], /exactly one CLC release mode/],
    ['clc-release.ts', ['--preflight', '--members', '../outside.json'], /owned JSON directory/],
    ['clc-release.ts', ['--simulate', '--plan', '.generated/clc-release/member.plan.json', '--receipts', '.generated/clc-release/receipt.json', '--output', '.generated/clc-release/RECEIPT.json'], /cannot overwrite/],
    ['live-pilot-package.ts', ['--preflight', '--manifest', '../outside.json'], /owned JSON directory/],
    ['live-pilot-package.ts', ['--preflight', '--clc-plan', 'unexpected.json'], /plan mode requires all four/],
    ['live-pilot-package.ts', ['--plan-only'], /plan mode requires all four/],
    ['live-pilot-package.ts', ['--simulate'], /Unknown option/],
  ]) {
    const result = spawnSync('bun', ['--no-env-file', `script/deploy/${handler}`, ...args], { cwd: PACKAGE_ROOT, env: { PATH: process.env.PATH }, encoding: 'utf8' });
    assert.equal(result.status, 1, result.stdout);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, expected);
  }
});

test('pilot preflight reports pending inputs without RPC credentials or compilation', () => {
  const result = spawnSync('bun', ['--no-env-file', 'script/deploy/live-pilot-package.ts', '--preflight'], { cwd: PACKAGE_ROOT, env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.state, 'preflight');
  assert.equal(report.compilationIncluded, false);
  assert.equal(report.liveBroadcast, false);
  assert.equal(report.activationIncluded, false);
  assert.ok(report.deploymentMissing.includes('clc.techAndSunSafe'));
  assert.ok(report.activationMissing.includes('live.sameAddressMemberSigningCeremony'));
});
