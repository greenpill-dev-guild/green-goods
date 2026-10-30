import { isDeepStrictEqual } from "node:util";
import { keccak256, toBeHex, toUtf8Bytes } from "ethers";
import {
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeDeployment,
  type SourceUpgradeManifest,
  type SourceUpgradePlan,
  validateSourceUpgradePlan,
} from "./source-upgrade-release";
import { type VoucherArtifact, voucherDigest } from "./voucher-release";

/** Original standard-json input/output from one compiler invocation, never merged basename artifacts. */
export interface SourceUpgradeCompilerJob {
  compilerVersion: string;
  input: { language: "Solidity"; sources: Record<string, { content: string }>; settings: Record<string, unknown> };
  output: {
    sources: Record<string, { id: number; ast: Record<string, unknown> }>;
    contracts: Record<
      string,
      Record<
        string,
        { abi: VoucherArtifact["abi"]; metadata: string; evm: Pick<VoucherArtifact, "bytecode" | "deployedBytecode"> }
      >
    >;
  };
}
export type SourceUpgradeCompilerJobs = Record<string, SourceUpgradeCompilerJob>;
const UUPS_SELF =
  "lib/tokenbound/lib/openzeppelin-contracts/contracts/proxy/utils/UUPSUpgradeable.sol:UUPSUpgradeable.__self";
const RECEIVER_ROUTER =
  "node_modules/@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol:CCIPReceiver.i_ccipRouter";
const SETTLEMENT_STORAGE = "src/modules/Settlement/Storage.sol:SettlementModuleStorage.";
function requireProof(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`Source runtime ${label}`);
}
function same(actual: unknown, expected: unknown, label: string) {
  requireProof(isDeepStrictEqual(actual, expected), `${label} mismatch`);
}
function object(value: unknown): Record<string, unknown> {
  requireProof(value && typeof value === "object" && !Array.isArray(value), "invalid compiler object");
  return value as Record<string, unknown>;
}
function checkSourceRange(node: Record<string, unknown>, id: number, size: number) {
  requireProof(typeof node.src === "string" && /^[0-9]+:[0-9]+:[0-9]+$/.test(node.src), "invalid AST source range");
  const [start, length, file] = node.src.split(":").map(Number);
  requireProof(
    [start, length, file].every(Number.isSafeInteger) && file === id && start + length <= size,
    "AST source range mismatch",
  );
}
function declarations(job: SourceUpgradeCompilerJob) {
  requireProof(job.input?.language === "Solidity", "compiler language mismatch");
  const ids = new Set<number>();
  const fileIds = new Set<number>();
  const found = new Map<string, string>();
  const semantics = new Set<string>();
  for (const [source, output] of Object.entries(job.output.sources)) {
    const content = job.input.sources[source]?.content;
    requireProof(typeof content === "string", `missing compiler source ${source}`);
    requireProof(
      Number.isSafeInteger(output.id) && output.id >= 0 && !fileIds.has(output.id),
      "ambiguous AST source id",
    );
    fileIds.add(output.id);
    const ast = object(output.ast);
    requireProof(
      ast.nodeType === "SourceUnit" && ast.absolutePath === source && Array.isArray(ast.nodes),
      `foreign AST source ${source}`,
    );
    const size = Buffer.byteLength(content, "utf8");
    checkSourceRange(ast, output.id, size);
    const visit = (value: unknown, contract?: string) => {
      if (!value || typeof value !== "object") return;
      if (Array.isArray(value)) {
        for (const child of value) visit(child, contract);
        return;
      }
      const node = value as Record<string, unknown>;
      // Yul's inline-assembly tree has no Solidity declaration IDs.
      if (typeof node.nodeType === "string" && !node.nodeType.startsWith("Yul")) {
        requireProof(
          Number.isSafeInteger(node.id) && Number(node.id) >= 0 && !ids.has(Number(node.id)),
          "ambiguous compiler AST id",
        );
        ids.add(Number(node.id));
      }
      const scope = node.nodeType === "ContractDefinition" ? String(node.name) : contract;
      if (node.nodeType === "ImportDirective") {
        requireProof(
          typeof node.absolutePath === "string" && job.output.sources[node.absolutePath]?.ast.id === node.sourceUnit,
          "missing transitive import AST",
        );
      }
      if (node.nodeType === "VariableDeclaration" && node.mutability === "immutable") {
        requireProof(
          scope && node.stateVariable === true && typeof node.name === "string" && node.name.length,
          "invalid immutable declaration",
        );
        checkSourceRange(node, output.id, size);
        const identity = `${source}:${scope}.${node.name}`;
        requireProof(!semantics.has(identity), "ambiguous semantic immutable identity");
        semantics.add(identity);
        found.set(String(node.id), identity);
      }
      for (const [key, child] of Object.entries(node)) if (key !== "documentation") visit(child, scope);
    };
    visit(ast);
  }
  return found;
}
function remappings(value: unknown) {
  requireProof(Array.isArray(value) && value.every((v) => typeof v === "string"), "invalid compiler remappings");
  return value.map((v: string) => v.replace(/^:/, "")).sort();
}
function abiEntries(abi: VoucherArtifact["abi"]) {
  requireProof(Array.isArray(abi), "compiler ABI must be an array");
  return abi.map((entry) => {
    const row = { ...object(entry) };
    if (Array.isArray(row.outputs) && row.outputs.length === 0) delete row.outputs;
    return row;
  });
}
function sameAbi(actual: VoucherArtifact["abi"], expected: VoucherArtifact["abi"]) {
  const remaining = abiEntries(expected);
  for (const row of abiEntries(actual)) {
    const index = remaining.findIndex((candidate) => isDeepStrictEqual(candidate, row));
    requireProof(index >= 0, "compiler output ABI mismatch");
    remaining.splice(index, 1);
  }
  requireProof(remaining.length === 0, "compiler output ABI mismatch");
}
function settingsMatch(actual: Record<string, unknown>, expected: Record<string, unknown>) {
  for (const [key, value] of Object.entries(expected)) {
    if (key === "compilationTarget") continue;
    if (key === "remappings") same(remappings(actual[key]), remappings(value), "compiler remappings");
    else if (key === "metadata") {
      const metadata = object(actual[key]);
      for (const [field, v] of Object.entries(object(value))) same(metadata[field], v, `compiler metadata ${field}`);
      for (const field of Object.keys(metadata).filter((f) => !(f in object(value)))) {
        same(
          metadata[field],
          ({ useLiteralContent: false, appendCBOR: true } as Record<string, unknown>)[field],
          `compiler metadata default ${field}`,
        );
      }
    } else same(actual[key] ?? (key === "libraries" ? {} : undefined), value, `compiler setting ${key}`);
  }
}
function artifactProof(key: string, artifact: VoucherArtifact, job: SourceUpgradeCompilerJob) {
  const [source, name] = key.split(":");
  const output = job.output.contracts?.[source]?.[name];
  requireProof(output, `missing compiler contract ${key}`);
  same(job.compilerVersion, artifact.metadata.compiler.version, "compiler version");
  same(output.metadata, object(artifact).rawMetadata, "compiler output raw metadata");
  const raw = object(JSON.parse(output.metadata));
  same(raw.compiler, artifact.metadata.compiler, "compiler metadata version");
  same(raw.sources, object(artifact.metadata).sources, "compiler metadata sources");
  settingsMatch(object(raw.settings), object(artifact.metadata.settings));
  same(object(raw.settings).compilationTarget, artifact.metadata.settings.compilationTarget, "compiler target");
  sameAbi(output.abi, artifact.abi);
  for (const part of ["bytecode", "deployedBytecode"] as const) {
    const compiled = output.evm?.[part];
    requireProof(compiled && typeof compiled.object === "string", `missing compiler output ${part}`);
    same(compiled.object.replace(/^0x/, ""), artifact[part].object.replace(/^0x/, ""), `compiler output ${part}`);
    same(compiled.linkReferences ?? {}, artifact[part].linkReferences ?? {}, "compiler output links");
  }
  same(
    output.evm.deployedBytecode.immutableReferences ?? {},
    artifact.deployedBytecode.immutableReferences ?? {},
    "compiler output immutables",
  );
  settingsMatch(job.input.settings, object(raw.settings));
  const metadataSources = object(object(artifact.metadata).sources);
  requireProof(Object.keys(metadataSources).length && metadataSources[source], "missing metadata sources");
  for (const [path, pin] of Object.entries(metadataSources)) {
    const content = job.input.sources[path]?.content;
    requireProof(typeof content === "string" && job.output.sources[path]?.ast, `missing compiler source AST ${path}`);
    same(keccak256(toUtf8Bytes(content)), object(pin).keccak256, `source content ${path}`);
  }
}
function materialize(
  tx: SourceUpgradeDeployment,
  m: SourceUpgradeManifest,
  artifact: VoucherArtifact,
  names: Map<string, string>,
) {
  requireProof(/^0x(?:[0-9a-fA-F]{2})+$/.test(tx.runtimeTemplate), "invalid linked runtime");
  const bytes = Buffer.from(tx.runtimeTemplate.slice(2), "hex");
  const expected = new Map<string, string>(
    tx.kind === "library"
      ? Object.keys(tx.immutableReferences ?? {}).length
        ? [["library_deploy_address", tx.address]]
        : []
      : [[UUPS_SELF, tx.address]],
  );
  if (tx.key === SOURCE_UPGRADE_TARGETS.settlement) {
    requireProof(m.settlement, "missing Settlement constructor values");
    expected.set(RECEIVER_ROUTER, m.settlement.router);
    expected.set(`${SETTLEMENT_STORAGE}CCIP_ROUTER`, m.settlement.router);
    expected.set(`${SETTLEMENT_STORAGE}SOURCE_CHAIN_SELECTOR`, m.settlement.sourceSelector);
    expected.set(`${SETTLEMENT_STORAGE}DESTINATION_EVM_CHAIN_ID`, m.settlement.destinationChainId);
  }
  const occupied = new Set<number>();
  const occupy = (start: number, length: number) => {
    requireProof(
      Number.isSafeInteger(start) && start >= 0 && Number.isSafeInteger(length) && start + length <= bytes.length,
      "immutable/link out-of-range",
    );
    for (let b = start; b < start + length; b++) {
      requireProof(!occupied.has(b), "immutable/link overlap");
      occupied.add(b);
    }
  };
  for (const libs of Object.values(artifact.deployedBytecode.linkReferences ?? {}))
    for (const refs of Object.values(libs)) for (const ref of refs) occupy(ref.start, ref.length);
  const seen = new Set<string>();
  for (const [id, ranges] of Object.entries(tx.immutableReferences ?? {})) {
    const identity = id === "library_deploy_address" && tx.kind === "library" ? id : names.get(id);
    requireProof(identity && expected.has(identity), `unknown immutable identity ${id}`);
    requireProof(ranges.length > 0, "empty immutable ranges");
    const constructorValue = expected.get(identity);
    requireProof(typeof constructorValue === "string", "missing immutable constructor value");
    const value = Buffer.from(toBeHex(BigInt(constructorValue), 32).slice(2), "hex");
    for (const range of ranges) {
      requireProof(range.length === 32, "immutable width mismatch");
      occupy(range.start, range.length);
      requireProof(
        bytes.subarray(range.start, range.start + range.length).every((b) => b === 0),
        "nonzero immutable template",
      );
      value.copy(bytes, range.start);
    }
    seen.add(identity);
  }
  for (const identity of expected.keys()) requireProof(seen.has(identity), `missing required immutable ${identity}`);
  return `0x${bytes.toString("hex")}`;
}
/** The host supplies untouched compiler output and binds this evidence into the rehearsal/envelope. */
export function materializeSourceUpgradeRuntimes(
  plan: SourceUpgradePlan,
  m: SourceUpgradeManifest,
  artifacts: SourceUpgradeArtifacts,
  jobs: SourceUpgradeCompilerJobs,
) {
  validateSourceUpgradePlan(plan, m, artifacts, plan.sourceCommit);
  const cached = new Map<SourceUpgradeCompilerJob, { names: Map<string, string>; hash: string }>();
  const deployments = plan.deployments.map((tx) => {
    const job = jobs?.[tx.key];
    requireProof(job, `missing compiler job ${tx.key}`);
    artifactProof(tx.key, artifacts[tx.key], job);
    let proof = cached.get(job);
    if (!proof) {
      proof = { names: declarations(job), hash: voucherDigest(job) };
      cached.set(job, proof);
    }
    const runtime = materialize(tx, m, artifacts[tx.key], proof.names);
    return { key: tx.key, address: tx.address, runtime, runtimeHash: keccak256(runtime), compilerJobHash: proof.hash };
  });
  return { bindingHash: voucherDigest(deployments), deployments };
}
