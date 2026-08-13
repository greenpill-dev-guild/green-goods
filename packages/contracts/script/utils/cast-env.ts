export function buildReadOnlyCastEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sanitized = { ...env };
  delete sanitized.ETH_PASSWORD;
  return sanitized;
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
