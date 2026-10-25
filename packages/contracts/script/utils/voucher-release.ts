import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  concat,
  getAddress,
  getCreateAddress,
  Interface,
  isAddress,
  keccak256,
  type InterfaceAbi,
  ZeroAddress,
} from "ethers";
import { linkBytecode } from "./release-manifest";

export const VOUCHER_CONTRACTS = [
  { name: "VoucherServiceConsentLib", source: "src/lib/VoucherService/VoucherServiceConsentLib.sol" },
  { name: "VoucherServiceResultLib", source: "src/lib/VoucherService/VoucherServiceResultLib.sol" },
  { name: "VoucherRedemptionTransfers", source: "src/libraries/VoucherRedemptionTransfers.sol" },
  ...["VoucherEntitlementModule", "VoucherRedemptionModule", "GnosisVoucherAdapter", "GnosisVoucherEscrow"].map(
    (name) => ({ name, source: `src/modules/${name}.sol` }),
  ),
  {
    name: "ERC1967Proxy",
    source: "lib/tokenbound/lib/openzeppelin-contracts/contracts/proxy/ERC1967/ERC1967Proxy.sol",
  },
];
export type VoucherNetwork = "arbitrum" | "gnosis";
interface ChainInputs {
  chainId: number;
  selector: string | null;
  router: string | null;
  deployer: string | null;
  nonce: number | null;
  owner: string | null;
  guardian: string | null;
  commitmentPooling?: string | null;
  hatsModule?: string | null;
}
export interface VoucherManifest {
  schemaVersion: 1;
  releaseId: string;
  build: { solc: string; optimizerRuns: number; viaIR: boolean; evmVersion: string };
  governance: Record<
    "greenGoods" | "techAndSun" | "sharedPool",
    { address: string | null; threshold: number; ownerCount: number }
  >;
  networks: Record<VoucherNetwork, ChainInputs>;
}
export interface VoucherArtifact {
  abi: InterfaceAbi;
  bytecode: {
    object: string;
    linkReferences?: Record<string, Record<string, Array<{ start: number; length: number }>>>;
  };
  deployedBytecode: {
    object: string;
    linkReferences?: VoucherArtifact["bytecode"]["linkReferences"];
    immutableReferences?: Record<string, Array<{ start: number; length: number }>>;
  };
  metadata: {
    compiler: { version: string };
    settings: {
      optimizer: { enabled: boolean; runs: number };
      viaIR: boolean;
      evmVersion: string;
      libraries?: Record<string, unknown>;
      compilationTarget: Record<string, string>;
    };
  };
}
export type VoucherArtifacts = Record<string, VoucherArtifact>;
export interface VoucherTransaction {
  network: VoucherNetwork;
  chainId: number;
  contract: string;
  kind: "library" | "implementation" | "proxy";
  from: string;
  nonce: number;
  address: string;
  to: null;
  value: "0";
  data: string;
  creationCodeHash: string;
  runtimeTemplate: string;
  immutableReferences: VoucherArtifact["deployedBytecode"]["immutableReferences"];
  initializer?: string;
}
export interface VoucherPlan {
  schemaVersion: 1;
  kind: "PAUSED_VOUCHER_ENDPOINTS";
  releaseId: string;
  sourceCommit: string;
  manifestHash: string;
  buildProfile: "production";
  artifactHashes: Record<string, string>;
  transactions: VoucherTransaction[];
  activationIncluded: false;
  canonicalArtifactsChanged: false;
}
export const voucherDigest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function object(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`Invalid ${label}`);
  return value as Record<string, unknown>;
}
function keys(value: Record<string, unknown>, allowed: string[], label: string) {
  for (const key of Object.keys(value)) if (!allowed.includes(key)) throw new Error(`Unknown ${label}.${key}`);
}
export function inspectVoucherManifest(value: unknown): {
  manifest: VoucherManifest;
  missing: string[];
  activationMissing: string[];
} {
  const root = object(value, "voucher manifest");
  keys(root, ["schemaVersion", "releaseId", "build", "governance", "networks"], "manifest");
  if (
    root.schemaVersion !== 1 ||
    typeof root.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(root.releaseId)
  )
    throw new Error("Invalid voucher release identity");
  const build = object(root.build, "build");
  keys(build, ["solc", "optimizerRuns", "viaIR", "evmVersion"], "build");
  if (build.solc !== "0.8.28" || build.optimizerRuns !== 1 || build.viaIR !== true || build.evmVersion !== "cancun")
    throw new Error("Voucher build must use the reviewed production settings");
  const missing: string[] = [],
    activationMissing: string[] = [];
  const address = (value: unknown, label: string, list = missing) => {
    if (value === null) {
      list.push(label);
      return;
    }
    if (typeof value !== "string" || !isAddress(value) || getAddress(value) === ZeroAddress)
      throw new Error(`Invalid address ${label}`);
  };
  const governance = object(root.governance, "governance");
  keys(governance, ["greenGoods", "techAndSun", "sharedPool"], "governance");
  for (const role of ["greenGoods", "techAndSun", "sharedPool"]) {
    const entry = object(governance[role], `governance.${role}`);
    keys(entry, ["address", "threshold", "ownerCount"], `governance.${role}`);
    if (
      !Number.isInteger(entry.threshold) ||
      !Number.isInteger(entry.ownerCount) ||
      Number(entry.threshold) < 2 ||
      Number(entry.threshold) > Number(entry.ownerCount)
    )
      throw new Error(`Invalid Safe threshold governance.${role}`);
    address(entry.address, `governance.${role}.address`, activationMissing);
  }
  const networks = object(root.networks, "networks");
  keys(networks, ["arbitrum", "gnosis"], "networks");
  for (const [name, id] of [
    ["arbitrum", 42161],
    ["gnosis", 100],
  ] as const) {
    const chain = object(networks[name], `networks.${name}`);
    keys(
      chain,
      [
        "chainId",
        "selector",
        "router",
        "deployer",
        "nonce",
        "owner",
        "guardian",
        ...(name === "arbitrum" ? ["commitmentPooling", "hatsModule"] : []),
      ],
      `networks.${name}`,
    );
    if (chain.chainId !== id) throw new Error(`Wrong chain networks.${name}`);
    if (chain.selector === null) missing.push(`networks.${name}.selector`);
    else if (
      typeof chain.selector !== "string" ||
      !/^[1-9][0-9]*$/.test(chain.selector) ||
      BigInt(chain.selector) > 2n ** 64n - 1n
    )
      throw new Error(`Invalid selector networks.${name}`);
    if (
      chain.selector !== null &&
      chain.selector !== { arbitrum: "4949039107694359620", gnosis: "465200170687744372" }[name]
    )
      throw new Error(`Wrong CCIP selector networks.${name}`);
    if (chain.nonce === null) missing.push(`networks.${name}.nonce`);
    else if (
      !Number.isSafeInteger(chain.nonce) ||
      Number(chain.nonce) < 0 ||
      Number(chain.nonce) > Number.MAX_SAFE_INTEGER - 10
    )
      throw new Error(`Invalid nonce networks.${name}`);
    for (const field of [
      "router",
      "deployer",
      "owner",
      "guardian",
      ...(name === "arbitrum" ? ["commitmentPooling", "hatsModule"] : []),
    ])
      address(chain[field], `networks.${name}.${field}`);
    if (chain.owner && chain.guardian && String(chain.owner).toLowerCase() === String(chain.guardian).toLowerCase())
      throw new Error(`Owner and guardian must differ on ${name}`);
  }
  const manifest = value as VoucherManifest;
  if (manifest.networks.arbitrum.selector && manifest.networks.arbitrum.selector === manifest.networks.gnosis.selector)
    throw new Error("Peer chain selectors must differ");
  return { manifest, missing, activationMissing };
}
export function loadVoucherArtifacts(root: string): VoucherArtifacts {
  return Object.fromEntries(
    VOUCHER_CONTRACTS.map(({ name }) => [
      name,
      JSON.parse(readFileSync(path.join(root, `${name}.sol`, `${name}.json`), "utf8")),
    ]),
  );
}
function artifactFor(name: string, artifacts: VoucherArtifacts, manifest: VoucherManifest): VoucherArtifact {
  const artifact = artifacts[name];
  if (!artifact?.bytecode?.object || !artifact.deployedBytecode?.object) throw new Error(`Missing artifact ${name}`);
  const metadata = artifact.metadata;
  const source = VOUCHER_CONTRACTS.find((contract) => contract.name === name)!.source;
  if (JSON.stringify(metadata?.settings?.compilationTarget) !== JSON.stringify({ [source]: name }))
    throw new Error(`Unexpected production compilation target ${name}`);
  if (
    metadata?.compiler?.version?.split("+")[0] !== manifest.build.solc ||
    metadata.settings.optimizer.enabled !== true ||
    metadata.settings.optimizer.runs !== manifest.build.optimizerRuns ||
    metadata.settings.viaIR !== true ||
    metadata.settings.evmVersion !== manifest.build.evmVersion
  )
    throw new Error(`Not reviewed production artifact ${name}`);
  if (Object.keys(metadata.settings.libraries ?? {}).length) throw new Error(`Already-linked artifact ${name}`);
  if (artifact.deployedBytecode.object.length <= 2 || (artifact.deployedBytecode.object.length - 2) / 2 > 24576)
    throw new Error(`Invalid production runtime size ${name}`);
  const placeholders = Object.fromEntries(
    VOUCHER_CONTRACTS.map((c) => [`${c.source}:${c.name}`, "0x0000000000000000000000000000000000000001"]),
  );
  for (const part of [artifact.bytecode, artifact.deployedBytecode]) {
    for (const libraries of Object.values(part.linkReferences ?? {}))
      for (const slots of Object.values(libraries))
        for (const slot of slots)
          if (
            !Number.isSafeInteger(slot.start) ||
            slot.start < 0 ||
            slot.length !== 20 ||
            slot.start + slot.length > (part.object.length - 2) / 2
          )
            throw new Error(`Invalid production link offset ${name}`);
    if (!/^0x(?:[0-9a-fA-F]{2})+$/.test(linkBytecode(part.object, part.linkReferences, placeholders)))
      throw new Error(`Unresolved production bytecode ${name}`);
  }
  return artifact;
}
export function inspectVoucherArtifacts(artifacts: VoucherArtifacts, manifest: VoucherManifest) {
  return Object.fromEntries(
    VOUCHER_CONTRACTS.map(({ name }) => [name, voucherDigest(artifactFor(name, artifacts, manifest))]),
  );
}
export function buildVoucherPlan(input: unknown, artifacts: VoucherArtifacts, sourceCommit: string): VoucherPlan {
  const { manifest, missing } = inspectVoucherManifest(input);
  if (missing.length) throw new Error(`Missing deployment inputs: ${missing.join(", ")}`);
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("An exact source commit is required");
  const sequences: Record<VoucherNetwork, Array<[string, VoucherTransaction["kind"]]>> = {
    arbitrum: [
      ["VoucherServiceConsentLib", "library"],
      ["VoucherServiceResultLib", "library"],
      ["VoucherEntitlementModule", "implementation"],
      ["VoucherEntitlementModule", "proxy"],
      ["VoucherRedemptionModule", "implementation"],
      ["VoucherRedemptionModule", "proxy"],
    ],
    gnosis: [
      ["VoucherRedemptionTransfers", "library"],
      ["GnosisVoucherAdapter", "implementation"],
      ["GnosisVoucherAdapter", "proxy"],
      ["GnosisVoucherEscrow", "implementation"],
      ["GnosisVoucherEscrow", "proxy"],
    ],
  };
  const predicted: Record<string, string> = {};
  for (const network of ["arbitrum", "gnosis"] as const)
    for (const [i, [name, kind]] of sequences[network].entries())
      predicted[`${name}:${kind}`] = getCreateAddress({
        from: manifest.networks[network].deployer!,
        nonce: manifest.networks[network].nonce! + i,
      });
  const libraries = Object.fromEntries(
    VOUCHER_CONTRACTS.filter((c) => predicted[`${c.name}:library`]).map((c) => [
      `${c.source}:${c.name}`,
      predicted[`${c.name}:library`],
    ]),
  );
  const artifactHashes = inspectVoucherArtifacts(artifacts, manifest);
  const transactions: VoucherTransaction[] = [];
  for (const network of ["arbitrum", "gnosis"] as const) {
    const chain = manifest.networks[network],
      peer = manifest.networks[network === "arbitrum" ? "gnosis" : "arbitrum"];
    for (const [i, [name, kind]] of sequences[network].entries()) {
      const artifact = artifacts[kind === "proxy" ? "ERC1967Proxy" : name];
      const bytecode = linkBytecode(artifact.bytecode.object, artifact.bytecode.linkReferences, libraries);
      const runtimeTemplate = linkBytecode(
        artifact.deployedBytecode.object,
        artifact.deployedBytecode.linkReferences,
        libraries,
      );
      if (!/^0x(?:[a-fA-F0-9]{2})+$/.test(bytecode) || !/^0x(?:[a-fA-F0-9]{2})+$/.test(runtimeTemplate))
        throw new Error(`Unresolved bytecode ${name}`);
      // Libraries take no constructor arguments; their Solidity-only enum ABI types are not deployment inputs.
      const iface = new Interface(kind === "library" ? [] : artifact.abi);
      let initializer: string | undefined;
      let arguments_: unknown[] = [];
      if (kind === "implementation") arguments_ = [chain.router];
      if (kind === "proxy") {
        const peerName =
          name === "VoucherEntitlementModule"
            ? "GnosisVoucherAdapter"
            : name === "VoucherRedemptionModule"
              ? "GnosisVoucherEscrow"
              : name === "GnosisVoucherAdapter"
                ? "VoucherEntitlementModule"
                : "VoucherRedemptionModule";
        const initArgs: unknown[] = [
          chain.owner,
          chain.guardian,
          peer.selector,
          peer.chainId,
          predicted[`${peerName}:proxy`],
        ];
        if (name === "VoucherEntitlementModule") initArgs.push(chain.commitmentPooling, chain.hatsModule);
        if (name === "VoucherRedemptionModule") initArgs.push(chain.commitmentPooling);
        initializer = new Interface(artifacts[name].abi).encodeFunctionData("initialize", initArgs);
        arguments_ = [predicted[`${name}:implementation`], initializer];
      }
      const data = concat([bytecode, iface.encodeDeploy(arguments_)]);
      transactions.push({
        network,
        chainId: chain.chainId,
        contract: name,
        kind,
        from: getAddress(chain.deployer!),
        nonce: chain.nonce! + i,
        address: predicted[`${name}:${kind}`],
        to: null,
        value: "0",
        data,
        creationCodeHash: keccak256(data),
        runtimeTemplate,
        immutableReferences: artifact.deployedBytecode.immutableReferences ?? {},
        ...(initializer ? { initializer } : {}),
      });
    }
  }
  return {
    schemaVersion: 1,
    kind: "PAUSED_VOUCHER_ENDPOINTS",
    releaseId: manifest.releaseId,
    sourceCommit,
    manifestHash: voucherDigest(manifest),
    buildProfile: "production",
    artifactHashes,
    transactions,
    activationIncluded: false,
    canonicalArtifactsChanged: false,
  };
}
export function validateVoucherPlan(
  plan: unknown,
  manifest: unknown,
  artifacts: VoucherArtifacts,
  sourceCommit: string,
): asserts plan is VoucherPlan {
  if (JSON.stringify(plan) !== JSON.stringify(buildVoucherPlan(manifest, artifacts, sourceCommit)))
    throw new Error("Stored voucher plan differs from the reviewed inputs");
}
