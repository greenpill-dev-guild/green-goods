export function buildReadOnlyCastEnv(env: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const sanitized = { ...env };
  delete sanitized.ETH_PASSWORD;
  return sanitized;
}
