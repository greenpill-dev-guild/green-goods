import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { concat, getAddress, getCreateAddress, Interface, isAddress } from "ethers";
import type { VoucherArtifact } from "./voucher-release";

export const STEWARD_CONTRACTS = ["StewardRolePublisher", "StewardSafeReceiver"] as const;
export type StewardNetwork = "arbitrum" | "gnosis";
interface Chain {
  chainId: number;
  router: string | null;
  deployer: string | null;
  nonce: number | null;
}
export interface StewardManifest {
  schemaVersion: 1 | 2;
  sourceSafe?: { expectedTopHat: string | null; salt: string };
  releaseId: string;
  threshold: 2;
  bootstrapSigner?: string | null;
  greenGoodsSafe: string;
  garden: string | null;
  gardenName: string | null;
  hatsModule: string | null;
  stewardHat: string | null;
  expectedTopHat: string | null;
  salt: string;
  confirmedStewards: string[];
  networks: Record<StewardNetwork, Chain>;
}
export type StewardArtifacts = Record<(typeof STEWARD_CONTRACTS)[number], VoucherArtifact> & {
  StewardSafePublisher?: VoucherArtifact;
};
export function stewardContracts(manifest: StewardManifest) {
  return [
    manifest.schemaVersion === 2 ? "StewardSafePublisher" : "StewardRolePublisher",
    "StewardSafeReceiver",
  ] as const;
}
export interface StewardPlan {
  schemaVersion: 1;
  /** The Safe mirrors the steward roster: one steward signs alone, two or more need two signatures. */
  kind: "ROSTER_STEWARD_SAFE";
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  artifactHashes: Record<string, string>;
  transactions: Array<{
    network: StewardNetwork;
    chainId: number;
    from: string;
    nonce: number;
    address: string;
    to: null;
    value: "0";
    contract: string;
    data: string;
  }>;
  observerRegistration: { chainId: 42161; to: string; value: "0"; data: string; authority: string };
  activationIncluded: boolean;
  liveBroadcast: false;
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function object(value: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label}.${key}`);
  for (const key of allowed) if (!Object.hasOwn(value, key)) throw new Error(`Missing ${label}.${key}`);
  return value as Record<string, unknown>;
}
export function inspectStewardManifest(value: unknown): {
  manifest: StewardManifest;
  missing: string[];
  activationMissing: string[];
} {
  const root = object(
    value,
    [
      "schemaVersion",
      ...((value as StewardManifest)?.schemaVersion === 2 ? ["sourceSafe"] : []),
      "releaseId",
      "threshold",
      ...(Object.hasOwn(value as object, "bootstrapSigner") ? ["bootstrapSigner"] : []),
      "greenGoodsSafe",
      "garden",
      "gardenName",
      "hatsModule",
      "stewardHat",
      "expectedTopHat",
      "salt",
      "confirmedStewards",
      "networks",
    ],
    "manifest",
  );
  if (
    ![1, 2].includes(root.schemaVersion as number) ||
    root.threshold !== 2 ||
    typeof root.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(root.releaseId)
  )
    throw new Error("Invalid steward Safe release identity");
  if (root.greenGoodsSafe !== "0x1B9Ac97Ea62f69521A14cbe6F45eb24aD6612C19")
    throw new Error("Preserve existing Green Goods pool and reserve Safe");
  const missing: string[] = [];
  function address(value: unknown, label: string) {
    if (value === null) {
      missing.push(label);
      return;
    }
    if (typeof value !== "string" || !isAddress(value) || BigInt(value) <= 1n) throw new Error(`Invalid ${label}`);
  }
  function uint(value: unknown, label: string, zero = false) {
    if (value === null) {
      missing.push(label);
      return;
    }
    if (
      typeof value !== "string" ||
      !/^(0|[1-9][0-9]*)$/.test(value) ||
      BigInt(value) < (zero ? 0n : 1n) ||
      BigInt(value) >= 1n << 256n
    )
      throw new Error(`Invalid ${label}`);
  }
  if (root.bootstrapSigner !== undefined && root.bootstrapSigner !== null)
    address(root.bootstrapSigner, "bootstrapSigner");
  if (root.schemaVersion === 2) {
    if (root.bootstrapSigner !== null && root.bootstrapSigner !== undefined)
      throw new Error("Dual steward Safes cannot use a bootstrap signer");
    const source = object(root.sourceSafe, ["expectedTopHat", "salt"], "sourceSafe");
    uint(source.expectedTopHat, "sourceSafe.expectedTopHat");
    uint(source.salt, "sourceSafe.salt", true);
    if (source.expectedTopHat !== null && (BigInt(source.expectedTopHat as string) & ((1n << 224n) - 1n)) !== 0n)
      throw new Error("Expected source top Hat must identify a root tree");
  }
  address(root.garden, "garden");
  // The receiver names the garden's Hats tree with it; Hats details accept any non-empty label.
  if (root.gardenName === null) missing.push("gardenName");
  else if (typeof root.gardenName !== "string" || !/^\S(?:.{0,62}\S)?$/.test(root.gardenName))
    throw new Error("Invalid gardenName");
  address(root.hatsModule, "hatsModule");
  uint(root.stewardHat, "stewardHat");
  uint(root.expectedTopHat, "expectedTopHat");
  uint(root.salt, "salt", true);
  if (root.expectedTopHat !== null && (BigInt(root.expectedTopHat as string) & ((1n << 224n) - 1n)) !== 0n)
    throw new Error("Expected top Hat must identify a root tree");
  const networks = object(root.networks, ["arbitrum", "gnosis"], "networks");
  for (const [network, chainId] of [
    ["arbitrum", 42161],
    ["gnosis", 100],
  ] as const) {
    const c = object(networks[network], ["chainId", "router", "deployer", "nonce"], network);
    if (c.chainId !== chainId) throw new Error("Wrong steward chain");
    address(c.router, `${network}.router`);
    address(c.deployer, `${network}.deployer`);
    if (c.nonce === null) missing.push(`${network}.nonce`);
    else if (!Number.isSafeInteger(c.nonce) || (c.nonce as number) < 0) throw new Error(`Invalid ${network}.nonce`);
  }
  if (!Array.isArray(root.confirmedStewards) || root.confirmedStewards.length > 100)
    throw new Error("Invalid confirmedStewards");
  const accounts = new Set<string>();
  for (const member of root.confirmedStewards) {
    if (member === null) throw new Error("Invalid confirmed steward");
    address(member, "confirmedStewards");
    const normalized = getAddress(member as string);
    if (accounts.has(normalized)) throw new Error("Duplicate confirmed steward");
    accounts.add(normalized);
  }
  return {
    manifest: value as StewardManifest,
    missing,
    activationMissing: [...(accounts.size < 2 ? ["confirmedStewards"] : []), "nativeTransportFuelAndInitialRefresh"],
  };
}

export function loadStewardArtifacts(out: string, dual = false): StewardArtifacts {
  return Object.fromEntries(
    [...STEWARD_CONTRACTS, ...(dual ? ["StewardSafePublisher"] : [])].map((name) => [
      name,
      JSON.parse(readFileSync(path.join(out, `${name}.sol`, `${name}.json`), "utf8")),
    ]),
  ) as StewardArtifacts;
}

export function inspectStewardArtifacts(artifacts: StewardArtifacts, dual = false): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const name of [dual ? "StewardSafePublisher" : "StewardRolePublisher", "StewardSafeReceiver"] as const) {
    const a = artifacts[name];
    if (!a) throw new Error(`Missing ${name} artifact`);
    const settings = a.metadata.settings;
    if (
      !a.metadata.compiler.version.startsWith("0.8.28+") ||
      !settings.optimizer.enabled ||
      settings.optimizer.runs !== 1 ||
      settings.viaIR !== true ||
      settings.evmVersion !== "cancun" ||
      JSON.stringify(settings.compilationTarget) !== JSON.stringify({ [`src/accounts/${name}.sol`]: name }) ||
      Object.keys(settings.libraries ?? {}).length
    )
      throw new Error("Steward artifacts must use reviewed production settings");
    for (const bytecode of [a.bytecode, a.deployedBytecode]) {
      if (
        !/^(0x)?[0-9a-fA-F]+$/.test(bytecode.object) ||
        bytecode.object.replace(/^0x/, "").length % 2 ||
        Object.keys(bytecode.linkReferences ?? {}).length
      )
        throw new Error("Invalid unlinked steward bytecode");
    }
    if (a.deployedBytecode.object.replace(/^0x/, "").length / 2 > 24576)
      throw new Error("Steward runtime exceeds EIP-170");
    hashes[name] = digest(a);
  }
  return hashes;
}

export function buildStewardPlan(value: unknown, artifacts: StewardArtifacts, sourceCommit: string): StewardPlan {
  const { manifest: m, missing } = inspectStewardManifest(value);
  if (missing.length) throw new Error(`Missing steward deployment inputs: ${missing.join(", ")}`);
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("Invalid source revision");
  const addresses = Object.fromEntries(
    (Object.keys(m.networks) as StewardNetwork[]).map((network) => [
      network,
      getCreateAddress({ from: m.networks[network].deployer!, nonce: m.networks[network].nonce! }),
    ]),
  );
  const transactions = (["arbitrum", "gnosis"] as const).map((network, index) => {
    const c = m.networks[network],
      name = stewardContracts(m)[index];
    const args =
      network === "arbitrum"
        ? [
            c.router,
            m.hatsModule,
            m.garden,
            m.stewardHat,
            addresses.gnosis,
            ...(m.schemaVersion === 2 ? [m.gardenName, m.sourceSafe!.expectedTopHat, m.sourceSafe!.salt] : []),
          ]
        : [
            c.router,
            addresses.arbitrum,
            m.garden,
            m.gardenName,
            m.expectedTopHat,
            m.salt,
            m.bootstrapSigner ?? "0x0000000000000000000000000000000000000000",
          ];
    return {
      network,
      chainId: c.chainId,
      contract: name,
      from: getAddress(c.deployer!),
      nonce: c.nonce!,
      address: addresses[network],
      to: null,
      value: "0" as const,
      data: concat([
        `0x${artifacts[name]!.bytecode.object.replace(/^0x/, "")}`,
        new Interface(artifacts[name]!.abi).encodeDeploy(args),
      ]),
    };
  });
  return {
    schemaVersion: 1,
    kind: "ROSTER_STEWARD_SAFE",
    releaseId: m.releaseId,
    sourceCommit,
    manifestHash: digest(m),
    artifactHashes: inspectStewardArtifacts(artifacts, m.schemaVersion === 2),
    transactions,
    observerRegistration: {
      chainId: 42161,
      to: getAddress(m.hatsModule!),
      value: "0",
      data: new Interface(["function setStewardObserver(address,address)"]).encodeFunctionData("setStewardObserver", [
        m.garden,
        addresses.arbitrum,
      ]),
      authority: "HatsModule owner; separate reviewed upgrade/registration, not executed by this plan",
    },
    activationIncluded: Boolean(m.bootstrapSigner),
    liveBroadcast: false,
  };
}
export function validateStewardPlan(
  plan: unknown,
  m: unknown,
  a: StewardArtifacts,
  commit: string,
): asserts plan is StewardPlan {
  if (digest(plan) !== digest(buildStewardPlan(m, a, commit))) throw new Error("Steward release plan mismatch");
}

export const STEWARD_PUBLISHER_ABI = [
  "function router() view returns(address)",
  "function garden() view returns(address)",
  "function receiver() view returns(address)",
  "function hatsModule() view returns(address)",
  "function stewardHat() view returns(uint256)",
  "function quoteSteward(address) view returns(uint256)",
  "function dispatchSteward(address) payable returns(bytes32)",
];
export const STEWARD_RECEIVER_ABI = [
  "function publisher() view returns(address)",
  "function garden() view returns(address)",
  "function ownerHat() view returns(uint256)",
  "function signerHat() view returns(uint256)",
  "function gate() view returns(address)",
  "function safe() view returns(address)",
  "function getRouter() view returns(address)",
];
