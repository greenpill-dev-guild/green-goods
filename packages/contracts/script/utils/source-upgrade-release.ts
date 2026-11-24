import { readFileSync } from "node:fs";
import path from "node:path";
import { AbiCoder, getAddress, getCreateAddress, Interface, ZeroAddress } from "ethers";
import { linkBytecode } from "./release-manifest";
import { type VoucherArtifact, voucherDigest } from "./voucher-release";

export const SOURCE_UPGRADE_TARGETS = {
  pooling: "src/modules/CommitmentPooling.sol:CommitmentPoolingModule",
  settlement: "src/modules/SettlementModule.sol:SettlementModule",
} as const;
export type SourceTarget = keyof typeof SOURCE_UPGRADE_TARGETS;
interface ProxyPin {
  proxy: string;
  implementation: string;
  implementationCodeHash: string;
}
export interface SourceUpgradeManifest {
  schemaVersion: 1;
  releaseId: string;
  chainId: 42161;
  observation: { blockNumber: number; blockHash: string };
  deployer: string | null;
  nonce: number | null;
  authority: { address: string; threshold: number; owners: string[]; nonce: number | null };
  pooling: ProxyPin;
  settlement: (ProxyPin & { router: string; sourceSelector: string; destinationChainId: string }) | null;
}
export type SourceUpgradeArtifacts = Record<string, VoucherArtifact>;
export interface SourceUpgradeDeployment {
  key: string;
  kind: "library" | "implementation";
  address: string;
  from: string;
  nonce: number;
  to: null;
  value: "0";
  data: string;
  runtimeTemplate: string;
  immutableReferences: VoucherArtifact["deployedBytecode"]["immutableReferences"];
}
export interface SourceUpgradePlan {
  schemaVersion: 1;
  kind: "PAUSED_EXISTING_SOURCE_UPGRADES";
  releaseId: string;
  chainId: 42161;
  sourceCommit: string;
  manifestHash: string;
  artifactHashes: Record<string, string>;
  deployments: SourceUpgradeDeployment[];
  ownerCalls: Array<{
    target: SourceTarget;
    action: "pause" | "upgrade";
    from: string;
    to: string;
    data: string;
    value: "0";
    operation: 0;
    safeNonce: number;
  }>;
  endState: "paused-original-owner";
  activationIncluded: false;
  liveBroadcast: false;
}
const ownerInterface = new Interface(["function setPaused(bool)", "function upgradeTo(address)"]);
function object(v: unknown, allowed: string[], label: string): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`Invalid ${label}`);
  for (const key of Object.keys(v)) if (!allowed.includes(key)) throw new Error(`Unknown ${label}.${key}`);
  return v as Record<string, unknown>;
}
function address(v: unknown, label: string) {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{40}$/.test(v) || getAddress(v) === ZeroAddress)
    throw new Error(`Invalid ${label}`);
}
function hash(v: unknown, label: string) {
  if (typeof v !== "string" || !/^0x[\da-fA-F]{64}$/.test(v)) throw new Error(`Invalid ${label}`);
}
function integer(v: unknown, label: string) {
  if (!Number.isSafeInteger(v) || Number(v) < 0) throw new Error(`Invalid ${label}`);
}
export function inspectSourceUpgradeManifest(value: unknown): { manifest: SourceUpgradeManifest; missing: string[] } {
  const v = object(
    value,
    ["schemaVersion", "releaseId", "chainId", "observation", "deployer", "nonce", "authority", "pooling", "settlement"],
    "manifest",
  );
  if (
    v.schemaVersion !== 1 ||
    v.chainId !== 42161 ||
    typeof v.releaseId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(v.releaseId)
  )
    throw new Error("Invalid source upgrade identity or chain");
  const observation = object(v.observation, ["blockNumber", "blockHash"], "observation");
  integer(observation.blockNumber, "observation.blockNumber");
  hash(observation.blockHash, "observation.blockHash");
  const missing: string[] = [];
  for (const key of ["deployer", "nonce"] as const) {
    if (v[key] === null) missing.push(key);
    else if (key === "deployer") address(v[key], key);
    else integer(v[key], key);
  }
  const safe = object(v.authority, ["address", "threshold", "owners", "nonce"], "authority");
  address(safe.address, "authority.address");
  integer(safe.threshold, "authority.threshold");
  if (!Array.isArray(safe.owners) || safe.owners.length < Number(safe.threshold) || Number(safe.threshold) < 2)
    throw new Error("Source owner Safe requires at least two signatures");
  safe.owners.forEach((o, i) => {
    address(o, `authority.owners[${i}]`);
  });
  if (new Set(safe.owners.map((o) => getAddress(o))).size !== safe.owners.length)
    throw new Error("Duplicate Safe owner");
  if (safe.nonce === null) missing.push("authority.nonce");
  else integer(safe.nonce, "authority.nonce");
  if (v.deployer !== null && getAddress(v.deployer as string) === getAddress(safe.address as string))
    throw new Error("Deployer and Safe authority must be distinct");
  const proxies: string[] = [];
  for (const target of ["pooling", "settlement"] as const) {
    if (target === "settlement" && v[target] === null) continue;
    const pin = object(
      v[target],
      [
        "proxy",
        "implementation",
        "implementationCodeHash",
        ...(target === "settlement" ? ["router", "sourceSelector", "destinationChainId"] : []),
      ],
      target,
    );
    address(pin.proxy, `${target}.proxy`);
    address(pin.implementation, `${target}.implementation`);
    hash(pin.implementationCodeHash, `${target}.implementationCodeHash`);
    if (getAddress(pin.proxy as string) === getAddress(pin.implementation as string))
      throw new Error("Proxy equals implementation");
    proxies.push(getAddress(pin.proxy as string));
    if (target === "settlement") {
      address(pin.router, "settlement.router");
      for (const k of ["sourceSelector", "destinationChainId"])
        if (
          typeof pin[k] !== "string" ||
          !/^[1-9][0-9]*$/.test(pin[k] as string) ||
          BigInt(pin[k] as string) > 2n ** 64n - 1n
        )
          throw new Error(`Invalid settlement.${k}`);
      if (pin.sourceSelector !== "4949039107694359620" || pin.destinationChainId !== "42220")
        throw new Error("Settlement route must preserve Arbitrum-to-Celo");
    }
  }
  if (
    new Set(proxies).size !== proxies.length ||
    proxies.includes(getAddress(safe.address as string)) ||
    (v.deployer !== null && proxies.includes(getAddress(v.deployer as string)))
  )
    throw new Error("Conflicting source deployment identities");
  return { manifest: structuredClone(value) as SourceUpgradeManifest, missing };
}
function artifactPath(key: string) {
  if (!/^src\/(?:modules|lib)\/[A-Za-z0-9/_-]+\.sol:[A-Za-z0-9_]+$/.test(key))
    throw new Error(`Invalid source artifact key ${key}`);
  const [source, name] = key.split(":");
  return `${path.basename(source)}/${name}.json`;
}
function dependencies(a: VoucherArtifact) {
  const keys = new Set<string>();
  for (const part of [a.bytecode, a.deployedBytecode])
    for (const [source, libs] of Object.entries(part.linkReferences ?? {}))
      for (const name of Object.keys(libs)) keys.add(`${source}:${name}`);
  return [...keys].sort();
}
export function loadSourceUpgradeArtifacts(out: string, manifest: SourceUpgradeManifest): SourceUpgradeArtifacts {
  const loaded: SourceUpgradeArtifacts = {};
  const visit = (key: string) => {
    if (loaded[key]) return;
    const a = JSON.parse(readFileSync(path.join(out, artifactPath(key)), "utf8")) as VoucherArtifact;
    loaded[key] = a;
    dependencies(a).forEach(visit);
  };
  visit(SOURCE_UPGRADE_TARGETS.pooling);
  if (manifest.settlement) visit(SOURCE_UPGRADE_TARGETS.settlement);
  return loaded;
}
function checkedArtifact(key: string, a: VoucherArtifact | undefined) {
  artifactPath(key);
  const [source, name] = key.split(":");
  if (!a || JSON.stringify(a.metadata?.settings?.compilationTarget) !== JSON.stringify({ [source]: name }))
    throw new Error(`Missing or foreign source artifact ${key}`);
  const settings = a.metadata.settings;
  if (
    a.metadata.compiler?.version.split("+")[0] !== "0.8.28" ||
    settings.optimizer?.enabled !== true ||
    settings.optimizer.runs !== 1 ||
    settings.viaIR !== true ||
    settings.evmVersion !== "cancun" ||
    Object.keys(settings.libraries ?? {}).length
  )
    throw new Error(`Invalid production artifact ${key}`);
  for (const part of [a.bytecode, a.deployedBytecode]) {
    if (
      !part ||
      typeof part.object !== "string" ||
      !part.object.startsWith("0x") ||
      part.object.length <= 2 ||
      part.object.length % 2
    )
      throw new Error(`Invalid bytecode ${key}`);
    const occupied = new Set<number>();
    for (const libs of Object.values(part.linkReferences ?? {}))
      for (const slots of Object.values(libs))
        for (const slot of slots) {
          if (
            !Number.isSafeInteger(slot.start) ||
            slot.start < 0 ||
            slot.length !== 20 ||
            slot.start + slot.length > (part.object.length - 2) / 2
          )
            throw new Error(`Malformed link offset ${key}`);
          for (let b = slot.start; b < slot.start + slot.length; b++) {
            if (occupied.has(b)) throw new Error(`Overlapping links ${key}`);
            occupied.add(b);
          }
        }
  }
  if ((a.deployedBytecode.object.length - 2) / 2 > 24576) throw new Error(`Oversized runtime ${key}`);
  const immutableSlots = new Set<number>();
  for (const refs of Object.values(a.deployedBytecode.immutableReferences ?? {}))
    for (const r of refs) {
      if (
        !Number.isSafeInteger(r.start) ||
        r.start < 0 ||
        r.length !== 32 ||
        r.start + r.length > (a.deployedBytecode.object.length - 2) / 2
      )
        throw new Error(`Malformed immutable offset ${key}`);
      for (let b = r.start; b < r.start + r.length; b++) {
        if (immutableSlots.has(b)) throw new Error(`Overlapping immutables ${key}`);
        immutableSlots.add(b);
      }
    }
  return a;
}
export function inspectSourceUpgradeArtifacts(
  artifacts: SourceUpgradeArtifacts,
  manifest: SourceUpgradeManifest,
): { order: string[]; artifactHashes: Record<string, string> } {
  const order: string[] = [];
  const active = new Set<string>();
  const visited = new Set<string>();
  const artifactHashes: Record<string, string> = {};
  const visit = (key: string) => {
    if (active.has(key)) throw new Error(`Cyclic source library graph ${key}`);
    if (visited.has(key)) return;
    active.add(key);
    const a = checkedArtifact(key, artifacts[key]);
    for (const dep of dependencies(a)) {
      if (!/^src\/lib\/(?:CommitmentPooling|Settlement)\//.test(dep)) throw new Error(`Foreign source library ${dep}`);
      visit(dep);
    }
    active.delete(key);
    visited.add(key);
    order.push(key);
    artifactHashes[key] = voucherDigest(a);
  };
  visit(SOURCE_UPGRADE_TARGETS.pooling);
  if (manifest.settlement) visit(SOURCE_UPGRADE_TARGETS.settlement);
  return { order, artifactHashes };
}
export function buildSourceUpgradePlan(
  value: unknown,
  artifacts: SourceUpgradeArtifacts,
  sourceCommit: string,
): SourceUpgradePlan {
  const { manifest: m, missing } = inspectSourceUpgradeManifest(value);
  if (missing.length) throw new Error(`Missing source upgrade inputs: ${missing.join(", ")}`);
  if (!/^[a-f0-9]{40}$/.test(sourceCommit)) throw new Error("Exact source commit required");
  const { order, artifactHashes } = inspectSourceUpgradeArtifacts(artifacts, m);
  const addresses: Record<string, string> = {};
  const deployments: SourceUpgradeDeployment[] = [];
  for (const [index, key] of order.entries()) {
    const a = artifacts[key];
    const nonce = m.nonce! + index;
    if (!Number.isSafeInteger(nonce)) throw new Error("Deployment nonce overflow");
    const deployed = getCreateAddress({ from: m.deployer!, nonce });
    const code = linkBytecode(a.bytecode.object, a.bytecode.linkReferences, addresses);
    const runtimeTemplate = linkBytecode(a.deployedBytecode.object, a.deployedBytecode.linkReferences, addresses);
    if (!/^0x(?:[\da-fA-F]{2})+$/.test(code) || !/^0x(?:[\da-fA-F]{2})+$/.test(runtimeTemplate))
      throw new Error("Malformed linked bytecode");
    const isImplementation = Object.values(SOURCE_UPGRADE_TARGETS).some((k) => k === key);
    const args =
      key === SOURCE_UPGRADE_TARGETS.settlement
        ? AbiCoder.defaultAbiCoder()
            .encode(
              ["address", "uint64", "uint64"],
              [m.settlement!.router, m.settlement!.sourceSelector, m.settlement!.destinationChainId],
            )
            .slice(2)
        : "";
    deployments.push({
      key,
      kind: isImplementation ? "implementation" : "library",
      address: deployed,
      from: getAddress(m.deployer!),
      nonce,
      to: null,
      value: "0",
      data: code + args,
      runtimeTemplate,
      immutableReferences: a.deployedBytecode.immutableReferences ?? {},
    });
    addresses[key] = deployed;
  }
  const ownerCalls: SourceUpgradePlan["ownerCalls"] = [];
  for (const target of ["pooling", "settlement"] as const) {
    const pin = m[target];
    if (!pin) continue;
    for (const action of ["pause", "upgrade"] as const) {
      const safeNonce = m.authority.nonce! + ownerCalls.length;
      if (!Number.isSafeInteger(safeNonce)) throw new Error("Safe nonce overflow");
      ownerCalls.push({
        target,
        action,
        from: getAddress(m.authority.address),
        to: getAddress(pin.proxy),
        data:
          action === "pause"
            ? ownerInterface.encodeFunctionData("setPaused", [true])
            : ownerInterface.encodeFunctionData("upgradeTo", [addresses[SOURCE_UPGRADE_TARGETS[target]]]),
        value: "0",
        operation: 0,
        safeNonce,
      });
    }
  }
  return {
    schemaVersion: 1,
    kind: "PAUSED_EXISTING_SOURCE_UPGRADES",
    releaseId: m.releaseId,
    chainId: 42161,
    sourceCommit,
    manifestHash: voucherDigest(m),
    artifactHashes,
    deployments,
    ownerCalls,
    endState: "paused-original-owner",
    activationIncluded: false,
    liveBroadcast: false,
  };
}
export function validateSourceUpgradePlan(
  value: unknown,
  manifest: unknown,
  artifacts: SourceUpgradeArtifacts,
  sourceCommit: string,
): asserts value is SourceUpgradePlan {
  if (JSON.stringify(value) !== JSON.stringify(buildSourceUpgradePlan(manifest, artifacts, sourceCommit)))
    throw new Error("Source upgrade plan mismatch");
}

export const SOURCE_IMPLEMENTATION_SLOT = "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";
export const SOURCE_SAFE_GUARD_SLOT = "0x4a204f620c8c5ccdca3fd54d003badd85ba500436a431f0cbda4f558c93c34c8";
export const SOURCE_SAFE_MODULE_GUARD_SLOT = "0xb104e0b93118902c651344349b610029d694cfdec91c589c91ebafbcd0289947";
