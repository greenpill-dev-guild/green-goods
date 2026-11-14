import { parsePublicCommitmentImpactResponse } from "../../public-contracts/commitment-impact";
import { buildPublicCommitmentImpactPath } from "../../public-contracts/routes";
import { withCombinedAbortSignal } from "../../utils/abort-signals";

/** Fetch a cached public snapshot; history and price lookups belong to the Agent API. */
export async function fetchPublicCommitmentImpact(chainId: number, signal?: AbortSignal) {
  const baseUrl =
    import.meta.env.VITE_API_BASE_URL ||
    (import.meta.env.DEV ? "http://localhost:3000" : "https://agent.greengoods.app");
  return withCombinedAbortSignal([signal, AbortSignal.timeout(45000)], async (requestSignal) => {
    const response = await fetch(
      `${baseUrl.replace(/\/$/, "")}${buildPublicCommitmentImpactPath(chainId)}`,
      { signal: requestSignal }
    );
    if (!response.ok) throw new Error("Commitment impact is unavailable");
    return parsePublicCommitmentImpactResponse(await response.json(), chainId);
  });
}
