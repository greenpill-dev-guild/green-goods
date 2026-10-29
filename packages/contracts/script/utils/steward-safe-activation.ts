import { Contract, type JsonRpcProvider } from "ethers";
import { readStewardDeployment } from "./steward-safe-readback";
import {
  inspectStewardManifest,
  type StewardArtifacts,
  type StewardManifest,
  type StewardNetwork,
  type StewardPlan,
} from "./steward-safe-release";

/** A private observed roster refines readiness checks, never deployment inputs or onchain authority. */
export function withStewardActivationRoster(manifest: StewardManifest, value: unknown): StewardManifest {
  const roster = value as { garden?: string; stewardHat?: string; accounts?: unknown } | null;
  if (
    !roster ||
    Object.keys(roster).sort().join() !== "accounts,garden,stewardHat" ||
    roster.garden?.toLowerCase() !== manifest.garden?.toLowerCase() ||
    roster.stewardHat !== manifest.stewardHat
  )
    throw new Error("Activation roster belongs to a different canonical garden authority");
  return inspectStewardManifest({ ...manifest, confirmedStewards: roster.accounts }).manifest;
}

/** Current coordination state only; signer control and permission to issue value remain separate. */
export async function readStewardActivation(
  plan: StewardPlan,
  manifest: StewardManifest,
  artifacts: StewardArtifacts,
  providers: Record<StewardNetwork, JsonRpcProvider>,
) {
  if (manifest.schemaVersion !== 2 || manifest.confirmedStewards.length < 2)
    throw new Error("Activation requires a dual-Safe release and a reviewed roster of at least two stewards");
  const blocks = {
    arbitrum: await providers.arbitrum.getBlock("latest"),
    gnosis: await providers.gnosis.getBlock("latest"),
  };
  if (!blocks.arbitrum?.hash || !blocks.gnosis?.hash) throw new Error("Missing activation snapshot blocks");
  const sourceAt = { blockTag: blocks.arbitrum.number },
    destinationAt = { blockTag: blocks.gnosis.number };
  const source = plan.transactions.find((tx) => tx.network === "arbitrum")!.address;
  const destination = plan.transactions.find((tx) => tx.network === "gnosis")!.address;
  const authority = new Contract(
    manifest.hatsModule!,
    [
      "function stewardObserver(address) view returns(address)",
      "function isStewardOf(address,address) view returns(bool)",
    ],
    providers.arbitrum,
  );
  const publisher = new Contract(
    source,
    [
      "function states(address) view returns(uint64,bool)",
      "function dispatchedRevision(address) view returns(uint64)",
      "function quoteSteward(address) view returns(uint256)",
    ],
    providers.arbitrum,
  );
  const receiver = new Contract(destination, ["function states(address) view returns(uint64,bool)"], providers.gnosis);
  const pending: string[] = [];
  if ((await authority.stewardObserver(manifest.garden, sourceAt)).toLowerCase() !== source.toLowerCase())
    pending.push("observerRegistration");
  const rows = [];
  let initialRefreshFee = 0n;
  for (const account of manifest.confirmedStewards) {
    const canonical = await authority.isStewardOf(manifest.garden, account, sourceAt);
    const local = await publisher.states(account, sourceAt),
      remote = await receiver.states(account, destinationAt);
    const dispatched = await publisher.dispatchedRevision(account, sourceAt);
    if (!canonical || !local[1] || !remote[1] || local[0] === 0n || local[0] !== remote[0] || local[0] !== dispatched)
      pending.push(`stewardRevision:${account}`);
    initialRefreshFee += await publisher.quoteSteward(account, sourceAt);
    rows.push({
      account,
      canonical,
      sourceRevision: String(local[0]),
      dispatchedRevision: String(dispatched),
      destinationRevision: String(remote[0]),
      sourceEligible: local[1],
      destinationEligible: remote[1],
    });
  }
  const balance = await providers.arbitrum.getBalance(source, blocks.arbitrum.number);
  if (balance < initialRefreshFee) pending.push("nativeTransportFuelBelowOneRosterRefresh");
  const safes = [];
  const expected = manifest.confirmedStewards.map((account) => account.toLowerCase()).sort();
  for (const network of ["arbitrum", "gnosis"] as const) {
    const snapshot = await readStewardDeployment(
      plan,
      manifest,
      artifacts,
      network,
      providers[network],
      false,
      blocks[network]!.number,
    );
    const safe = snapshot.safe!;
    const owners = (safe.owners as string[]).map((account) => account.toLowerCase()).sort();
    if (
      JSON.stringify(owners) !== JSON.stringify(expected) ||
      safe.validSigners !== expected.length ||
      safe.physicalThreshold !== 2
    )
      pending.push(`safeRoster:${network}`);
    safes.push(snapshot);
  }
  return {
    state: pending.length ? "coordination-pending" : "coordination-verified",
    pending,
    rows,
    safes,
    blocks: Object.fromEntries(
      Object.entries(blocks).map(([network, block]) => [network, { number: block!.number, hash: block!.hash }]),
    ),
    transportBalanceWei: String(balance),
    oneRosterRefreshQuoteWei: String(initialRefreshFee),
    rosterBasis: "reviewed manifest; exhaustive canonical role enumeration and human signer control are not proved",
    valueAuthorityReady: false,
    liveBroadcast: false,
  };
}
