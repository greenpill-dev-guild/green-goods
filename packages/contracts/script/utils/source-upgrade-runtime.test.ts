import { getAddress, keccak256, toBeHex, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import draft from "../../config/source-upgrade-release.json";
import {
  buildSourceUpgradePlan,
  SOURCE_UPGRADE_TARGETS,
  type SourceUpgradeArtifacts,
  type SourceUpgradeManifest,
} from "./source-upgrade-release";
import { materializeSourceUpgradeRuntimes, type SourceUpgradeCompilerJob } from "./source-upgrade-runtime";
import { voucherDigest } from "./voucher-release";

const uups = "lib/tokenbound/lib/openzeppelin-contracts/contracts/proxy/utils/UUPSUpgradeable.sol";
const receiver = "node_modules/@chainlink/contracts-ccip/contracts/applications/CCIPReceiver.sol";
const storage = "src/modules/Settlement/Storage.sol";
const library = "src/lib/CommitmentPooling/Test.sol:TestLib";
const commit = "c".repeat(40);
const address = (n: number) => getAddress(toBeHex(n, 20));
function fixture(idOffset = 0) {
  const m: SourceUpgradeManifest = {
    ...structuredClone(draft),
    chainId: 42161,
    schemaVersion: 1,
    deployer: address(91),
    nonce: 0,
    authority: { ...draft.authority, nonce: 0 },
  };
  const inputSources: SourceUpgradeCompilerJob["input"]["sources"] = {};
  const sources: SourceUpgradeCompilerJob["output"]["sources"] = {};
  const declarations: Array<[string, string, string[]]> = [
    [uups, "UUPSUpgradeable", ["__self"]],
    [receiver, "CCIPReceiver", ["i_ccipRouter"]],
    [storage, "SettlementModuleStorage", ["CCIP_ROUTER", "SOURCE_CHAIN_SELECTOR", "DESTINATION_EVM_CHAIN_ID"]],
    [SOURCE_UPGRADE_TARGETS.pooling.split(":")[0], "CommitmentPoolingModule", []],
    [SOURCE_UPGRADE_TARGETS.settlement.split(":")[0], "SettlementModule", []],
    [library.split(":")[0], "TestLib", []],
  ];
  const ids: Record<string, number> = {};
  declarations.forEach(([source, name, variables], index) => {
    const content = `contract ${name} { ${variables.map((v) => `uint256 immutable ${v};`).join(" ")} }`;
    inputSources[source] = { content };
    sources[source] = {
      id: index,
      ast: {
        nodeType: "SourceUnit",
        id: idOffset + index * 100,
        src: `0:${content.length}:${index}`,
        absolutePath: source,
        nodes: [
          {
            nodeType: "ContractDefinition",
            id: idOffset + index * 100 + 1,
            name,
            src: `0:${content.length}:${index}`,
            nodes: variables.map((v, n) => {
              const id = idOffset + index * 100 + n + 2;
              ids[v] = id;
              return {
                nodeType: "VariableDeclaration",
                id,
                name: v,
                stateVariable: true,
                mutability: "immutable",
                src: `0:1:${index}`,
              };
            }),
          },
        ],
      },
    };
  });
  const settings = {
    optimizer: { enabled: true, runs: 1 },
    viaIR: true,
    evmVersion: "cancun",
    libraries: {},
    metadata: { bytecodeHash: "none" },
  };
  const job: SourceUpgradeCompilerJob = {
    compilerVersion: "0.8.28+commit.7893614a",
    input: { language: "Solidity", sources: inputSources, settings },
    output: { sources, contracts: {} },
  };
  const a: SourceUpgradeArtifacts = {};
  for (const key of [library, SOURCE_UPGRADE_TARGETS.pooling, SOURCE_UPGRADE_TARGETS.settlement]) {
    const [source, name] = key.split(":");
    const refs =
      key === library
        ? { library_deploy_address: [{ start: 0, length: 32 }] }
        : key === SOURCE_UPGRADE_TARGETS.pooling
          ? { [ids.__self]: [{ start: 0, length: 32 }] }
          : Object.fromEntries(
              ["__self", "i_ccipRouter", "CCIP_ROUTER", "SOURCE_CHAIN_SELECTOR", "DESTINATION_EVM_CHAIN_ID"].map(
                (v, i) => [ids[v], [{ start: i * 32, length: 32 }]],
              ),
            );
    const bytecode = { object: "0x6000", linkReferences: {} };
    const deployedBytecode = {
      object: `0x${"00".repeat(192)}`,
      immutableReferences: refs,
      linkReferences:
        key === SOURCE_UPGRADE_TARGETS.pooling
          ? { [library.split(":")[0]]: { TestLib: [{ start: 160, length: 20 }] } }
          : {},
    };
    const metadata = {
      compiler: { version: job.compilerVersion },
      settings: { ...settings, compilationTarget: { [source]: name } },
      sources: Object.fromEntries(
        Object.entries(inputSources).map(([s, v]) => [s, { keccak256: keccak256(toUtf8Bytes(v.content)) }]),
      ),
    };
    a[key] = {
      abi: [],
      bytecode,
      deployedBytecode,
      metadata,
      rawMetadata: JSON.stringify(metadata),
    } as (typeof a)[string];
    job.output.contracts[source] = {
      [name]: { abi: [], metadata: JSON.stringify(metadata), evm: { bytecode, deployedBytecode } },
    };
  }
  const jobs = Object.fromEntries(Object.keys(a).map((key) => [key, job]));
  return { m, a, jobs, job, plan: buildSourceUpgradePlan(m, a, commit), ids };
}
function run(f: ReturnType<typeof fixture>) {
  return materializeSourceUpgradeRuntimes(f.plan, f.m, f.a, f.jobs);
}
function variable(f: ReturnType<typeof fixture>, source = uups) {
  return (
    (f.job.output.sources[source].ast.nodes as Array<Record<string, unknown>>)[0].nodes as Array<
      Record<string, unknown>
    >
  )[0];
}
function replan(f: ReturnType<typeof fixture>) {
  for (const [key, a] of Object.entries(f.a)) {
    const [source, name] = key.split(":");
    f.job.output.contracts[source][name].evm.deployedBytecode = structuredClone(a.deployedBytecode);
  }
  f.plan = buildSourceUpgradePlan(f.m, f.a, commit);
}
describe("exact source upgrade runtime materialization", () => {
  it("fills every constructor value and library self address while retaining linked runtime bytes", () => {
    const f = fixture();
    const result = run(f);
    const rows = Object.fromEntries(result.deployments.map((r) => [r.key, r]));
    for (const tx of f.plan.deployments) {
      expect(rows[tx.key].runtime.slice(2, 66)).toBe(toBeHex(BigInt(tx.address), 32).slice(2));
      expect(rows[tx.key].runtimeHash).toBe(keccak256(rows[tx.key].runtime));
      expect(rows[tx.key].compilerJobHash).toBe(voucherDigest(f.job));
    }
    const settlement = rows[SOURCE_UPGRADE_TARGETS.settlement].runtime;
    expect(settlement.slice(66, 130)).toBe(toBeHex(BigInt(f.m.settlement!.router), 32).slice(2));
    expect(settlement.slice(130, 194)).toBe(toBeHex(BigInt(f.m.settlement!.router), 32).slice(2));
    expect(settlement.slice(194, 258)).toBe(toBeHex(BigInt(f.m.settlement!.sourceSelector), 32).slice(2));
    expect(settlement.slice(258, 322)).toBe(toBeHex(BigInt(f.m.settlement!.destinationChainId), 32).slice(2));
    expect(rows[SOURCE_UPGRADE_TARGETS.pooling].runtime.slice(322, 362)).toBe(
      rows[library].address.slice(2).toLowerCase(),
    );
    expect(result.bindingHash).toBe(voucherDigest(result.deployments));
  });
  it("resolves semantic declarations after all compiler numeric IDs change", () => {
    expect(run(fixture(9000)).deployments.map((r) => r.runtime)).toEqual(
      run(fixture()).deployments.map((r) => r.runtime),
    );
  });
  it("rejects missing compiler evidence rather than accepting masked runtime", () => {
    const f = fixture();
    delete f.jobs[SOURCE_UPGRADE_TARGETS.pooling];
    expect(() => run(f)).toThrow(/compiler job/i);
  });
  it.each([
    [
      "compiler version",
      (f: ReturnType<typeof fixture>) => {
        f.job.compilerVersion = "0.8.27";
      },
    ],
    [
      "source contents",
      (f: ReturnType<typeof fixture>) => {
        f.job.input.sources[uups].content += " altered";
      },
    ],
    [
      "production settings",
      (f: ReturnType<typeof fixture>) => {
        f.job.input.settings.viaIR = false;
      },
    ],
    [
      "unsafe metadata default",
      (f: ReturnType<typeof fixture>) => {
        f.job.input.settings.metadata = { bytecodeHash: "none", appendCBOR: false };
      },
    ],
    [
      "output bytecode",
      (f: ReturnType<typeof fixture>) => {
        f.job.output.contracts[SOURCE_UPGRADE_TARGETS.pooling.split(":")[0]].CommitmentPoolingModule.evm.bytecode = {
          object: "0x6001",
        };
      },
    ],
    [
      "output metadata",
      (f: ReturnType<typeof fixture>) => {
        f.job.output.contracts[SOURCE_UPGRADE_TARGETS.pooling.split(":")[0]].CommitmentPoolingModule.metadata = "{}";
      },
    ],
    [
      "output ABI",
      (f: ReturnType<typeof fixture>) => {
        f.job.output.contracts[SOURCE_UPGRADE_TARGETS.pooling.split(":")[0]].CommitmentPoolingModule.abi = [
          { type: "function", name: "foreign", inputs: [], outputs: [], stateMutability: "view" },
        ];
      },
    ],
    [
      "missing inherited AST",
      (f: ReturnType<typeof fixture>) => {
        delete f.job.output.sources[uups];
      },
    ],
    [
      "foreign AST path",
      (f: ReturnType<typeof fixture>) => {
        f.job.output.sources[uups].ast.absolutePath = "node_modules/other/UUPSUpgradeable.sol";
      },
    ],
    [
      "AST source id",
      (f: ReturnType<typeof fixture>) => {
        variable(f).src = "0:1:999";
      },
    ],
    [
      "ambiguous AST id",
      (f: ReturnType<typeof fixture>) => {
        variable(f, receiver).id = variable(f).id;
      },
    ],
    [
      "unknown semantic declaration",
      (f: ReturnType<typeof fixture>) => {
        variable(f).name = "unreviewedSelf";
      },
    ],
    [
      "nonimmutable declaration",
      (f: ReturnType<typeof fixture>) => {
        variable(f).mutability = "mutable";
      },
    ],
  ] as const)("rejects mismatched %s provenance", (_label, mutate) => {
    const f = fixture();
    mutate(f);
    expect(() => run(f)).toThrow(/Source runtime/);
  });
  it("rejects a same-basename inherited AST from a different source", () => {
    const f = fixture();
    const foreign = "node_modules/@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
    f.job.output.sources[foreign] = f.job.output.sources[uups];
    delete f.job.output.sources[uups];
    expect(() => run(f)).toThrow(/source|AST/);
  });
  it.each([
    "missing",
    "unknown",
    "overlap",
    "out-of-range",
    "wrong-width",
    "empty",
  ])("rejects %s immutable evidence", (kind) => {
    const f = fixture();
    const refs = f.a[SOURCE_UPGRADE_TARGETS.settlement].deployedBytecode.immutableReferences!;
    if (kind === "missing") delete refs[String(f.ids.CCIP_ROUTER)];
    if (kind === "unknown") refs["1234567"] = [{ start: 160, length: 32 }];
    if (kind === "overlap") refs[String(f.ids.CCIP_ROUTER)] = [{ start: 32, length: 32 }];
    if (kind === "out-of-range") refs[String(f.ids.CCIP_ROUTER)] = [{ start: 190, length: 32 }];
    if (kind === "wrong-width") refs[String(f.ids.CCIP_ROUTER)] = [{ start: 64, length: 20 }];
    if (kind === "empty") refs[String(f.ids.CCIP_ROUTER)] = [];
    expect(() => {
      replan(f);
      run(f);
    }).toThrow();
  });
  it("rejects an immutable range overlapping a library link", () => {
    const f = fixture();
    f.a[SOURCE_UPGRADE_TARGETS.pooling].deployedBytecode.immutableReferences![String(f.ids.__self)] = [
      { start: 160, length: 32 },
    ];
    replan(f);
    expect(() => run(f)).toThrow(/overlap/i);
  });
  it("uses exact unchanged bytes for libraries whose compiler output declares no immutables", () => {
    const f = fixture();
    f.a[library].deployedBytecode.immutableReferences = {};
    replan(f);
    expect(run(f).deployments[0].runtime).toBe(f.plan.deployments[0].runtimeTemplate);
  });
  it("fills every repeated reference for the same declaration", () => {
    const f = fixture();
    f.a[library].deployedBytecode.immutableReferences = {
      library_deploy_address: [
        { start: 0, length: 32 },
        { start: 32, length: 32 },
      ],
    };
    replan(f);
    const row = run(f).deployments[0];
    expect(row.runtime.slice(2, 130)).toBe(toBeHex(BigInt(row.address), 32).slice(2).repeat(2));
  });
  it("rejects a transitive import pointing to a foreign source-unit id", () => {
    const f = fixture();
    (f.job.output.sources[uups].ast.nodes as unknown[]).push({
      nodeType: "ImportDirective",
      id: 5000,
      absolutePath: receiver,
      sourceUnit: 999,
    });
    expect(() => run(f)).toThrow(/transitive import AST/);
  });
  it("rejects nonzero immutable placeholders even when compiler and artifact agree", () => {
    const f = fixture();
    f.a[library].deployedBytecode.object = `0x01${"00".repeat(191)}`;
    replan(f);
    expect(() => run(f)).toThrow(/nonzero immutable template/);
  });
  it("rejects output immutable refs from another compiler output", () => {
    const f = fixture();
    f.job.output.contracts[library.split(":")[0]].TestLib.evm.deployedBytecode = {
      ...f.a[library].deployedBytecode,
      immutableReferences: {},
    };
    expect(() => run(f)).toThrow(/output immutables/);
  });
  it("rejects duplicate source ids even when their source paths differ", () => {
    const f = fixture();
    f.job.output.sources[receiver].id = f.job.output.sources[uups].id;
    expect(() => run(f)).toThrow(/ambiguous AST source id/);
  });
  it("allows genuine Yul assembly nodes without inventing Solidity declaration IDs", () => {
    const f = fixture();
    (f.job.output.sources[uups].ast.nodes as unknown[]).push({
      nodeType: "YulBlock",
      statements: [{ nodeType: "YulLiteral", value: "0" }],
    });
    expect(run(f).deployments).toHaveLength(3);
  });
  it("preserves plan regeneration rejection before materialization", () => {
    const f = fixture();
    f.plan.deployments[0].address = address(1);
    expect(() => run(f)).toThrow(/plan mismatch/);
  });
});
