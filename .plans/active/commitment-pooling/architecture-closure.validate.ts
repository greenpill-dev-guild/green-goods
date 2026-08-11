import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string) => readFileSync(join(here, path), "utf8");

const matrix = read("architecture-closure-matrices.md");
const contract = read("contract-spec.md");
const standing = read("standing-commitments-spec.md");
const uiux = read("uiux-spec.md");
const client = read("hifi/screens/client.ts");
const admin = read("hifi/screens/admin.ts");
const settlement = read("hifi/screens/settlement.ts");
const journeys = read("hifi/journeys.ts");
const types = read("hifi/types.ts");
const validate = read("hifi/validate.ts");
const acceptance = read("acceptance-matrix.md");
const diagrams = read("diagrams.md");
const prototypes = read("prototypes.md");
const coverage = read("prototypes-coverage.md");
const wireframes = read("wireframes.md");
const plan = read("plan.todo.md");
const status = read("status.json");
const handoffsReadme = read("handoffs/README.md");
const contractHandoff = read("handoffs/codex-contracts.md");
const indexerHandoff = read("handoffs/codex-indexer.md");
const stateHandoff = read("handoffs/codex-state-api.md");
const clientHandoff = read("handoffs/claude-ui-client.md");
const adminHandoff = read("handoffs/claude-ui-admin.md");

const failures: string[] = [];
const require = (condition: boolean, message: string) => {
  if (!condition) failures.push(message);
};

const section = (source: string, start: string, end: string) => {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  require(from >= 0, `missing section start: ${start}`);
  require(to > from, `missing section end: ${end}`);
  return from >= 0 && to > from ? source.slice(from, to) : "";
};

const namesInBackticks = (value: string) =>
  [...value.matchAll(/`([A-Za-z][A-Za-z0-9_]*)`/g)].map((match) => match[1]);

const canonicalEvents = [
  ...contract.matchAll(/^\s+- event:\s+([A-Za-z][A-Za-z0-9_]*)\(/gm),
].map((match) => match[1]);
require(canonicalEvents.length === 54, `expected 54 canonical ABI events, found ${canonicalEvents.length}`);
require(
  new Set(canonicalEvents).size === canonicalEvents.length,
  "canonical ABI inventory contains duplicate event names",
);

const eventMatrix = section(matrix, "### A1. Complete event inventory", "### A2.");
const matrixEventNames: string[] = [];
for (const line of eventMatrix.split("\n")) {
  if (!line.startsWith("| EO-")) continue;
  const cells = line.split("|");
  matrixEventNames.push(...namesInBackticks(cells[2] ?? ""));
}
for (const eventName of canonicalEvents) {
  require(
    matrixEventNames.filter((candidate) => candidate === eventName).length === 1,
    `${eventName} must appear exactly once in Matrix A1`,
  );
}
for (const eventName of new Set(matrixEventNames)) {
  require(canonicalEvents.includes(eventName), `Matrix A1 names unknown event ${eventName}`);
}

const requiredEntities = [
  "CommitmentPool",
  "CommitmentCycle",
  "CommitmentClass",
  "CommitmentUnitSummary",
  "CommitmentProviderExposure",
  "CommitmentSeries",
  "CommitmentSeriesCycleSummary",
  "Commitment",
  "CommitmentRequirement",
  "CommitmentContributor",
  "CommitmentContributorRequirementAssignment",
  "HypercertCommitmentContributorAllocation",
  "CommitmentWorkAttribution",
  "CommitmentContributorIndex",
  "CommitmentContributorRequirementIndex",
  "CommitmentEvidenceAttribution",
  "CommitmentEvidenceAttributionIndex",
  "CommitmentClaimRequest",
  "CommitmentClaimRequestIndex",
  "CommitmentEvent",
  "CommitmentPendingLifecycleProjection",
  "CommitmentPendingLifecycleProjectionIndex",
  "NeedCommitmentIndex",
  "CommitmentCounterIndex",
  "CommitmentExchange",
  "PoolMemberHistory",
] as const;
const entityMatrix = section(matrix, "### A2. Complete indexed entity", "---\n\n## Matrix B");
for (const entity of requiredEntities) {
  require(entityMatrix.includes(`\`${entity}\``), `${entity} is missing from Matrix A2`);
  require(new RegExp(`^type ${entity} \\{`, "m").test(contract), `${entity} is missing from the canonical indexer schema`);
}
for (let index = 1; index <= 28; index += 1) {
  require(entityMatrix.includes(`ER-${String(index).padStart(2, "0")}`), `missing ER-${String(index).padStart(2, "0")}`);
}

const materializationMatrix = section(
  matrix,
  "### A3. Sparse-event materialization ledger",
  "---\n\n## Matrix B",
);
for (let index = 1; index <= 8; index += 1) {
  require(
    materializationMatrix.includes(`PM-${String(index).padStart(2, "0")}`),
    `missing PM-${String(index).padStart(2, "0")}`,
  );
}

const poolingInterface = section(
  contract,
  "interface ICommitmentPoolingModule {",
  "interface ICommitmentRegistry {",
);
const poolingFunctions = [
  ...poolingInterface.matchAll(/^\s*function\s+([A-Za-z][A-Za-z0-9_]*)\s*\(/gm),
].map((match) => match[1]);
require(
  poolingFunctions.length === 86,
  `expected 86 ICommitmentPoolingModule functions, found ${poolingFunctions.length}`,
);
require(
  new Set(poolingFunctions).size === poolingFunctions.length,
  "ICommitmentPoolingModule contains duplicate function names",
);

const abiClassification = section(
  matrix,
  "### B1. Complete Commitment Pooling ABI classification",
  "### B2. Retry policies",
);
const classifiedFunctions: string[] = [];
let matrixExecutableFunctions: string[] = [];
for (const line of abiClassification.split("\n")) {
  if (!line.startsWith("|") || line.startsWith("|---") || line.startsWith("| Class")) continue;
  const cells = line.split("|");
  const className = (cells[1] ?? "").trim();
  const names = namesInBackticks(cells[2] ?? "");
  classifiedFunctions.push(...names);
  if (className === "Hi-fi executable now") matrixExecutableFunctions = names;
}
for (const functionName of poolingFunctions) {
  require(
    classifiedFunctions.filter((candidate) => candidate === functionName).length === 1,
    `${functionName} must appear exactly once in Matrix B1`,
  );
}
for (const functionName of new Set(classifiedFunctions)) {
  require(
    poolingFunctions.includes(functionName),
    `Matrix B1 names unknown ICommitmentPoolingModule function ${functionName}`,
  );
}

const contractCallBlock = types.match(/export type ContractCall =([\s\S]*?);\n\n\/\/ Metadata/)?.[1] ?? "";
const contractCalls = namesInBackticks(contractCallBlock.replaceAll('"', "`"));
require(contractCalls.length === 58, `expected 58 executable hi-fi call names, found ${contractCalls.length}`);
const executablePoolingCalls = contractCalls.filter((call) => poolingFunctions.includes(call));
require(
  executablePoolingCalls.length === 42,
  `expected 42 executable Commitment Pooling calls, found ${executablePoolingCalls.length}`,
);
for (const call of executablePoolingCalls) {
  require(
    matrixExecutableFunctions.filter((candidate) => candidate === call).length === 1,
    `${call} must appear exactly once in Matrix B1's hi-fi executable class`,
  );
}
for (const call of matrixExecutableFunctions) {
  require(
    executablePoolingCalls.includes(call),
    `Matrix B1 classifies ${call} as executable but ContractCall omits it`,
  );
}

const callCoverage = section(matrix, "### B3. Executable-call coverage", "---\n\n## Matrix C");
const matrixCallNames = namesInBackticks(callCoverage);
for (const call of contractCalls) {
  require(
    matrixCallNames.filter((candidate) => candidate === call).length === 1,
    `${call} must appear exactly once in Matrix B3`,
  );
}
for (const call of new Set(matrixCallNames)) {
  require(contractCalls.includes(call), `Matrix B3 names unknown executable call ${call}`);
}

const offlineKinds = [
  "commitmentSeries",
  "commitment",
  "claim",
  "evidence",
  "workLink",
  "confirmation",
] as const;
for (const kind of offlineKinds) {
  require(matrix.includes(`\`${kind}\``), `${kind} is missing from Matrix B`);
  require(uiux.includes(`\`${kind}\``), `${kind} is missing from the canonical UI/offline contract`);
}
require(matrix.includes("`transfer`"), "online-only transfer is missing from Matrix B");

for (const state of [
  "LOCAL_DRAFT",
  "SAVING_REMOTE",
  "SAVED_REMOTE",
  "SAVE_FAILED",
  "OFFLINE_LOCAL",
  "VERSION_CONFLICT",
]) {
  require(matrix.includes(`\`${state}\``), `${state} is missing from Matrix C`);
}
for (const id of ["LC-01", "LC-02", "LC-03", "LC-04", "LC-05", "LC-06", "LC-07"]) {
  require(matrix.includes(id), `${id} is missing from Matrix D`);
}

// P2-5 (2026-08-05): both hub indexes claimed exhaustiveness and were not exhaustive — five root
// files had no document-map row, and the handoffs README described source order instead of listing
// its files. Enumerate the real directories and require a row for each, so an index can never
// again promise more than it delivers.
const documentMap = section(plan, "## Document map", "**Published artifacts**");
for (const entry of readdirSync(join(here, "."), { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.startsWith(".")) continue;
  require(
    documentMap.includes(`\`${entry.name}\``),
    `document map has no row for hub root file ${entry.name}`,
  );
}
for (const subtree of ["artifacts", "handoffs", "hifi", "operations", "reports"]) {
  require(documentMap.includes(`\`${subtree}/`), `document map has no index row for the ${subtree}/ subtree`);
}
const handoffIndex = section(handoffsReadme, "## File index", "## Source order");
for (const entry of readdirSync(join(here, "handoffs"), { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.startsWith(".")) continue;
  require(
    handoffIndex.includes(`\`${entry.name}\``),
    `handoffs/README.md file index has no row for ${entry.name}`,
  );
}

// P2-1 (2026-08-05): the gallery's sensitive-action table calls itself the exact function-level
// authorization source. It had drifted by twelve mutations. Assert set inclusion against the
// canonical matrix's Function column so a new mutating entry point cannot land in one and not
// the other.
const canonicalPermissionMatrix = section(
  contract,
  "#### Permission matrix (the gating table)",
  "#### Creation payload hash (frozen preimage)",
);
const canonicalGatedFunctions = new Set<string>();
for (const line of canonicalPermissionMatrix.split("\n")) {
  if (!line.startsWith("| ")) continue;
  const cells = line.split("|");
  if (cells.length < 4) continue;
  for (const name of namesInBackticks(cells[2] ?? "")) canonicalGatedFunctions.add(name);
}
require(canonicalGatedFunctions.size > 0, "canonical permission matrix produced no function names");
const galleryPermissionTable = section(diagrams, "## Sensitive-action permission table", "## D27.");
for (const functionName of canonicalGatedFunctions) {
  require(
    galleryPermissionTable.includes(`\`${functionName}\``),
    `gallery permission table omits canonical gated function ${functionName}`,
  );
}

const commitmentCreatedDeclaration = (() => {
  const from = contract.indexOf("event CommitmentCreated(");
  require(from >= 0, "the Solidity CommitmentCreated event declaration is missing");
  if (from < 0) return "";
  const to = contract.indexOf(");", from);
  require(to > from, "the Solidity CommitmentCreated event declaration is unterminated");
  return to > from ? contract.slice(from, to) : "";
})();

const sourceChecks: Array<[boolean, string]> = [
  [contract.includes("mapping(address creator => mapping(bytes32 creationRequestKey => uint256 commitmentId))"), "commitment creation-key mapping is missing"],
  [contract.includes("CommitmentCreationRequestConflict"), "commitment creation-key conflict error is missing"],
  // P1-1 (2026-08-05): the indexed creationPayloadHash must have an event source. Assert the
  // frozen preimage exists AND that both the Solidity event and the config.yaml signature emit it,
  // so no future edit can reintroduce an indexed field with no legal materialization path.
  [
    contract.includes('#### Creation payload hash (frozen preimage)') &&
      /creationPayloadHash = keccak256\(/.test(contract),
    "the frozen creation-payload preimage is missing from contract-spec §6.1",
  ],
  // Scope this to the declaration itself. A `[\s\S]*?` span between the event name and the field
  // name is not a check at all: it happily matches from the Solidity event forward to the
  // config.yaml signature further down the file, and passes with the parameter deleted.
  [
    commitmentCreatedDeclaration.includes("bytes32 creationPayloadHash"),
    "CommitmentCreated does not emit creationPayloadHash",
  ],
  [
    /- event: CommitmentCreated\([^\n]*bytes32 creationPayloadHash/.test(contract),
    "the config.yaml CommitmentCreated signature does not emit creationPayloadHash",
  ],
  [
    indexerHandoff.includes("creationPayloadHash") && indexerHandoff.includes("never satisfy it with an RPC read"),
    "indexer handoff does not bind creationPayloadHash to the emitted event",
  ],
  [contract.includes("PoolHasLiveCommitments"), "pool zero-live close error is missing"],
  [contract.includes("PoolHasNonTerminalCycles"), "pool zero-cycle close error is missing"],
  [/struct Pool \{[\s\S]*liveCommitmentCount/.test(contract), "Pool.liveCommitmentCount is missing from the contract struct"],
  [/struct Pool \{[\s\S]*nonTerminalCycleCount/.test(contract), "Pool.nonTerminalCycleCount is missing from the contract struct"],
  [/type CommitmentPool \{[\s\S]*liveCommitmentCount: BigInt!/.test(contract), "CommitmentPool.liveCommitmentCount is missing from the indexer schema"],
  [/type CommitmentPool \{[\s\S]*nonTerminalCycleCount: BigInt!/.test(contract), "CommitmentPool.nonTerminalCycleCount is missing from the indexer schema"],
  [/type CommitmentPool \{[\s\S]*charterUpdateBlockNumber/.test(contract), "pool charter replay cursor is missing"],
  [/type CommitmentPool \{[\s\S]*providerCapUpdateBlockNumber/.test(contract), "pool provider-cap replay cursor is missing"],
  [/type CommitmentPool \{[\s\S]*registrationSeen: Boolean!/.test(contract), "pool sparse-registration marker is missing"],
  [/type CommitmentCycle \{[\s\S]*seedSeen: Boolean!/.test(contract), "cycle sparse-seed marker is missing"],
  [/type CommitmentSeries \{[\s\S]*creationSeen: Boolean!/.test(contract), "series sparse-creation marker is missing"],
  [/type CommitmentSeries \{[\s\S]*latestLifecycleBlock: BigInt(?:\s|#)/.test(contract), "series lifecycle cursor is not nullable"],
  [/type CommitmentSeries \{[\s\S]*latestLifecycleLogIndex: Int(?:\s|#)/.test(contract), "series lifecycle log cursor is not nullable"],
  [/type CommitmentSeries \{[\s\S]*latestMetadataBlock: BigInt(?:\s|#)/.test(contract), "series metadata cursor is not nullable"],
  [/type CommitmentSeries \{[\s\S]*latestMetadataLogIndex: Int(?:\s|#)/.test(contract), "series metadata log cursor is not nullable"],
  [/type Commitment \{[\s\S]*creationSeen: Boolean!/.test(contract), "commitment sparse-creation marker is missing"],
  [/type CommitmentClaimRequest \{[\s\S]*requestSeen: Boolean!/.test(contract), "claim sparse-request marker is missing"],
  [/type CommitmentClaimRequest \{[\s\S]*requestedBy: String(?:\s|#)/.test(contract), "claim sparse placeholder payload is not nullable"],
  [/type CommitmentContributor \{[\s\S]*additionSeen: Boolean!/.test(contract), "contributor sparse-add marker is missing"],
  [/type CommitmentWorkAttribution \{[\s\S]*linkSeen: Boolean!/.test(contract), "Work sparse-link marker is missing"],
  [/type Commitment \{[\s\S]*considerationUpdateBlockNumber/.test(contract), "commitment consideration replay cursor is missing"],
  [/type Commitment \{[\s\S]*acceptanceBlockNumber/.test(contract), "commitment acceptance position is missing"],
  [/type CommitmentContributor \{[\s\S]*membershipBlockNumber/.test(contract), "contributor membership cursor is missing"],
  [/type CommitmentWorkAttribution \{[\s\S]*linkLifecycleBlockNumber/.test(contract), "Work link lifecycle cursor is missing"],
  [/type CommitmentClaimRequest \{[\s\S]*lifecycleBlockNumber/.test(contract), "claim request lifecycle cursor is missing"],
  [contract.includes("CommitmentContributorRequirementAssignment"), "contributor requirement assignment entity is missing"],
  [contract.includes("CommitmentContributorRequirementIndex"), "contributor requirement assignment index is missing"],
  [contract.includes("late `ClaimRequested`"), "late ClaimRequested reconciliation rule is missing"],
  [
    contract.includes("terminal placeholder with `requestSeen = false`") &&
      contract.includes("without") &&
      contract.includes("regressing `DECLINED`"),
    "decline-before-request materialization rule is missing",
  ],
  [
    contract.includes("nullable fields plus an explicit seen flag") &&
      contract.includes("unrelated cursor pairs remain null"),
    "sparse parent/series placeholder contract is incomplete",
  ],
  [contract.includes("signed commutative deltas"), "register reverse-delivery policy is missing"],
  [contract.includes("confirmationCount = max(currentCount, emittedCount)"), "confirmation cumulative-count convergence is missing"],
  [contract.includes("deterministically sorted"), "relationship-array convergence is missing"],
  [contract.includes("getWorkLinkOperationPayloadHash"), "Work-link read-through getter is missing"],
  [contract.includes("bytes32 operationKey") && contract.includes("WorkLinkOperationConflict"), "Work-link operation-key contract is missing"],
  [contract.includes("38-feature-slot declaration order plus the 12-slot"), "storage acceptance is not 38+12"],
  [standing.includes("clientCommitmentId"), "stable clientCommitmentId is missing from standing commitment recovery"],
  [standing.includes("getCommitmentIdByCreationRequest"), "commitment creation read-through getter is missing"],
  [uiux.includes("clientCommitmentId"), "commitment offline payload lacks clientCommitmentId"],
  [uiux.includes("operationKey") && uiux.includes("later unlink"), "Work-link offline recovery is missing from UI contract"],
  [client.includes('["saving", "Saving privately"]'), "W32 saving state is missing"],
  [client.includes('["save-failed", "Save failed"]'), "W32 save-failed state is missing"],
  [client.includes('"w32.save": { l: "Save privately", to: "screen:W32@saving"'), "W32 save does not enter saving"],
  [client.includes('"w35.retry-failed"') && client.includes("same creationRequestKey"), "W35 retry lacks same-key recovery copy"],
  [types.includes("poolLiveCommitments?: PoolLiveCommitments"), "hi-fi StateFacts lacks pool live-count facts"],
  [types.includes("poolNonTerminalCycles?: PoolNonTerminalCycles"), "hi-fi StateFacts lacks pool cycle-count facts"],
  [validate.includes('closePool:') && validate.includes('poolLiveCommitments: ["Zero"]'), "hi-fi closePool rule lacks zero-live guard"],
  [validate.includes('poolNonTerminalCycles: ["Zero"]'), "hi-fi closePool rule lacks zero-cycle guard"],
  [admin.includes("live promises must be wound down"), "admin close flow lacks a live-commitment blocker"],
  [admin.includes('"close-blocked-live"') && admin.includes('poolLiveCommitments: "NonZero"'), "admin close blocker lacks non-zero facts"],
  [
    admin.includes('["due-live", "Past due — expiry available"]') &&
      admin.includes('"w7.expire-commitment"') &&
      admin.includes('calls: ["expireCommitment"]'),
    "admin due-live expiry action is missing",
  ],
  [types.includes('| "expireCommitment"'), "hi-fi ContractCall omits expireCommitment"],
  [
    validate.includes("expireCommitment:") &&
      validate.includes('next: "Expired"'),
    "hi-fi expireCommitment rule is missing",
  ],
  [settlement.includes('poolNonTerminalCycles: "One"'), "last-cycle compost flow lacks pre-compost count facts"],
  [
    journeys.includes('W7@due-live') &&
      journeys.includes('w7.expire-commitment') &&
      journeys.includes('W7@expiry-queue'),
    "admin expiry journey does not prove due-live to Expired",
  ],
  [journeys.includes('W32@saving') && journeys.includes('W32@offline-local'), "saved-Offer journeys omit saving/offline truth"],
  [!section(journeys, '{ id: "sb38"', '{ id: "sb39"').includes('W32@saved'), "SB-38 still claims a no-signal save succeeded"],
  [acceptance.includes("Pool.nonTerminalCycleCount == 0"), "acceptance matrix lacks the pool close guard"],
  [
    acceptance.includes("late `ClaimRequested`") ||
      /acceptance\/terminal before older `?ClaimRequested`?/i.test(acceptance),
    "acceptance matrix lacks late-claim convergence",
  ],
  [diagrams.includes("linkWork(commitmentId, workUID, requirementIndex, operationKey)"), "diagrams use the old Work-link signature"],
  [
    /\|\s*`submitForConfirmation`\s*\|[^|]*lead provider/.test(diagrams),
    "the gallery submitForConfirmation row omits the accountable lead provider",
  ],
  [diagrams.includes("pool.nonTerminalCycleCount = 0"), "diagrams omit the pool cycle-close guard"],
  [
    diagrams.includes("Sixteen core NET-NEW pooling entities plus ten auxiliary") &&
      diagrams.includes("the 26 pooling/contributor/replay records"),
    "D15 entity counts are stale",
  ],
  [
    diagrams.includes("COMMITMENT ||--o| COMMITMENT_CLASS") &&
      diagrams.includes("COMMITMENT_CONTRIBUTOR_REQUIREMENT_INDEX ||--o{ COMMITMENT_CONTRIBUTOR_REQUIREMENT_ASSIGNMENT"),
    "D15 omits closure entity relationships",
  ],
  [
    diagrams.includes('BigInt membershipBlockNumber "latest add/remove event position"') &&
      diagrams.includes('BigInt lifecycleBlockNumber "latest assignment event position"') &&
      diagrams.includes('BigInt linkLifecycleBlockNumber "latest link/unlink event position"'),
    "D15 omits relationship replay cursors",
  ],
  [
    diagrams.includes('Boolean registrationSeen "false only for update-before-registration placeholder"') &&
      diagrams.includes('Boolean seedSeen "false only for lifecycle-before-seed placeholder"') &&
      diagrams.includes('Boolean requestSeen "false for decline-before-request placeholder"') &&
      diagrams.includes('Boolean additionSeen "false for remove-or-decision-before-add placeholder"') &&
      diagrams.includes('Boolean linkSeen "false for unlink-or-decision-before-link placeholder"'),
    "D15 omits sparse-event materialization markers",
  ],
  [prototypes.includes("clientCommitmentId") && prototypes.includes("creationRequestKey"), "prototype spec lacks place idempotency"],
  [
    prototypes.includes("`W7@due-live` → `W7@expiry-queue`") &&
      prototypes.includes("`W10@edit-declared-value`"),
    "prototype spec omits executable expiry or declared-value paths",
  ],
  [wireframes.includes("`saving` · `save-failed` · `offline-local` · `version-conflict`"), "wireframes omit persistence truth states"],
  [wireframes.includes("#screens/W7@open") && wireframes.includes("(30 states)"), "wireframe W7 state count is stale"],
  [
    coverage.includes("410 rendered states") &&
      coverage.includes("556 registered hotspots") &&
      coverage.includes("389 scenes"),
    "prototype coverage snapshot is stale",
  ],
  [plan.includes("architecture-closure-matrices.md") && plan.includes("architecture-closure.validate.ts"), "plan document map omits closure artifacts"],
  [status.includes("38 named plus __gap[12]"), "status still declares the old storage layout"],
  [contractHandoff.includes("38-feature-slot") && contractHandoff.includes("operationKey"), "contract handoff omits closure contract"],
  [
    clientHandoff.includes("on by default for the pilot") &&
      adminHandoff.includes("on by default for the pilot") &&
      !clientHandoff.includes("off-by-default") &&
      !adminHandoff.includes("off-by-default"),
    "a dispatch handoff still carries the superseded fallback default (register #94 is pilot-default ON)",
  ],
  [
    indexerHandoff.includes("sixteen pooling entities") &&
      indexerHandoff.includes("late `ClaimRequested`") &&
      indexerHandoff.includes("`requestSeen = false`") &&
      indexerHandoff.includes("decline-first fixture"),
    "indexer handoff omits closure entities or reverse-delivered claims",
  ],
  [stateHandoff.includes("clientCommitmentId") && stateHandoff.includes("OFFLINE_LOCAL"), "state/API handoff omits retry or persistence truth"],
  // P1-2 (2026-08-05): the PoolMemberHistory disclosure rule used to live only in prose inputs.
  // Require it to be an output, an acceptance bullet, and a RED test, so the lane cannot turn
  // GREEN while exposing participant rows to the wrong viewer.
  [
    section(stateHandoff, "## Outputs", "## Acceptance").includes("usePoolMemberHistory") &&
      section(stateHandoff, "## Acceptance", "## RED / GREEN").includes("usePoolMemberHistory") &&
      section(stateHandoff, "## RED / GREEN", "## Exact Bun commands").includes("usePoolMemberHistory"),
    "PoolMemberHistory disclosure is not bound to state/API outputs, acceptance, and RED tests",
  ],
  [
    stateHandoff.includes("usePoolParticipationSummary"),
    "state/API handoff omits the aggregate-only editorial selector",
  ],
  // Bounded to a single sentence, and asserting the OUTCOME rather than the topic.
  // The first draft only required "former ... steward" and "unauthenticated" to appear
  // somewhere, so flipping a former steward to `visible` would still have passed — the
  // same vacuous-span trap the CommitmentCreated check hit earlier in this file.
  [
    /former steward[^.]{0,80}`hidden`/i.test(stateHandoff),
    "state/API handoff no longer states that a former steward reads `hidden`",
  ],
  [
    ['"visible"', '"hidden"', '"unauthenticated"'].every((result) => stateHandoff.includes(result)),
    "state/API handoff omits one of the three usePoolMemberHistory disclosure results",
  ],
  [clientHandoff.includes("clientCommitmentId") && clientHandoff.includes("SAVING_REMOTE"), "client handoff omits retry or persistence truth"],
  [
    adminHandoff.includes("Pool.nonTerminalCycleCount") &&
      adminHandoff.includes("`W7@due-live`") &&
      adminHandoff.includes("`W10@edit-declared-value`"),
    "admin handoff omits pool close, expiry, or declared-value paths",
  ],
];
for (const [condition, message] of sourceChecks) require(condition, message);

const staleCanonicalSources = [
  contract,
  acceptance,
  diagrams,
  prototypes,
  wireframes,
  status,
  contractHandoff,
  indexerHandoff,
  stateHandoff,
  clientHandoff,
  adminHandoff,
];
for (const [index, source] of staleCanonicalSources.entries()) {
  require(!source.includes("__gap[14]"), `canonical source ${index + 1} still names __gap[14]`);
  require(
    !source.includes("linkWork(commitmentId, workUID, requirementIndex)"),
    `canonical source ${index + 1} still uses the old Work-link signature`,
  );
  require(
    !/fifteen core|15 core|eight auxiliary|8 auxiliary|23 pooling/i.test(source),
    `canonical source ${index + 1} still uses the old 15+8 entity count`,
  );
}

if (failures.length > 0) {
  console.error(`Architecture closure validation failed (${failures.length}):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Architecture closure validation passed: ${canonicalEvents.length} events, ` +
  `${requiredEntities.length} indexed entities, ${poolingFunctions.length} classified module functions, ` +
  `8 sparse-event materialization rows, ${contractCalls.length} executable calls, ` +
  `${offlineKinds.length} offline kinds, 6 persistence states, and 7 lifecycle subjects.`,
);
