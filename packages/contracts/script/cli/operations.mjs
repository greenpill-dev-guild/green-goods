import { fileURLToPath } from 'node:url';

export const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const OPERATOR = '0xFBAf2A9734eAe75497e1695706CC45ddfA346ad6';
export function resolveMintingTransaction(network, gardenToken, rpc) {
  if (!['sepolia', 'arbitrum'].includes(network)) throw new Error('Open minting requires an explicit supported network');
  if (!/^0x[0-9a-fA-F]{40}$/.test(gardenToken ?? '') || /^0x0{40}$/.test(gardenToken)) throw new Error('Missing deployed GardenToken');
  if (!rpc) throw new Error(`Missing ${network.toUpperCase()}_RPC_URL`);
  return { command: 'cast', args: ['send', gardenToken, 'setOpenMinting(bool)', 'true', '--rpc-url', rpc, '--account', 'green-goods-deployer'] };
}
const networks = ['localhost', 'sepolia', 'arbitrum', 'celo', 'mainnet'];
const words = (value = '') => value.split(' ').filter(Boolean);
const standardModes = { preflight: ['--dry-run', '--pure-simulation'], simulate: ['--dry-run'], plan: ['--tx-plan'], broadcast: ['--broadcast'] };
const deployFlags = 'save-artifacts update-schemas force finalize-community-testimony skip-envio skip-verification start-indexer save-report override-sepolia-gate';
const deployValues = 'sender salt stage step expected-nonce receipt artifact owner-phase owner genesis-hat-id genesis-lock first-work-lock first-support-lock genesis-metadata-uri first-work-metadata-uri first-support-metadata-uri';
const definitions = [];
function add(command, handler, options = {}) {
  definitions.push({ command, handler, prefix: [], networks, network: true, modes: null, flags: [], values: [], positional: 0, ...options });
}
for (const target of words('core goods juicebox octant-factory garden actions hats-tree badge-locks greenwill badge-schemas commitment-schemas pooling pooling-configure ownership-transfer settlement-module credit-registry settlement-executor')) {
  const modes = { simulate: ['--dry-run'], broadcast: ['--broadcast'] };
  if (['core', 'octant-factory', 'commitment-schemas', 'pooling', 'ownership-transfer', 'settlement-module', 'credit-registry', 'settlement-executor'].includes(target)) modes.preflight = ['--dry-run', '--pure-simulation'];
  if (target === 'commitment-schemas') modes.plan = ['--tx-plan'];
  if (target === 'octant-factory') modes.simulate = [];
  if (['goods', 'juicebox', 'garden', 'actions'].includes(target)) { modes.preflight = ['--dry-run']; modes.simulate = []; }
  if (['badge-locks', 'badge-schemas'].includes(target)) { modes.preflight = ['--dry-run']; delete modes.simulate; }
  if (target === 'pooling-configure') modes.preflight = ['--pure-simulation'];
  const releaseTarget = ['pooling', 'settlement-module', 'credit-registry', 'settlement-executor'].includes(target);
  if (releaseTarget || target === 'ownership-transfer') modes.plan = ['--pure-simulation'];
  add(`deploy ${target}`, 'script/deploy.ts', { prefix: [target], modes, flags: words(deployFlags), values: words(deployValues), ...(target === 'garden' || target === 'actions' ? { positional: 1 } : {}), ...(releaseTarget ? { networks: target === 'settlement-executor' ? ['celo'] : ['arbitrum'], required: ['expected-nonce'] } : {}) });
}
for (const target of words('action-registry garden-token yield-resolver gardens-module signal-pool-yield-wiring yield-gardens-wiring octant-module hats-module cookie-jar-module karma-gap-module work-resolver work-approval-resolver assessment-resolver testimony-resolver deployment-registry greenwill commitment-pooling all')) {
  add(`upgrade ${target}`, 'script/upgrade.ts', { prefix: [target], modes: { ...standardModes, simulate: [] }, flags: ['override-sepolia-gate'], values: words('sender expected-nonce plan step receipt') });
}
add('verify', 'script/utils/post-deploy-verify.ts', { flags: words('check-etherscan check-indexer-runtime check-steward-upgrade skip-indexer skip-indexer-runtime skip-local-indexer-start start-local-indexer stop-local-indexer-after-check no-octant no-cookiejar ack-product-copy require-product-copy'), values: words('rpc-url chain-id community-slug expected-hats-implementation indexer-poll-seconds indexer-timeout-seconds indexer-url steward-baseline steward-probe-account'), repeatable: ['steward-probe-account'] });
add('verify arbitrum-fork', 'script/verify-arbitrum-fork.ts', { networks: ['arbitrum'], forwardNetwork: false });
add('deploy single-attestation-policy', 'script/deploy/single-attestation-policy.ts', { prefix: ['deploy'], networks: ['localhost', 'sepolia', 'arbitrum'], modes: { preflight: ['--preflight'], plan: ['--plan-only'], simulate: ['--simulate'], broadcast: ['--broadcast'] }, values: words('sender expected-nonce plan'), safeguards: ['production bytecode and reviewed commit/nonce/CREATE-address binding', 'keystore signing only in broadcast', 'exclusive pending broadcast journal; reconcile instead of rebroadcast', 'Sepolia gate and exact RPC receipt/runtime verification', 'standalone deployment artifact; reporting authority remains disabled'] });
add('verify single-attestation-policy', 'script/deploy/single-attestation-policy.ts', { prefix: ['verify'], networks: ['localhost', 'sepolia', 'arbitrum'], flags: ['publish-source'], values: ['receipt'], effects: ['verify recorded deployment or reconcile pending receipt', 'persist only standalone verified policy artifact', 'with --publish-source, submit the verified source to the network explorer; no signer and no transaction'] });
add('verify reporting-kernel', 'script/reporting-kernel-compatibility.ts', { networks: ['arbitrum'], modes: { simulate: ['--simulate'] }, effects: ['exercise the real Kernel and policies on an isolated Arbitrum fork', 'record compatibility evidence; no mainnet broadcast'] });
add('status', 'script/deploy.ts', { prefix: ['status'], forwardNetwork: 'positional' });
add('fork', 'script/deploy.ts', { prefix: ['fork'], forwardNetwork: 'positional' });
add('migrate vaults', 'script/migrate-vaults.ts', { modes: { simulate: ['--dry-run'], broadcast: ['--broadcast'] }, values: words('sender rpc-url chain-id') });
add('migrate action-instructions-v2', 'script/migrate-action-instructions-v2.ts', { modes: { preflight: ['--dry-run'], upload: ['--upload-only'], broadcast: ['--broadcast'] }, flags: ['force'], values: words('rpc-url chain-id slug uid translations preview-dir'), repeatable: ['slug', 'uid'] });
add('migrate action-instructions-v2 check', 'script/migrate-action-instructions-v2.ts', { modes: { simulate: ['--preflight-only'] }, values: words('rpc-url chain-id') });
add('repair octant-assets', 'script/repair-octant-assets.ts', { modes: { preflight: ['--dry-run', '--pure-simulation'], simulate: [], broadcast: ['--broadcast'] }, values: ['sender'] });
add('ens migrate', 'script/upgrade-ens-receiver.ts', { prefix: ['migrate'], networks: ['mainnet'], modes: { preflight: ['--pure-simulation'], simulate: [], broadcast: ['--broadcast'] }, values: words('sender registrations-file new-receiver') });
for (const action of ['status', 'monitor', 'top-up']) add(`ens sponsor ${action}`, 'script/ens-sponsor.ts', { prefix: [action], modes: action === 'top-up' ? { broadcast: ['--broadcast'] } : null, values: words('account amount min-sponsored-claims sample-owner sample-slug') });
for (const action of ['deploy-mainnet', 'deploy-sepolia', 'update-l1-receiver']) add(`ens ${action}`, 'script/upgrade-ens-receiver.ts', { prefix: [action], networks: action === 'deploy-mainnet' ? ['mainnet'] : action === 'deploy-sepolia' ? ['sepolia'] : ['arbitrum'], modes: { preflight: ['--pure-simulation'], simulate: [], broadcast: ['--broadcast'] }, values: words('new-receiver sender registrations-file') });
for (const action of ['status', 'configure']) add(`marketplace ${action}`, 'script/marketplace-readiness.ts', { prefix: [action], modes: action === 'configure' ? { simulate: ['--dry-run'], broadcast: ['--broadcast'] } : null, values: words('rpc-url chain-id expected-owner') });
add('pooling backfill', 'script/deploy/backfill-pools.ts', { networks: ['arbitrum'], modes: { simulate: ['--dry-run'], broadcast: ['--broadcast'] }, values: words('authority plan step expected-nonce expected-safe-nonce receipt'), flags: ['override-sepolia-gate'] });
for (const [command, target] of [ ['release manifest', 'release-manifest'], ['release core', 'protocol-core'], ['release recover', 'release-recover'], ['release verify', 'release-verify'], ['release indexer-handoff', 'indexer-handoff'], ['settlement safe', 'safe-plan'], ['settlement peer', 'settlement-peer'], ['settlement peer-verify', 'settlement-peer-verify'] ]) {
  const offline = ['release-manifest', 'protocol-core', 'indexer-handoff', 'settlement-peer'].includes(target);
  add(command, 'script/deploy.ts', { prefix: [target], modes: target === 'settlement-peer-verify' ? null : offline ? { preflight: ['--pure-simulation'] } : { preflight: ['--pure-simulation'], simulate: [] }, modeOptional: true, flags: ['save-artifacts'], values: words(deployValues), ...(target === 'safe-plan' ? { networks: ['celo'] } : target.startsWith('settlement-peer') ? { networks: ['arbitrum'] } : {}), ...(target === 'settlement-peer-verify' ? { required: ['receipt'] } : {}), offline });
}
add('release downstream', 'script/deploy/pilot-downstream.ts', { network: false, modes: { simulate: [], broadcast: ['--broadcast'] }, effects: ['rehearse all approved downstream deployments and atomic Safe packets before prompting once', 'broadcast 23 deployments, the deployer-owned observer registration and capped CCIP fuel; export three consolidated owner packets'], safeguards: ['committed source and exact runtime, chain, nonce, receipt and native budget checks', 'approved bootstrap signer and original GG Safes retained', 'private one-session credential lease and fail-closed durable execution state', 'Safe owner calls are never broadcast by this command'] });
add('release vouchers', 'script/deploy/voucher-release.ts', { network: false, modes: { preflight: ['--preflight'], plan: ['--plan-only'], simulate: ['--simulate'] }, values: ['manifest', 'plan', 'output'], effects: ['compile production voucher artifacts', 'write paused endpoint plan or isolated fork simulation evidence; no live broadcast'], safeguards: ['Arbitrum/Gnosis chain and nonce binding', 'atomic proxy initialization, paused end state and finite authority boundary', 'reviewed manifest, production library links and runtime checks', 'no broadcast, signer input, allowance or activation command'] });
add('release steward-safe', 'script/deploy/steward-safe-release.ts', { network: false, modes: { preflight: ['--preflight'], plan: ['--plan-only'], simulate: ['--simulate'] }, values: ['manifest', 'plan', 'output'], effects: ['compile production steward mirror artifacts', 'prepare exact deployments and observer calldata or simulate on owned forks; no live broadcast'], safeguards: ['roster-driven threshold: one valid steward signs alone, two or more need two signatures; locked Hats Signer Gate v2 and dedicated receiver-owned Hat', 'Arbitrum/Gnosis peers, nonces, production artifacts and dependency code bound', 'existing Green Goods Safe untouched; activation and observer registration excluded', 'no broadcast or signer input'] });
add('release clc', 'script/deploy/clc-release.ts', { network: false, modes: { preflight: ['--preflight'], plan: ['--plan-only'], simulate: ['--simulate'] }, values: ['manifest', 'members', 'receipts', 'plan', 'output'], effects: ['compile production issuer upgrade timelock artifact', 'prepare the unchanged ten CLC base deployments plus explicitly selected member tokens, or rehearse canonical receipt adoption on an owned Gnosis fork'], safeguards: ['existing Green Goods Safe administers its reserve and network pool', 'exact factory, implementation, Safe, nonce and initialized proxy state verification', 'configuration, issuance, allowance and activation remain separate review drafts', 'no broadcast or signer input'] });
add('release source-upgrades', 'script/deploy/source-upgrade-release.ts', { network: false, modes: { preflight: ['--preflight'], plan: ['--plan-only'], simulate: ['--simulate'], 'prepare-execution': ['--prepare-execution'], broadcast: ['--broadcast'], 'broadcast-creates': ['--broadcast-creates'], 'export-safe': ['--export-safe'], 'sign-safe': ['--sign-safe'], 'broadcast-safe': ['--broadcast-safe'], 'draft-safe-batch': ['--draft-safe-batch'], 'simulate-safe-batch': ['--simulate-safe-batch'], 'export-safe-batch': ['--export-safe-batch'], 'adopt-safe-batch': ['--adopt-safe-batch'], adopt: ['--adopt'] }, flags: ['recover-lock', 'resume-plan'], values: words('manifest plan output rehearsal safe-pins other-reserved-wei envelope step expected-nonce receipt signer-account owner-signature signature-one signature-two batch batch-rehearsal'), effects: ['compile reviewed production source implementations', 'prepare or rehearse exact paused upgrades', 'broadcast one bounded CREATE through the normal operator; collect exact owner signatures and submit or adopt a bound Safe call'], safeguards: ['exact committed source, compiler jobs, runtime, rehearsal and canonical authority binding', 'fixed shared budget, ordered EOA/Safe nonces, durable intent and receipt adoption', 'original Safe retains authority; no activation or reinitialization'] });
add('release pilot', 'script/deploy/live-pilot-package.ts', { network: false, modes: { preflight: ['--preflight'], plan: ['--plan-only'] }, values: ['manifest', 'source-upgrades-plan', 'steward-safe-plan', 'vouchers-plan', 'clc-plan', 'clc-members', 'output'], effects: ['inspect four component manifests and an optional exact-base-bound member extension offline', 'assemble four validated current-revision plans into a review package'], safeguards: ['four committed manifests and exact production artifacts', 'ordered component boundaries and nonoverlapping native nonce ranges', 'component fork proofs and live binding readback remain separate', 'no compound simulation, broadcast, signer input or activation'] });
add('release operator', 'script/release-operator.ts', { network: false, values: ['stage', 'commit'], required: ['commit'], capabilities: ['exact reviewed Git commit', 'authorized keystore credential session', 'configured RPC'], effects: ['execute only allowlisted release boundaries through the release operator', 'persist and verify checkpoints; may broadcast transactions'], safeguards: ['exact-commit and checkout checks', 'operator credential session', 'ordered boundaries with nonce/receipt binding', 'stop on failure and clean credentials'], enums: { stage: ['ownership-arbitrum', 'ownership-celo', 'garden-accounts', 'garden-safes', 'relay', 'garden-roles', 'garden-roles-enable', 'garden-routes'] } });
for (const [domain, handler, actions] of [
 ['garden-accounts', 'celo-garden-accounts', ['plan', 'verify', 'deploy']],
 ['garden-safes', 'garden-safe-owners', ['plan', 'verify', 'deploy']],
 ['garden-roles', 'garden-roles', ['plan', 'verify', 'deploy', 'enable']],
 ['garden-routes', 'garden-routes', ['plan', 'verify', 'configure']],
 ['garden-relay', 'garden-account-relay', ['plan', 'verify', 'deploy', 'adopt']],
]) for (const action of actions) {
  const mutation = ['deploy', 'enable', 'configure'].includes(action);
  const values = { 'garden-accounts': 'plan raw-bundle step receipt', 'garden-safes': 'plan inventory step receipt', 'garden-roles': 'plan safe-plan step', 'garden-routes': 'plan safe-plan step', 'garden-relay': 'plan safe-plan step receipt' }[domain];
  add(`settlement ${domain} ${action}`, `script/deploy/${handler}.ts`, { prefix: [action], networks: ['celo'], forwardNetwork: false, modes: mutation ? { broadcast: ['--broadcast'] } : null, values: words(values), required: mutation ? ['step'] : action === 'adopt' ? ['step', 'receipt'] : [] });
}
for (const action of ['up', 'down', 'courier']) add(`settlement dual-chain ${action}`, 'script/settlement/dual-chain-courier.ts', { prefix: [action], network: false });
for (const action of ['update', 'watch', 'start', 'restore']) add(`indexer ${action}`, 'script/utils/envio-integration.ts', { prefix: [action], network: false, positional: action === 'watch' ? Number.POSITIVE_INFINITY : action === 'update' ? 1 : 0, optionalPositional: true });
add('ipfs upload', 'script/utils/ipfs-uploader.ts', { network: false });
add('ipfs cache', 'script/cli/read-cache.mjs', { network: false });
add('minting open', 'script/cli/open-minting.mjs', { modes: { broadcast: [] }, networks: ['sepolia', 'arbitrum'] });
export const OPERATIONS = Object.freeze(definitions.map((operation) => Object.freeze(operation)));

export function validateSourceUpgradeMode(values) {
  const common = ['mode', 'manifest', 'help', 'explain', 'json', ...(!['plan', 'preflight'].includes(values.mode) ? ['resume-plan'] : [])];
  const modes = {
    preflight: [], plan: ['output'], simulate: ['plan', 'output'],
    'prepare-execution': ['plan', 'rehearsal', 'safe-pins', 'other-reserved-wei', 'output'],
    broadcast: ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce'],
    'broadcast-creates': ['plan', 'rehearsal', 'envelope'],
    'export-safe': ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce', 'output'],
    'sign-safe': ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce', 'signer-account', 'owner-signature', 'output'],
    'broadcast-safe': ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce', 'signature-one', 'signature-two'],
    adopt: ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce', 'receipt', 'recover-lock'],
    'draft-safe-batch': ['plan', 'output'],
    'simulate-safe-batch': ['plan', 'output'],
    'export-safe-batch': ['plan', 'rehearsal', 'envelope', 'batch-rehearsal', 'output'],
    'adopt-safe-batch': ['plan', 'rehearsal', 'envelope', 'batch', 'receipt', 'recover-lock'],
  };
  const allowed = modes[values.mode];
  if (!allowed) throw new Error('Select one supported source upgrade mode');
  for (const key of Object.keys(values)) if (![...common, ...allowed].includes(key) && values[key] !== undefined)
    throw new Error(`Unexpected source upgrade --${key} for ${values.mode}`);
  const required = values.mode === 'broadcast-creates' ? ['plan', 'rehearsal', 'envelope']
    : values.mode === 'export-safe-batch' ? ['plan', 'rehearsal', 'envelope', 'batch-rehearsal']
    : values.mode === 'adopt-safe-batch' ? ['plan', 'rehearsal', 'envelope', 'batch', 'receipt']
    : values.mode === 'prepare-execution' ? ['plan', 'rehearsal', 'safe-pins', 'other-reserved-wei']
    : ['broadcast', 'export-safe', 'sign-safe', 'broadcast-safe', 'adopt'].includes(values.mode) ? ['plan', 'rehearsal', 'envelope', 'step', 'expected-nonce', ...(values.mode === 'adopt' ? ['receipt'] : values.mode === 'broadcast-safe' ? ['signature-one', 'signature-two'] : [])]
    : ['simulate', 'draft-safe-batch', 'simulate-safe-batch'].includes(values.mode) ? ['plan'] : [];
  if (values.mode === 'sign-safe' && Boolean(values['signer-account']) === Boolean(values['owner-signature'])) throw new Error('Select one owner keystore account or one public owner signature');
  if (values['signer-account'] && !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(values['signer-account'])) throw new Error('Invalid owner keystore alias');
  if (values['owner-signature'] && !/^0x[a-fA-F0-9]{130}$/.test(values['owner-signature'])) throw new Error('Expected one public 65-byte owner signature');
  for (const key of required) if (values[key] === undefined || values[key] === '') throw new Error(`Source upgrade ${values.mode} requires --${key}`);
  for (const key of ['step', 'expected-nonce']) if (values[key] !== undefined && (!/^(0|[1-9][0-9]*)$/.test(values[key]) || !Number.isSafeInteger(Number(values[key])) || Number(values[key]) < (key === 'step' ? 1 : 0))) throw new Error(`Invalid source upgrade --${key}`);
  if (values.receipt && !/^0x[a-fA-F0-9]{64}$/.test(values.receipt)) throw new Error('Source adoption requires an exact transaction hash');
  if (values['other-reserved-wei'] !== undefined && !/^(0|[1-9][0-9]*)$/.test(values['other-reserved-wei'])) throw new Error('Source reservation requires unsigned decimal wei');
}

function parse(operation, args) {
  const values = {};
  const positionals = [];
  const flags = new Set([...operation.flags, 'help', 'explain', 'json']);
  const valueFlags = new Set([...operation.values, ...(operation.network ? ['network'] : []), ...(operation.modes ? ['mode'] : [])]);
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (!token.startsWith('-')) { positionals.push(token); continue; }
    const [raw, ...inline] = token.split('=');
    const key = raw === '-h' ? 'help' : raw.slice(2);
    if (!flags.has(key) && !valueFlags.has(key)) throw new Error(`Unknown option ${raw} for ${operation.command}`);
    if (Object.hasOwn(values, key) && !operation.repeatable?.includes(key)) throw new Error(`Duplicate option --${key}`);
    if (flags.has(key)) {
      if (inline.length) throw new Error(`--${key} does not take a value`);
      values[key] = true;
    } else {
      const value = inline.length ? inline.join('=') : args[++index];
      if (!value || value.startsWith('-')) throw new Error(`--${key} requires a value`);
      values[key] = operation.repeatable?.includes(key) ? [...(values[key] ?? []), value] : value;
    }
  }
  if (values.help) return { values, positionals };
  if (positionals.length > operation.positional || (!operation.optionalPositional && positionals.length !== operation.positional)) throw new Error(`Unexpected or missing positional argument for ${operation.command}`);
  if (operation.network && !values.network) throw new Error(`${operation.command} requires --network`);
  if (values.network && !operation.networks.includes(values.network)) throw new Error(`Unsupported network for ${operation.command}`);
  if (operation.modes && !operation.modeOptional && !values.mode) throw new Error(`${operation.command} requires --mode (${Object.keys(operation.modes).join(', ')})`);
  if (values.mode && !Object.hasOwn(operation.modes, values.mode)) throw new Error(`Unsupported mode for ${operation.command}: ${values.mode}`);
  for (const required of operation.required ?? []) if (!values[required]) throw new Error(`${operation.command} requires --${required}`);
  for (const [key, allowed] of Object.entries(operation.enums ?? {})) if (values[key] && !allowed.includes(values[key])) throw new Error(`Unsupported --${key} for ${operation.command}`);
  for (const numeric of ['step', 'expected-nonce', 'expected-safe-nonce']) if (values[numeric] !== undefined && (!/^\d+$/.test(values[numeric]) || !Number.isSafeInteger(Number(values[numeric])) || Number(values[numeric]) < (numeric === 'step' ? 1 : 0))) throw new Error(`--${numeric} requires a ${numeric === 'step' ? 'positive' : 'non-negative'} safe integer`);
  if (values['chain-id']) {
    const expectedChain = { arbitrum: 42161, sepolia: 11155111, celo: 42220, mainnet: 1 }[values.network];
    if (!/^\d+$/.test(values['chain-id']) || !Number.isSafeInteger(Number(values['chain-id'])) || Number(values['chain-id']) <= 0) throw new Error('--chain-id requires a positive safe integer');
    if (expectedChain && Number(values['chain-id']) !== expectedChain) throw new Error('--chain-id conflicts with --network');
  }
  if (values.commit && !/^[a-f0-9]{40}$/.test(values.commit)) throw new Error('--commit requires an exact 40-character commit');
  if (values.receipt && !/^0x[a-fA-F0-9]{64}$/.test(values.receipt)) throw new Error('--receipt requires a transaction hash');
  if (values['owner-phase'] && !['safe', 'deployment'].includes(values['owner-phase'])) throw new Error('--owner-phase requires deployment or safe');
  if (operation.command === 'deploy ownership-transfer') {
    if (!['arbitrum', 'celo'].includes(values.network)) throw new Error('Ownership transfer supports arbitrum and celo');
    if (values.mode === 'broadcast') for (const key of ['step', 'expected-nonce']) if (values[key] === undefined) throw new Error(`Ownership broadcast requires --${key}`);
  }
  if (values.json && !values.explain) throw new Error('--json requires --explain');
  if (operation.command.startsWith('settlement garden-') && !operation.modes && !operation.command.endsWith('adopt') && (values.step || values.receipt)) throw new Error('Read-only settlement action cannot execute or recover a boundary');
  if (operation.command === 'deploy commitment-schemas' && values.mode === 'plan' && values['expected-nonce'] === undefined) throw new Error('Transaction planning requires --expected-nonce');
  if (operation.command === 'deploy single-attestation-policy') {
    if (values.mode === 'plan') for (const key of ['sender', 'expected-nonce']) if (values[key] === undefined) throw new Error(`Policy planning requires --${key}`);
    if (values.mode === 'broadcast' && values['expected-nonce'] === undefined) throw new Error('Policy broadcast requires --expected-nonce');
    if (values.mode === 'preflight' && ['sender', 'expected-nonce', 'plan'].some(key => values[key] !== undefined) || ['simulate', 'broadcast'].includes(values.mode) && values.sender !== undefined) throw new Error('Unexpected input for this policy operation');
  }
  if (operation.command === 'verify single-attestation-policy' && values['publish-source'] && values.network === 'localhost') throw new Error('Source publication needs a network with an explorer');
  if (['check-indexer-runtime', 'start-local-indexer'].some((key) => values[key]) && values['skip-indexer-runtime']) throw new Error('Conflicting indexer options');
  if (values['start-local-indexer'] && values['skip-local-indexer-start']) throw new Error('Conflicting local indexer options');
  if (operation.command === 'release recover' && values.mode === 'preflight' && values['save-artifacts']) throw new Error('Artifact recovery writes require live verification; omit preflight mode');
  if (operation.command === 'release source-upgrades') validateSourceUpgradeMode(values);
  if (operation.command === 'release clc') {
    if (values.mode === 'preflight' && (values.plan || values.output) || values.mode === 'plan' && values.plan || values.mode === 'simulate' && !values.plan) throw new Error('Unexpected or missing release plan/output argument');
    if (values.receipts && values.mode !== 'simulate') throw new Error('CLC receipt adoption requires simulate mode');
  }
  if (operation.command === 'release pilot') {
    const components = ['source-upgrades-plan', 'steward-safe-plan', 'vouchers-plan', 'clc-plan'];
    if (values.mode === 'preflight' && [...components, 'output'].some((key) => values[key])) throw new Error('Pilot preflight accepts only its manifest');
    if (values.mode === 'plan') for (const key of components) if (!values[key]) throw new Error(`Pilot packaging requires --${key}`);
  }
  if (operation.command === 'ens migrate' && values.mode === 'preflight' && !values['registrations-file']) throw new Error('ENS preflight requires --registrations-file to avoid RPC discovery');
  return { values, positionals };
}

export function resolveCommand(input) {
  const argv = [...input];
  if (argv[0] === '--') argv.shift();
  if (!argv.length || argv[0] === 'help' || argv[0] === '--help' || argv[0] === '-h') {
    const topic = argv[0] === 'help' ? argv.slice(1).join(' ') : '';
    if (topic && !OPERATIONS.some((operation) => operation.command === topic || operation.command.startsWith(`${topic} `))) throw new Error(`Unknown command: ${topic}`);
    return { help: true, topic };
  }
  const operation = [...OPERATIONS].sort((a, b) => b.command.length - a.command.length).find((candidate) => candidate.command.split(' ').every((part, index) => argv[index] === part));
  if (!operation) throw new Error('Unknown contract command; use contracts help');
  const { values, positionals } = parse(operation, argv.slice(operation.command.split(' ').length));
  if (values.help) return { help: true, topic: operation.command };
  const env = { APP_ENV: 'development' };
  const network = values.network;
  const mode = values.mode;
  const isUpgrade = operation.handler === 'script/upgrade.ts';
  const target = operation.prefix[0];
  const checks = [];
  if (operation.handler === 'script/deploy/single-attestation-policy.ts') {
    env.FOUNDRY_KEYSTORE_ACCOUNT = 'green-goods-deployer';
    env.PINATA_JWT = ''; env.PINATA_GATEWAY = '';
  }
  if (operation.command === 'release operator' || operation.command === 'migrate action-instructions-v2 check') env.FOUNDRY_KEYSTORE_ACCOUNT = 'green-goods-deployer';
  if (operation.command === 'release source-upgrades' && ['broadcast', 'broadcast-creates', 'broadcast-safe', 'sign-safe'].includes(mode)) {
    if (mode !== 'sign-safe') env.FOUNDRY_KEYSTORE_ACCOUNT = 'green-goods-deployer';
    env.PINATA_JWT = ''; env.PINATA_GATEWAY = '';
  }
  // The session blanks these for each stage; blank them for the session itself, so its keystore check starts without them too.
  if (operation.command === 'release operator') { env.PINATA_JWT = ''; env.PINATA_GATEWAY = ''; }
  if ((isUpgrade && ['arbitrum', 'sepolia'].includes(network)) || operation.command === 'migrate vaults' || operation.command === 'migrate action-instructions-v2' && mode !== 'simulate' || operation.command.startsWith('marketplace ') || operation.command === 'verify' && network === 'arbitrum') env.FOUNDRY_KEYSTORE_ACCOUNT = 'green-goods-deployer';
  if (network === 'arbitrum' && (operation.command.startsWith('marketplace ') || operation.command === 'verify')) env.MARKETPLACE_EXPECTED_OWNER = OPERATOR;
  if (['plan', 'broadcast'].includes(mode) && ((isUpgrade && ['assessment-resolver', 'commitment-pooling'].includes(target)) || operation.handler === 'script/deploy.ts' && ['commitment-schemas', 'pooling', 'pooling-configure'].includes(target))) {
    env.FOUNDRY_KEYSTORE_ACCOUNT = 'green-goods-deployer';
    env.PINATA_JWT = ''; env.PINATA_GATEWAY = '';
  }
  if (isUpgrade && mode === 'plan' && ['assessment-resolver', 'commitment-pooling'].includes(target)) env.UPGRADE_PLAN_OUTPUT_DIR = '.generated/release-upgrades';
  const senderDefault = (isUpgrade && ['plan', 'broadcast'].includes(mode) && ['deployment-registry', 'assessment-resolver', 'commitment-pooling', 'hats-module', 'cookie-jar-module', 'signal-pool-yield-wiring'].includes(target)) || (isUpgrade && target === 'signal-pool-yield-wiring' && mode === 'simulate') || (operation.command === 'migrate vaults' && mode === 'broadcast') || (operation.handler === 'script/deploy.ts' && ['commitment-schemas', 'pooling-configure'].includes(target) && ['plan', 'broadcast'].includes(mode));
  if (senderDefault && !values.sender) values.sender = OPERATOR;
  if ((target === 'commitment-pooling' && ['plan', 'broadcast'].includes(mode)) || target === 'pooling-configure' && mode === 'broadcast') env.SENDER_ADDRESS = values.sender;
  if (isUpgrade && mode === 'broadcast' && target === 'assessment-resolver') checks.push({ command: 'bun', args: ['run', 'check:storage-layout'] });
  if (isUpgrade && mode === 'broadcast' && target === 'cookie-jar-module') {
    checks.push({ command: 'bash', args: ['script/check-storage-layout.sh', '--contract', 'CookieJarModule'] });
    if (network === 'arbitrum') checks.push({ command: 'bun', args: ['script/utils/fork-shards.mjs', 'run', 'cookie-jar-module-upgrade-arbitrum'] });
  }
  if (isUpgrade && mode === 'broadcast' && target === 'hats-module') {
    checks.push({ command: 'bash', args: ['script/check-storage-layout.sh', '--contract', 'HatsModule'] });
    checks.push({ command: 'bun', args: ['script/utils/fork-shards.mjs', 'run', `hats-module-upgrade-${network}`] });
  }
  if (operation.command === 'pooling backfill' && !values.authority) values.authority = 'deployer';
  const args = [operation.handler, ...operation.prefix, ...positionals];
  if (operation.network && operation.forwardNetwork !== false) args.push(...(operation.forwardNetwork === 'positional' ? [network] : ['--network', network]));
  if (mode) args.push(...operation.modes[mode]);
  for (const [key, value] of Object.entries(values)) {
    if (['mode', 'network', 'help', 'explain', 'json'].includes(key)) continue;
    if (Array.isArray(value)) for (const item of value) args.push(`--${key}`, item);
    else { args.push(`--${key}`); if (value !== true) args.push(value); }
  }
  const offline = operation.offline || mode === 'preflight' || mode === 'plan' && operation.modes.plan.includes('--pure-simulation') || operation.command === 'release recover' && !values['save-artifacts'];
  const rpc = !offline && operation.network;
  const forkNetworks = { 'release vouchers': 'Arbitrum and Gnosis RPC', 'release steward-safe': 'Arbitrum and Gnosis RPC', 'release clc': 'Gnosis RPC', 'release source-upgrades': 'Arbitrum RPC' };
  const sourceEffects = operation.command === 'release source-upgrades' ? {
    preflight: ['compile and inspect production artifacts; no RPC'], plan: ['write the exact source upgrade plan; no broadcast'],
    simulate: ['rehearse on an owned Arbitrum fork; no live broadcast'],
    'prepare-execution': ['read canonical Arbitrum state and gas estimates; write a bounded execution envelope'],
    broadcast: ['submit one bounded CREATE through the normal keystore; verify receipt and persist shared spend'],
    'broadcast-creates': ['unlock the fixed deployer once; resume and verify each remaining CREATE through its canonical bounded wrapper'],
    'export-safe': ['recheck live state; export one exact Safe recipe without signing or broadcasting'],
    'draft-safe-batch': ['export a predicted standard Safe Transaction Builder JSON; not ready for signing'],
    'simulate-safe-batch': ['rehearse one atomic MultiSendCallOnly batch on an owned fork; no live broadcast'],
    'export-safe-batch': ['verify all CREATE receipts and export the exact standard Safe batch and review binding'],
    'adopt-safe-batch': ['verify external Safe batch receipt, actual executor gas, one nonce increment and paused preserved state'],
    'sign-safe': ['sign exact EIP-712 SafeTx with an owner keystore or verify a public owner signature; no broadcast'],
    'broadcast-safe': ['simulate two original-owner signatures, then submit one bound deployer Safe transaction with durable receipt verification'],
    adopt: ['read and verify one canonical receipt; persist shared spend and ordered completion without sending'],
  }[mode] : undefined;
  return { operation: operation.command, network, mode, command: 'bun', args, cwd: PACKAGE_ROOT, env, checks, explain: Boolean(values.explain), json: Boolean(values.json), capabilities: [...(operation.capabilities ?? []), ...(forkNetworks[operation.command] && ['simulate', 'simulate-safe-batch'].includes(mode) ? [forkNetworks[operation.command], 'owned isolated Anvil forks'] : []), ...(operation.command === 'release source-upgrades' && !['preflight', 'plan', 'simulate'].includes(mode) ? ['Arbitrum RPC'] : []), ...(rpc ? [operation.command.startsWith('settlement safe') || operation.command === 'settlement peer-verify' ? 'Arbitrum and Celo RPC' : 'configured RPC'] : []), ...(['broadcast', 'broadcast-safe', 'sign-safe'].includes(mode) ? ['authorized signer'] : []), ...(mode === 'upload' || operation.command === 'ipfs upload' ? ['IPFS upload credentials'] : []), ...(values['publish-source'] ? ['explorer API key'] : [])], effects: sourceEffects ?? operation.effects ?? (mode === 'broadcast' ? ['broadcast transactions', 'write operation artifacts'] : mode === 'preflight' ? ['compile/check artifacts; no RPC'] : mode === 'plan' ? [...(rpc ? ['RPC simulation'] : []), 'write transaction plan artifacts'] : mode === 'upload' || operation.command === 'ipfs upload' ? ['upload content', 'write cache/artifacts'] : ['run existing handler; may write reports or local configuration']), safeguards: [...(operation.safeguards ?? []), ...checks.map((check) => check.args.join(' '))] };
}

export function explainOperation(resolution) {
  const { operation, network, mode, capabilities, effects, safeguards, args, env } = resolution;
  const redactedArgs = [...args];
  for (let index = 0; index < redactedArgs.length; index++) {
    if (redactedArgs[index].startsWith('--') && redactedArgs[index + 1] && !redactedArgs[index + 1].startsWith('--')) { redactedArgs[index + 1] = '[provided]'; index++; }
  }
  return { operation, network, mode, capabilities, effects, safeguards, invocation: { command: 'bun', args: redactedArgs, cwd: 'packages/contracts' }, environment: Object.keys(env) };
}

export function renderHelp(topic = '') {
  const candidates = OPERATIONS.filter((operation) => !topic || operation.command === topic || operation.command.startsWith(`${topic} `));
  return ['Green Goods contract operations', 'Usage: bun run contracts -- <command> [arguments]', '', ...candidates.map((operation) => `${operation.command}${operation.positional ? ' <input>' : ''}${operation.network ? ` --network <${operation.networks.join('|')}>` : ''}${operation.modes ? ` --mode <${Object.keys(operation.modes).join('|')}>${operation.modeOptional ? ' (optional)' : ''}` : ''}${operation.required?.length ? ` ${operation.required.map((key) => `--${key} <value>`).join(' ')}` : ''}\n  ${operation.handler}${topic ? `\n  Options: ${[...operation.flags, ...operation.values].map((key) => `--${key}`).join(', ')}` : ''}`), '', '--help: command help; --explain [--json]: resolve without credentials, network, or execution.', 'Preflight: compile/artifact checks. Simulate: RPC without broadcasting. Plan: transaction-plan artifacts.', 'Broadcast: transactions. Upload: remote content and local artifacts. Release broadcasts require the existing operator session.'].join('\n');
}

const boundaries = {
 'ownership-arbitrum': ['deploy', 'ownership-transfer', '--network', 'arbitrum', '--mode', 'broadcast'],
 'ownership-celo': ['deploy', 'ownership-transfer', '--network', 'celo', '--mode', 'broadcast'],
 'garden-accounts': ['settlement', 'garden-accounts', 'deploy', '--network', 'celo', '--mode', 'broadcast'],
 'garden-safes': ['settlement', 'garden-safes', 'deploy', '--network', 'celo', '--mode', 'broadcast'],
 'garden-relay': ['settlement', 'garden-relay', 'deploy', '--network', 'celo', '--mode', 'broadcast'],
 'garden-roles': ['settlement', 'garden-roles', 'deploy', '--network', 'celo', '--mode', 'broadcast'],
 'garden-roles-enable': ['settlement', 'garden-roles', 'enable', '--network', 'celo', '--mode', 'broadcast'],
 'garden-routes': ['settlement', 'garden-routes', 'configure', '--network', 'celo', '--mode', 'broadcast'],
};
export const OPERATOR_ARGUMENTS = Object.freeze({
  'ownership-arbitrum': ['--step', '--expected-nonce'],
  'ownership-celo': ['--step', '--expected-nonce'],
  'garden-accounts': ['--plan', '--step', '--receipt'],
  'garden-safes': ['--plan', '--inventory', '--step', '--receipt'],
  'garden-relay': ['--plan', '--safe-plan', '--step', '--receipt'],
  'garden-roles': ['--plan', '--safe-plan', '--broadcast', '--step'],
  'garden-roles-enable': ['--plan', '--broadcast', '--step'],
  'garden-routes': ['--plan', '--safe-plan', '--broadcast', '--step'],
});
export function resolveOperatorBoundary(id, args) {
  if (!Object.hasOwn(boundaries, id)) throw new Error('Unknown release operator boundary');
  for (let index = 0; index < args.length; index += 2) {
    if (!OPERATOR_ARGUMENTS[id].includes(args[index])) throw new Error('Release boundary cannot override execution policy');
    if (!args[index + 1] || args[index + 1].startsWith('-')) throw new Error(`${args[index]} requires a value`);
  }
  const normalized = [...args];
  const broadcast = normalized.indexOf('--broadcast');
  if (broadcast !== -1 && normalized[broadcast + 1] === 'true') normalized.splice(broadcast, 2);
  if (normalized.some((arg) => /^--(?:network|mode|broadcast|sender|account|private-key|password|rpc-url|explain|help)(?:=|$)/.test(arg))) throw new Error('Release boundary cannot override execution policy');
  return resolveCommand([...boundaries[id], ...normalized]);
}
