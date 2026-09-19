import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import dotenv from 'dotenv';
import { resolveMintingTransaction } from './operations.mjs';

// Only loaded by the executing CLI, never by help, explain, or documentation generation.
const network = process.argv[process.argv.indexOf('--network') + 1];
const chainId = { sepolia: 11155111, arbitrum: 42161 }[network];
if (!chainId) throw new Error('Open minting requires an explicit supported network');
dotenv.config({ path: new URL('../../../../.env', import.meta.url).pathname });
const rpc = process.env[`${network.toUpperCase()}_RPC_URL`];
const deployment = JSON.parse(await readFile(new URL(`../../deployments/${chainId}-latest.json`, import.meta.url), 'utf8'));
const invocation = resolveMintingTransaction(network, deployment.gardenToken, rpc);
const child = spawn(invocation.command, invocation.args, { stdio: 'inherit', shell: false });
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
child.once('error', () => { process.stderr.write('Could not start contract transaction tool\n'); process.exitCode = 1; });
child.once('exit', (code, signal) => { process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 143); });
