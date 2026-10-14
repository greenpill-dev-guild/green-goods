import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Bounded local media tools (Poppler, LibreOffice, ffmpeg). Each run gets a fresh private
 * directory, a minimal environment with no secrets, a wall-clock limit, capped output and cleanup
 * on every path. A tool process is not a sandbox by itself: network isolation and resource limits
 * come from the worker container.
 */
export class LocalToolError extends Error {
  constructor(readonly reason: "unavailable" | "timeout" | "failed" | "too_large") {
    super(`Local media tool failed: ${reason}`);
    this.name = "LocalToolError";
  }
}

export function runTool(
  command: string,
  args: string[],
  options: { cwd: string; timeoutMs: number; maxOutput: number }
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options.cwd,
        timeout: options.timeoutMs,
        maxBuffer: options.maxOutput,
        killSignal: "SIGKILL",
        env: { PATH: process.env.PATH ?? "/usr/bin:/bin", HOME: options.cwd, LANG: "C.UTF-8" },
      },
      (error, stdout) => {
        if (!error) return resolve(String(stdout));
        const code = (error as NodeJS.ErrnoException & { killed?: boolean }).code;
        if (code === "ENOENT") return reject(new LocalToolError("unavailable"));
        if ((error as { killed?: boolean }).killed) return reject(new LocalToolError("timeout"));
        reject(new LocalToolError("failed"));
      }
    );
  });
}

export async function withWorkspace<T>(
  prefix: string,
  work: (dir: string) => Promise<T>
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
