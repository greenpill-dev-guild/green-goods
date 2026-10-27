import { decodeFunctionResult, encodeFunctionData, type Hex, multicall3Abi, parseAbi } from "viem";
import { getChain } from "../../config/chains";
import type { Address } from "../../types/domain";
import { logger } from "../app/logger";
import type { ServiceChainRead } from "./service-access-chain";
import { serviceAddress, serviceUint } from "./service-access-chain-values";
import type {
  IssuerSafeThreshold,
  VoucherIssuer,
  VoucherIssuerApproval,
} from "./service-access-wallet-types";

const SAFE_ABI = parseAbi([
  "function getThreshold() view returns (uint256)",
  "function getOwners() view returns (address[])",
]);
/** A Safe's owner list is bounded in practice; a larger answer is not a Safe we can trust. */
const MAX_SAFE_OWNERS = 255;

/**
 * A Safe's threshold, its owners and their count; null when the read fails or the answer is
 * impossible. Both ride one batched call, so they come from one block: two separate reads could
 * straddle a change of rule and pair the old threshold with the new owners, a rule the Safe never
 * had.
 */
async function readSafeRule(
  read: ServiceChainRead,
  chainId: number,
  safe: Address
): Promise<{ threshold: number; owners: number; signers: Address[] } | null> {
  try {
    const batch = getChain(chainId).contracts?.multicall3?.address;
    if (!batch) throw new Error("No batch reader on the Safe's chain");
    const call = (functionName: "getThreshold" | "getOwners") => ({
      target: safe,
      allowFailure: false,
      callData: encodeFunctionData({ abi: SAFE_ABI, functionName }),
    });
    const results = await read({
      chainId,
      address: batch,
      abi: multicall3Abi,
      functionName: "aggregate3",
      args: [[call("getThreshold"), call("getOwners")]],
    });
    const [thresholdResult, ownersResult] = (Array.isArray(results) ? results : []) as readonly {
      returnData?: Hex;
    }[];
    if (!thresholdResult?.returnData || !ownersResult?.returnData)
      throw new Error("Malformed Safe rule read");
    const rawThreshold = decodeFunctionResult({
      abi: SAFE_ABI,
      functionName: "getThreshold",
      data: thresholdResult.returnData,
    });
    const rawOwners = decodeFunctionResult({
      abi: SAFE_ABI,
      functionName: "getOwners",
      data: ownersResult.returnData,
    });
    const threshold = serviceUint(rawThreshold);
    if (!Array.isArray(rawOwners) || rawOwners.length > MAX_SAFE_OWNERS)
      throw new Error("Malformed Safe owner list");
    const signers = [...new Set(rawOwners.map(serviceAddress))];
    const owners = signers.length;
    if (owners !== rawOwners.length || threshold < 1n || threshold > BigInt(owners))
      throw new Error("Safe threshold outside its owners");
    return { threshold: Number(threshold), owners, signers };
  } catch (error) {
    logger.warn("Issuer Safe threshold read failed", { error, safe });
    return null;
  }
}

/** An issuer Safe's signature rule in the console's contract: a count and owners only when observed. */
export async function readIssuerSafeThreshold(
  read: ServiceChainRead,
  chainId: number,
  safe: Address
): Promise<IssuerSafeThreshold> {
  const rule = await readSafeRule(read, chainId, safe);
  return rule
    ? { safe, status: "observed", ...rule }
    : { safe, status: "unavailable", threshold: null, owners: null, signers: null };
}

/** The signature count comes from the Safe itself; a member issuer approves from its own account. */
export async function readVoucherIssuerApproval(
  read: ServiceChainRead,
  issuer: Pick<VoucherIssuer, "account" | "kind" | "asset">
): Promise<VoucherIssuerApproval> {
  if (issuer.kind === "individual") return { kind: "account", evidence: "onchain" };
  const rule = await readSafeRule(read, issuer.asset.chainId, issuer.account);
  return rule
    ? { kind: "safe", evidence: "onchain", threshold: rule.threshold, owners: rule.owners }
    : { kind: "unavailable", reason: "read-failed" };
}
