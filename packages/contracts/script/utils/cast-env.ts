import { execFileSync } from "node:child_process";
import { redactRpcUrlsInText } from "./cli-parser";

export function buildReadOnlyCastEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sanitized = { ...env };
  delete sanitized.ETH_PASSWORD;
  return sanitized;
}

export function formatCastFailure(error: unknown, context: string): Error {
  const stderr =
    error && typeof error === "object" && "stderr" in error
      ? (error as { stderr?: Buffer | string }).stderr
      : undefined;
  const detail = stderr ? String(stderr) : error instanceof Error ? error.message : String(error);
  return new Error(`${context} failed: ${redactRpcUrlsInText(detail).trim()}`);
}

export function execCastCaptured(
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; inputStdio?: "ignore" | "inherit" },
  context: string,
): string {
  try {
    return execFileSync("cast", args, {
      cwd: options.cwd,
      encoding: "utf8",
      env: options.env,
      stdio: [options.inputStdio ?? "ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw formatCastFailure(error, context);
  }
}

export function parseCastTransactionHash(output: string, context: string): string {
  const trimmed = output.trim();
  const candidates = [trimmed];
  if (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length > 1) {
    candidates.push(trimmed.slice(1, -1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      const transactionHash =
        typeof parsed === "string"
          ? parsed
          : parsed && typeof parsed === "object" && "transactionHash" in parsed
            ? (parsed as { transactionHash?: unknown }).transactionHash
            : undefined;
      if (typeof transactionHash === "string" && /^0x[0-9a-fA-F]{64}$/u.test(transactionHash)) {
        return transactionHash;
      }
    } catch {
      // Some Cast/RPC combinations return a single-quoted hash even with --json.
    }
  }
  const hashes = [...new Set(trimmed.match(/0x[0-9a-fA-F]{64}/gu) ?? [])];
  if (hashes.length === 1) return hashes[0];
  throw new Error(`${context} returned no unique transaction hash`);
}
