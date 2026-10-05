#!/usr/bin/env node
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { createCommandRunner, isDirectRun, parseOptions, REPO_ROOT } from '../lib/command-runner.mjs';
import { findSystemNode } from '../lib/dev-shared.js';

// Use Playwright's CI server lifecycle, never the live-development PM2 profile.
const testServers = { PLAYWRIGHT_PWA_PREVIEW: 'false', SKIP_WEBSERVER: 'false', SKIP_HEALTH_CHECK: 'false', SKIP_INDEXER: 'true' };
const presets = {
  all: { env: testServers, args: ['test', '--project=client-full', '--project=chromium', '--project=performance'] },
  smoke: { env: testServers, args: ['test', 'tests/specs/client.smoke.spec.ts', 'tests/specs/admin.smoke.spec.ts', '--project=client-ci', '--project=admin-ci'] },
  ui: { args: ['test', '--ui'], env: { SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true' } },
  fork: { args: ['test', '--project=anvil-fork'], env: { RUN_FORK_TESTS: 'true', SKIP_WEBSERVER: 'true', SKIP_HEALTH_CHECK: 'true', SKIP_INDEXER: 'true' } },
  passkey: { env: testServers, args: ['test', '--project=passkey-mock'] },
  explore: { env: testServers, args: ['test', '--project=work-exploration'] },
  'pwa-preview': { env: { ...testServers, CI: 'true', PLAYWRIGHT_PWA_PREVIEW: 'true' }, args: ['test', '--project=pwa-preview'] },
  testnet: { args: ['test', '--project=testnet'], env: { TESTNET: 'true' } },
};

// Playwright treats bare tokens as test-file filters and --grep values as regular expressions.
// Malformed patterns should fail before Playwright boots its test servers. Compiling the pattern to test it would
// build a regular expression out of argv, so instead this scans for the three defects that actually
// come from a typo: an unbalanced group, an unterminated character class, and a trailing backslash.
// The scan tracks escapes and character classes, so it never rejects a valid pattern; exotic invalid
// patterns Playwright still reports itself.
const MAX_PATTERN_LENGTH = 512;

export function assertUsablePattern(pattern, invalidMessage) {
  if (pattern.length > MAX_PATTERN_LENGTH) throw new Error(`${invalidMessage} (limit ${MAX_PATTERN_LENGTH} characters)`);
  let depth = 0;
  let escaped = false;
  let inClass = false;
  for (const character of pattern) {
    if (escaped) escaped = false;
    else if (character === '\\') escaped = true;
    else if (inClass) inClass = character !== ']';
    else if (character === '[') inClass = true;
    else if (character === '(') depth += 1;
    else if (character === ')' && (depth -= 1) < 0) throw new Error(invalidMessage);
  }
  if (depth !== 0 || escaped || inClass) throw new Error(invalidMessage);
}

export function validatePlaywrightArgs(args, preset) {
  const boolean = new Set(['--fail-on-flaky-tests', '--forbid-only', '--fully-parallel', '--headed', '--ignore-snapshots', '--last-failed', '--list', '--no-deps', '--pass-with-no-tests', '--quiet', '-x', '--help', '-h']);
  const values = new Set(['--grep', '-g', '--global-timeout', '--grep-invert', '--workers', '-j', '--max-failures', '--output', '--repeat-each', '--reporter', '--retries', '--run-agents', '--shard', '--test-list', '--test-list-invert', '--timeout', '--trace', '--tsconfig', '--ui-host', '--ui-port', '--update-source-method']);
  const optional = new Set(['--debug', '--only-changed', '--update-snapshots', '-u']);
  const choices = { '--trace': ['on', 'off', 'on-first-retry', 'on-all-retries', 'retain-on-failure', 'retain-on-first-failure', 'retain-on-failure-and-retries'], '--run-agents': ['missing', 'all', 'none'], '--update-source-method': ['overwrite', '3way', 'patch'], '--debug': ['inspector', 'cli'], '--update-snapshots': ['all', 'changed', 'missing', 'none'], '-u': ['all', 'changed', 'missing', 'none'] };
  const seen = new Set();
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith('-')) { assertUsablePattern(token, `Invalid test-file filter: ${token}`); continue; }
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
    if (['--grep', '-g', '--grep-invert'].includes(flag)) assertUsablePattern(value, `Invalid ${flag} regular expression`);
    if (['--ui-host', '--ui-port'].includes(flag) && preset !== 'ui') throw new Error(`${flag} requires --preset ui`);
  }
  return { list: seen.has('--list'), help: seen.has('--help') };
}

export function resolveE2e(argv) {
  const options = parseOptions(argv, { flags: ['--help', '-h'], values: ['--preset', '--seed'], passthrough: true });
  if (options['--help'] || options['-h']) return { help: 'Usage: bun run browser e2e [--preset all|smoke|ui|fork|passkey|explore|pwa-preview|testnet] [--seed <1..4294967295> (explore only)] [-- <Playwright arguments>]\nDefault: all. all/smoke use isolated Playwright-owned test servers; ui/fork use caller-managed services; fork fixtures own Anvil.' };
  const preset = options['--preset'] || 'all';
  if (!Object.hasOwn(presets, preset)) throw new Error(`Unknown E2E preset: ${preset}`);
  const selection = presets[preset];
  if (options['--seed'] !== undefined && preset !== 'explore') throw new Error('--seed requires --preset explore');
  const seed = options['--seed'] ?? process.env.GG_BROWSER_SEED ?? '17';
  if (preset === 'explore' && (!/^[1-9]\d*$/.test(seed) || Number(seed) > 0xffffffff)) throw new Error('--seed must be an integer from 1 to 4294967295');
  const qualified = ['passkey', 'explore', 'pwa-preview'].includes(preset);
  if (qualified) {
    // Qualification is a complete, zero-retry scenario. Diagnostic flags cannot narrow its proof.
    const permitted = new Set(['--workers', '-j', '--reporter', '--output', '--trace', '--headed', '--list', '--help', '-h', '--retries']);
    const args = options.rest || [];
    for (let i = 0; i < args.length; i++) {
      const [flag, value] = args[i].split('=');
      if (!permitted.has(flag)) throw new Error(`Argument ${args[i]} cannot alter qualified proof`);
      if (['--headed', '--list', '--help', '-h'].includes(flag)) continue;
      const actual = value ?? args[++i];
      if (flag === '--reporter' && !actual?.split(',').includes('json')) throw new Error('JSON reporting is required for qualified proof');
      if (flag === '--retries' && actual !== '0') throw new Error('Retries cannot alter qualified proof');
    }
  }
  const downstream = validatePlaywrightArgs(options.rest || [], preset);
  if (downstream.help) return resolveE2e(['--help']);
  const reportPath = qualified ? path.resolve(REPO_ROOT, process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || `.cache/validation/browser-${preset}/results.json`) : null;
  return { preset, reportPath, verify: qualified && !downstream.list, stack: false, rest: options.rest || [], args: [...selection.args, ...(qualified ? ['--retries=0', '--max-failures=1', '--global-timeout=300000', '--reporter=line,json'] : []), ...(options.rest || [])], env: { APP_ENV: 'test', ...selection.env, ...(qualified ? { CI: 'true', PLAYWRIGHT_QUALIFIED: 'true', PLAYWRIGHT_JSON_OUTPUT_FILE: reportPath } : {}), ...(preset === 'explore' ? { GG_BROWSER_SEED: seed } : {}) } };
}

export function assertQualifiedReport(report, preset, startedAt) {
  const expected = { passkey: ['passkey-mock', 1], explore: ['work-exploration', 2], 'pwa-preview': ['pwa-preview', 1] }[preset];
  const stats = report?.stats;
  if (!Number.isFinite(Date.parse(stats?.startTime)) || Date.parse(stats.startTime) < startedAt) throw new Error(`Qualified ${preset} proof report is stale or missing`);
  const collect = suites => (suites ?? []).flatMap(suite => [...(suite.specs ?? []).flatMap(spec => spec.tests ?? []), ...collect(suite.suites)]);
  const tests = collect(report.suites);
  if (!expected || stats.expected !== expected[1] || stats.skipped !== 0 || stats.unexpected !== 0 || stats.flaky !== 0 || report.errors?.length || tests.length !== expected[1] || tests.some(test => test.projectName !== expected[0] || test.results?.length !== 1 || test.results[0].status !== 'passed' || test.results[0].retry !== 0)) {
    throw new Error(`Qualified ${preset} proof is incomplete: every required scenario must pass once without skips or retries`);
  }
}

export async function executeE2e(selection, dependencies = {}) {
  const runner = createCommandRunner(dependencies);
  try {
    const systemNode = dependencies.systemNode || findSystemNode() || process.execPath;
    const startedAt = Date.now();
    const code = await runner.run([{ command: systemNode, args: [path.join(REPO_ROOT, 'node_modules/@playwright/test/cli.js'), ...selection.args], env: selection.env }]);
    if (code === 0 && selection.verify) {
      assertQualifiedReport(JSON.parse(readFileSync(selection.reportPath, 'utf8')), selection.preset, startedAt);
    }
    return code;
  } finally {
    // Playwright owns and tears down its server process groups, including on cancellation.
    runner.dispose();
  }
}
if (isDirectRun(import.meta.url)) {
  try { const plan = resolveE2e(process.argv.slice(2)); if (plan.help) console.log(plan.help); else process.exitCode = await executeE2e(plan); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
