import { spawn } from 'node:child_process';

/** Run checks in order, retaining stdio and signals; no shell expansion or command strings. */
export async function executeOperation(resolution, { spawnImpl = spawn, env = process.env, signalHost = process } = {}) {
  if (resolution.help || resolution.explain) throw new Error('Help and explain must not execute');
  for (const invocation of [...resolution.checks, resolution]) {
    const result = await new Promise((resolve, reject) => {
      const child = spawnImpl(invocation.command, invocation.args, { cwd: resolution.cwd, env: { ...env, ...resolution.env }, stdio: 'inherit', shell: false });
      let cancelled;
      const forwardInterrupt = () => { cancelled = 'SIGINT'; child.kill('SIGINT'); };
      const forwardTermination = () => { cancelled = 'SIGTERM'; child.kill('SIGTERM'); };
      const cleanup = () => { signalHost.off('SIGINT', forwardInterrupt); signalHost.off('SIGTERM', forwardTermination); };
      signalHost.on('SIGINT', forwardInterrupt);
      signalHost.on('SIGTERM', forwardTermination);
      child.once('error', (error) => { cleanup(); reject(error); });
      child.once('exit', (code, signal) => { cleanup(); resolve({ code: cancelled ? cancelled === 'SIGINT' ? 130 : 143 : code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1), signal: cancelled ?? signal }); });
    });
    if (result.code !== 0) return result;
  }
  return { code: 0, signal: null };
}
