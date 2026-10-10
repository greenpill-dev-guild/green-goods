import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const isDirectRun = (url) => process.argv[1] && fileURLToPath(url) === path.resolve(process.argv[1]);

/** One invocation scope: cancellation remains terminal even if a child handles its signal successfully. */
export function createCommandRunner({ spawnImpl = spawn, signalHost = process, env = process.env } = {}) {
  const children = new Set();
  let cancelled = 0;
  let notify;
  const cancellation = new Promise((resolve) => { notify = resolve; });
  function cancel(signal) {
    cancelled ||= signal === 'SIGINT' ? 130 : 143;
    for (const child of children) child.kill(signal);
    notify(cancelled);
  }
  const interrupt = () => cancel('SIGINT');
  const terminate = () => cancel('SIGTERM');
  signalHost.on('SIGINT', interrupt);
  signalHost.on('SIGTERM', terminate);
  return {
    get cancelled() { return cancelled; },
    cancellation,
    track(child) { children.add(child); child.once('close', () => children.delete(child)); return child; },
    async run(invocations) {
      for (const invocation of invocations) {
        if (cancelled) return cancelled;
        const code = await new Promise((resolve) => {
          let child;
          try {
            child = spawnImpl(invocation.command, invocation.args, {
              cwd: invocation.cwd || REPO_ROOT,
              env: { ...env, ...invocation.env },
              shell: false,
              stdio: 'inherit',
            });
          } catch { resolve(1); return; }
          children.add(child);
          child.once('error', () => { children.delete(child); resolve(1); });
          child.once('close', (status, signal) => {
            children.delete(child);
            resolve(cancelled || status || (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : signal ? 1 : 0));
          });
        });
        if (code !== 0 || cancelled) return cancelled || code;
      }
      return cancelled;
    },
    dispose() { signalHost.off('SIGINT', interrupt); signalHost.off('SIGTERM', terminate); },
  };
}

export async function runCommands(invocations, dependencies) {
  const runner = createCommandRunner(dependencies);
  try { return await runner.run(invocations); } finally { runner.dispose(); }
}

/** Parse runner-owned options; a literal -- is the explicit boundary for downstream arguments. */
export function parseOptions(argv, { flags = [], values = [], passthrough = false } = {}) {
  const result = {};
  const args = [...argv];
  if (args[0] === '--' && !passthrough) args.shift();
  for (let index = 0; index < args.length; index++) {
    const token = args[index];
    if (token === '--' && passthrough) { result.rest = args.slice(index + 1); break; }
    const [key, ...inline] = token.split('=');
    if (Object.hasOwn(result, key)) throw new Error(`Duplicate option ${key}`);
    if (flags.includes(key)) {
      if (inline.length) throw new Error(`${key} does not take a value`);
      result[key] = true;
    } else if (values.includes(key)) {
      const value = inline.length ? inline.join('=') : args[++index];
      if (!value || value.startsWith('-')) throw new Error(`${key} requires a value`);
      result[key] = value;
    } else throw new Error(`Unknown argument: ${token}`);
  }
  return result;
}
