import { OPERATIONS } from './operations.mjs';

// Migration/documentation tooling only. Runtime execution never looks up retired aliases.
export function migrateLegacyCommand(_scope, name, script, packageScripts) {
  const source = script;
  const forwarded = source.match(/bun (?:run )?(?:--cwd packages\/contracts )?([\w:-]+)(?:'|$|\s)/);
  if (!source.includes('bun script/') && forwarded && packageScripts[forwarded[1]]) {
    const alias = forwarded[1];
    const target = migrateLegacyCommand('package', alias, packageScripts[alias], packageScripts);
    if (!target) return null;
    return target;
  }
  const match = source.match(/(?:bun (?:--cwd packages\/contracts )?)(script\/[\w/.-]+)([^\n]*?)'?$/);
  if (!match) {
    if (source.startsWith('cat .generated/runtime/ipfs-cache.json')) return ['ipfs', 'cache'];
    if (name.startsWith('open-minting:')) return ['minting', 'open', '--network', name.split(':').at(-1), '--mode', 'broadcast'];
    return null;
  }
  const handler = match[1];
  const tokens = (match[2].replace(/'$/, '').match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g) ?? []).map((token) => token.replace(/^(['"])(.*)\1$/, '$2'));
  if (handler === 'script/deploy.ts' && tokens[0] === 'ens-migrate') return ['ens', 'migrate', '--network', 'mainnet', '--mode', tokens.includes('--broadcast') ? 'broadcast' : 'simulate'];
  if (handler === 'script/upgrade.ts' && !tokens.length) return ['upgrade', '<target>', '--network', '<network>', '--mode', '<mode>'];
  // Exact commit is deliberately explicit in the replacement rather than shell-substituted.
  const commit = tokens.indexOf('--commit');
  if (commit !== -1 && tokens[commit + 1]?.includes('git rev-parse')) tokens[commit + 1] = '<exact-commit>';
  const choices = OPERATIONS.filter((operation) => operation.handler === handler && operation.prefix.every((part, index) => tokens[index] === part));
  const operation = choices.sort((left, right) => right.prefix.length - left.prefix.length)[0];
  if (!operation) return null;
  const tail = tokens.slice(operation.prefix.length);
  const args = operation.command.split(' ');
  let network;
  const networkAt = tail.indexOf('--network');
  if (networkAt !== -1) network = tail.splice(networkAt, 2)[1];
  if (operation.network) {
    network ??= operation.networks.length === 1 ? operation.networks[0] : '<network>';
    args.push('--network', network);
  }
  if (operation.modes) {
    let mode;
    if (tail.includes('--broadcast')) mode = 'broadcast';
    else if (handler === 'script/migrate-action-instructions-v2.ts' && tail.includes('--preflight-only')) { args.splice(2, 0, 'check'); mode = 'simulate'; }
    else if (tail.includes('--pure-simulation') || ['script/upgrade.ts', 'script/repair-octant-assets.ts', 'script/migrate-action-instructions-v2.ts'].includes(handler) && tail.includes('--dry-run')) mode = 'preflight';
    else if (tail.includes('--tx-plan')) mode = 'plan';
    else if (tail.includes('--upload-only')) mode = 'upload';
    else if (tail.includes('--dry-run')) mode = Object.hasOwn(operation.modes, 'simulate') ? 'simulate' : 'preflight';
    else if (!operation.modeOptional) mode = Object.keys(operation.modes).length === 1 ? Object.keys(operation.modes)[0] : network === '<network>' ? '<mode>' : 'simulate';
    if (mode) args.push('--mode', mode);
  }
  const modeFlags = ['--broadcast', '--dry-run', '--pure-simulation', '--preflight-only', '--tx-plan', '--upload-only'];
  args.push(...tail.filter((token) => !modeFlags.includes(token)));
  return args;
}
