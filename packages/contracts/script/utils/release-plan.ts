import { Interface } from "ethers";
import type { ReleaseIdentity, ReleaseLock, ReleaseManifest, ReleaseStage } from "./release-manifest";

export interface ReleaseTransactionBoundary {
  index: number;
  stage: ReleaseStage | "settlement-peer" | "ownership-transfer";
  kind: "create2" | "configuration" | "ownership";
  label: string;
  network: "arbitrum" | "celo";
  sender: string;
  to: string;
  calldata?: string;
  salt?: string;
  creationCodeHash?: string;
  expectedAddress?: string;
  preconditions: string[];
  resumableState: string;
  postActionVerifier: string[];
}

export interface ReleaseTransactionPlan {
  schemaVersion: 1;
  releaseId: string;
  sourceCommit: string;
  stage: string;
  network: string;
  sender: string;
  owner: string;
  create2Factory: string;
  baseSalt: string;
  libraryMap: Record<string, string>;
  transactions: ReleaseTransactionBoundary[];
  canonicalArtifactMutation: false;
}

function create2Boundary(
  manifest: ReleaseManifest,
  identity: ReleaseIdentity,
  index: number,
): ReleaseTransactionBoundary {
  return {
    index,
    stage: identity.stage,
    kind: "create2",
    label: `${identity.kind}:${identity.name}`,
    network: identity.network,
    sender: manifest.ownership.deploymentSender,
    to: manifest.create2.factory,
    salt: identity.salt,
    creationCodeHash: identity.creationCodeHash,
    expectedAddress: identity.address,
    preconditions: [
      `chainId equals ${manifest.chains[identity.network].evmChainId}`,
      `sender equals ${manifest.ownership.deploymentSender}`,
      `factory code exists at ${manifest.create2.factory}`,
      "predicted address has no code or exact expected code",
    ],
    resumableState: `Code at ${identity.address} is either absent or exact; retry uses the same salt and init-code hash.`,
    postActionVerifier: [
      `code exists at ${identity.address}`,
      identity.immutableRuntime
        ? "immutable getters and creation-code hash match the manifest"
        : `runtime code hash equals ${identity.runtimeTemplateHash}`,
    ],
  };
}

function configurationBoundary(
  manifest: ReleaseManifest,
  lock: ReleaseLock,
  input: Omit<ReleaseTransactionBoundary, "index" | "sender" | "kind" | "network"> & {
    network?: "arbitrum" | "celo";
  },
  index: number,
): ReleaseTransactionBoundary {
  const proxy = (name: string) =>
    lock.identities.find((identity) => identity.kind === "proxy" && identity.name === name)?.address;
  return {
    ...input,
    index,
    kind: "configuration",
    network: input.network ?? "arbitrum",
    sender: manifest.ownership.deploymentSender,
    preconditions: [...input.preconditions, `live owner equals ${manifest.ownership.deploymentSender}`],
    postActionVerifier: [...input.postActionVerifier, `owner remains ${manifest.ownership.deploymentSender}`],
    to: input.to.replace("release:CommitmentPoolingModule", proxy("CommitmentPoolingModule") ?? "missing"),
  };
}

export function buildStageTransactionPlan(
  manifest: ReleaseManifest,
  lock: ReleaseLock,
  stage: ReleaseStage,
  deployment: Record<string, unknown>,
  baseSalt: string,
): ReleaseTransactionPlan {
  const stageTarget = manifest.targets.find((target) => target.stage === stage);
  if (!stageTarget) throw new Error(`No manifest target for stage ${stage}`);
  const identities = lock.identities.filter((identity) => identity.stage === stage);
  const transactions: ReleaseTransactionBoundary[] = identities.map((identity, index) =>
    create2Boundary(manifest, identity, index + 1),
  );
  const proxy = (name: string) => {
    const value = lock.identities.find((identity) => identity.kind === "proxy" && identity.name === name)?.address;
    if (!value) throw new Error(`Missing predicted proxy identity for ${name}`);
    return value;
  };

  if (stage === "pooling") {
    const moduleAddress = proxy("CommitmentPoolingModule");
    const schemas = (deployment.schemas ?? {}) as Record<string, unknown>;
    const eas = (deployment.eas ?? {}) as Record<string, unknown>;
    const required = {
      gardenToken: deployment.gardenToken,
      hatsModule: deployment.hatsModule,
      actionRegistry: deployment.actionRegistry,
      assessmentResolver: deployment.assessmentResolver,
      workApprovalResolver: deployment.workApprovalResolver,
      eas: eas.address,
      workSchemaUID: schemas.workSchemaUID,
      workApprovalSchemaUID: schemas.workApprovalSchemaUID,
      assessmentSchemaUID: schemas.assessmentSchemaUID,
      assessmentV3SchemaUID:
        schemas.assessmentV3SchemaUID ?? manifest.schemas.find((schema) => schema.identity === "assessment-v3")?.uid,
    };
    const missing = Object.entries(required)
      .filter(([, value]) => typeof value !== "string" || !value.startsWith("0x") || /^0x0+$/iu.test(value))
      .map(([key]) => key);
    if (missing.length > 0)
      throw new Error(`Pooling transaction plan has unresolved artifact dependencies: ${missing.join(", ")}`);
    const iface = new Interface([
      "function setGardenToken(address)",
      "function setHatsModule(address)",
      "function setActionRegistry(address)",
      "function setCommitmentRegistry(address)",
      "function setWorkApprovalResolver(address)",
      "function setEAS(address)",
      "function setSchemaUIDs(bytes32,bytes32,bytes32,bytes32)",
      "function setAssessmentV3SchemaUID(bytes32)",
    ]);
    const calls: Array<[string, string, unknown[]]> = [
      ["set garden token", "setGardenToken", [required.gardenToken]],
      ["set Hats module", "setHatsModule", [required.hatsModule]],
      ["set action registry", "setActionRegistry", [required.actionRegistry]],
      ["set commitment registry", "setCommitmentRegistry", [proxy("CommitmentRegistry")]],
      ["set work-approval resolver", "setWorkApprovalResolver", [required.workApprovalResolver]],
      ["set EAS", "setEAS", [required.eas]],
      [
        "set four pairwise-distinct schema UIDs",
        "setSchemaUIDs",
        [
          required.workSchemaUID,
          required.workApprovalSchemaUID,
          required.assessmentSchemaUID,
          required.assessmentV3SchemaUID,
        ],
      ],
    ];
    for (const [label, signature, args] of calls) {
      transactions.push(
        configurationBoundary(
          manifest,
          lock,
          {
            stage,
            label,
            to: moduleAddress,
            calldata: iface.encodeFunctionData(signature, args),
            preconditions: ["pooling module is paused", "all earlier transaction boundaries passed verification"],
            resumableState: `The module remains paused; retry reads ${signature} state before sending.`,
            postActionVerifier: [
              `${signature} getter matches the exact manifest/artifact value`,
              "module remains paused",
            ],
          },
          transactions.length + 1,
        ),
      );
    }
    transactions.push(
      configurationBoundary(
        manifest,
        lock,
        {
          stage,
          label: "set Assessment v3 schema UID",
          to: required.assessmentResolver as string,
          calldata: iface.encodeFunctionData("setAssessmentV3SchemaUID", [required.assessmentV3SchemaUID]),
          preconditions: [
            "AssessmentResolver upgrade and v2-state preservation are verified",
            "the exact Assessment v3 EAS record exists",
            "pooling module remains paused",
          ],
          resumableState: "An exact existing v3 UID is satisfied; any different non-zero UID is a conflict.",
          postActionVerifier: [
            `AssessmentResolver.assessmentV3SchemaUID() equals ${required.assessmentV3SchemaUID}`,
            `AssessmentResolver.schemaUID() remains ${required.assessmentSchemaUID}`,
          ],
        },
        transactions.length + 1,
      ),
    );
  }

  if (stage === "credit-registry") {
    const settlement = proxy("SettlementModule");
    const credit = proxy("CreditRegistry");
    const iface = new Interface(["function setCreditRegistry(address)"]);
    transactions.push(
      configurationBoundary(
        manifest,
        lock,
        {
          stage,
          label: "bind SettlementModule to CreditRegistry",
          to: settlement,
          calldata: iface.encodeFunctionData("setCreditRegistry", [credit]),
          preconditions: ["SettlementModule is paused", "CreditRegistry is paused", "both proxies have exact code"],
          resumableState:
            "Both contracts remain paused; an exact existing binding is a no-op and a different binding is a conflict.",
          postActionVerifier: [
            `SettlementModule.creditRegistry() equals ${credit}`,
            `CreditRegistry.settlementModule() equals ${settlement}`,
            "no G$ pool credit configuration is enabled",
          ],
        },
        transactions.length + 1,
      ),
    );
  }

  return {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    sourceCommit: manifest.sourceCommit,
    stage,
    network: stageTarget.network,
    sender: manifest.ownership.deploymentSender,
    owner: manifest.ownership.deploymentSender,
    create2Factory: manifest.create2.factory,
    baseSalt,
    libraryMap: lock.libraryMap,
    transactions,
    canonicalArtifactMutation: false,
  };
}

export function buildPeerTransactionPlan(
  manifest: ReleaseManifest,
  lock: ReleaseLock,
  destinationGasLimit: bigint,
  network: "arbitrum" | "celo" = "arbitrum",
): ReleaseTransactionPlan {
  if (destinationGasLimit <= 0n || destinationGasLimit > (1n << 32n) - 1n) {
    throw new Error("Peer wiring requires a measured non-zero uint32 destination gas limit");
  }
  const frozenGas = manifest.chains.arbitrum.destinationGasLimit;
  if (!frozenGas || BigInt(frozenGas) === 0n) {
    throw new Error("Peer wiring is blocked until the measured destination gas is frozen in the release manifest");
  }
  if (BigInt(frozenGas) !== destinationGasLimit) {
    throw new Error(`Peer wiring gas ${destinationGasLimit} differs from the frozen manifest value ${frozenGas}`);
  }
  const settlement = lock.identities.find(
    (identity) => identity.kind === "proxy" && identity.name === "SettlementModule",
  )?.address;
  const executor = lock.identities.find(
    (identity) => identity.kind === "proxy" && identity.name === "CeloSettlementExecutor",
  )?.address;
  if (!settlement || !executor) throw new Error("Missing settlement peer identities");
  const arbitrumCall = new Interface(["function setCcipRoute(uint64,address,uint32,uint8,uint64)"]).encodeFunctionData(
    "setCcipRoute",
    [
      BigInt(manifest.chains.celo.ccipSelector),
      executor,
      destinationGasLimit,
      manifest.chains.celo.protocolVersion,
      0n,
    ],
  );
  const celoCall = new Interface(["function setSourcePeer(address,uint8,uint64)"]).encodeFunctionData("setSourcePeer", [
    settlement,
    manifest.chains.arbitrum.protocolVersion,
    0n,
  ]);
  const isArbitrum = network === "arbitrum";
  return {
    schemaVersion: 1,
    releaseId: manifest.releaseId,
    sourceCommit: manifest.sourceCommit,
    stage: "settlement-peer",
    network,
    sender: manifest.ownership.protocolSafe,
    owner: manifest.ownership.protocolSafe,
    create2Factory: manifest.create2.factory,
    baseSalt: `${manifest.create2.domain}:${manifest.create2.version}`,
    libraryMap: lock.libraryMap,
    transactions: [
      {
        index: 1,
        stage: "settlement-peer",
        kind: "configuration",
        label: isArbitrum ? "wire verified Arbitrum to Celo route" : "reconcile verified Celo to Arbitrum source peer",
        network,
        sender: manifest.ownership.protocolSafe,
        to: isArbitrum ? settlement : executor,
        calldata: isArbitrum ? arbitrumCall : celoCall,
        preconditions: [
          "both peers are paused and code-hash verified",
          "fresh read-only router/selector/lane verification passed in both directions",
          "unresolved retiring-peer inventory is zero",
          isArbitrum
            ? `Celo source peer already equals ${settlement}`
            : "Arbitrum destination route is unset or already equals the frozen Celo executor",
          `live owner equals ${manifest.ownership.protocolSafe}`,
        ],
        resumableState:
          "Both peers remain paused and have no Safe value authority; exact repeated configuration is a no-op.",
        postActionVerifier: [
          isArbitrum
            ? `destination selector equals ${manifest.chains.celo.ccipSelector}`
            : `source selector remains ${manifest.chains.arbitrum.ccipSelector}`,
          isArbitrum ? `destination executor equals ${executor}` : `source module equals ${settlement}`,
          isArbitrum
            ? `destination gas limit equals ${destinationGasLimit}`
            : "source peer has no previous peer or grace window",
          "protocol version equals 1 and retiring-peer grace is zero for initial wiring",
          "both peers remain paused",
        ],
      },
    ],
    canonicalArtifactMutation: false,
  };
}
