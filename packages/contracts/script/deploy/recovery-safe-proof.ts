export interface InvalidEip1271Probe {
  reverted: boolean;
  data: string | null;
}

interface OfficialCodeCheck {
  matches: boolean;
}

interface RecoverySafeCheck {
  proxyRuntimeHashMatchesOfficialFactory: boolean;
  liveStateChecks: Record<string, boolean>;
  invalidEip1271Probe: InvalidEip1271Probe;
}

const EIP1271_MAGIC_VALUE = "0x1626ba7e";

export function invalidEip1271ProbeRejectsMalformedSignature(probe: InvalidEip1271Probe): boolean {
  if (probe.reverted) return true;
  if (probe.data === null) return false;
  return probe.data.slice(0, EIP1271_MAGIC_VALUE.length).toLowerCase() !== EIP1271_MAGIC_VALUE;
}

export function assertRecoverySafeProof(
  officialCode: Record<string, OfficialCodeCheck>,
  recoverySafes: Record<string, RecoverySafeCheck>,
): void {
  for (const [name, check] of Object.entries(officialCode)) {
    if (!check.matches) throw new Error(`Official ${name} code identity does not match`);
  }

  for (const [name, safe] of Object.entries(recoverySafes)) {
    if (!safe.proxyRuntimeHashMatchesOfficialFactory) {
      throw new Error(`${name} proxy runtime does not match the official Safe factory`);
    }
    for (const [checkName, passed] of Object.entries(safe.liveStateChecks)) {
      if (!passed) throw new Error(`${name} failed live state check: ${checkName}`);
    }
    if (!invalidEip1271ProbeRejectsMalformedSignature(safe.invalidEip1271Probe)) {
      throw new Error(`${name} accepted the malformed EIP-1271 signature probe`);
    }
  }
}
