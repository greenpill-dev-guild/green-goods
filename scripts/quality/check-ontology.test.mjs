import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BASELINE_MAX_DAYS,
  collectAnchorFiles,
  compareMembers,
  evalNumericToken,
  extractQuotedConstant,
  normalizeDocText,
  parseCapitalsNote,
  parseGlossaryTable,
  parseGraphqlEnum,
  parseSolidityEnum,
  parseTsInterfaceKeys,
  parseTsNumericEnum,
  parseTsObjectKeys,
  parseTsObjectValues,
  parseTsPropertyUnion,
  parseTsReadonlyArray,
  parseTsUnion,
  reconcileBaseline,
  splitTableRow,
  titleCase,
  checkProjections,
  collectProjectionEvidencePaths,
  isMeaningfulEvidenceValue,
} from "./check-ontology.mjs";
import { expectedWorkflowNames } from "./ci-gate.mjs";
import { escapeMdxTableCode, renderEntityMatrixMdx, renderOntologyMdx } from "./ontology-render.mjs";

// ---------------------------------------------------------------------------
// Extractors
// ---------------------------------------------------------------------------

test("parseSolidityEnum handles trailing member comments and a blank line before the brace", () => {
  const source = `
/// @notice Domain categories for actions
enum Domain {
    SOLAR, // 0
    AGRO, // 1
    EDU, // 2
    WASTE // 3

}
`;
  assert.deepEqual(parseSolidityEnum(source, "Domain"), ["SOLAR", "AGRO", "EDU", "WASTE"]);
});

test("parseSolidityEnum returns null for a missing symbol", () => {
  assert.equal(parseSolidityEnum("enum Other { A }", "Domain"), null);
});

test("parseSolidityEnum ignores a commented-out legacy declaration", () => {
  const source = `
/* legacy:
enum Domain { OLD_SOLAR, OLD_AGRO }
*/
enum Domain { SOLAR, AGRO, EDU, WASTE }
`;
  assert.deepEqual(parseSolidityEnum(source, "Domain"), ["SOLAR", "AGRO", "EDU", "WASTE"]);
});

test("parseGraphqlEnum ignores # comment lines around and inside the block", () => {
  const source = `
# Retained for compatibility with existing helper mappings.
enum WeightScheme {
  LINEAR
  # legacy comment
  EXPONENTIAL
  POWER
}
`;
  assert.deepEqual(parseGraphqlEnum(source, "WeightScheme"), ["LINEAR", "EXPONENTIAL", "POWER"]);
});

test("parseTsNumericEnum reads explicit values", () => {
  const source = `
export enum Capital {
  SOCIAL = 0,
  MATERIAL = 1,
  FINANCIAL = 2,
}
`;
  assert.deepEqual(parseTsNumericEnum(source, "Capital"), {
    members: ["SOCIAL", "MATERIAL", "FINANCIAL"],
    values: [0, 1, 2],
  });
});

test("parseTsNumericEnum strips JSDoc block comments between members", () => {
  const source = `
export enum PoolType {
  /** Hypercert curation pool -- members signal support for registered hypercerts */
  Hypercert = 0,
  /** Action signaling pool -- members signal priority on registered Actions */
  Action = 1,
}
`;
  assert.deepEqual(parseTsNumericEnum(source, "PoolType"), {
    members: ["Hypercert", "Action"],
    values: [0, 1],
  });
});

test("parseTsNumericEnum evaluates bit-shift values with trailing comments", () => {
  const source = `
export enum VerificationMethod {
  HUMAN = 1 << 0, // 1
  IOT = 1 << 1, // 2
  ONCHAIN = 1 << 2, // 4
  AGENT = 1 << 3, // 8
}
`;
  assert.deepEqual(parseTsNumericEnum(source, "VerificationMethod"), {
    members: ["HUMAN", "IOT", "ONCHAIN", "AGENT"],
    values: [1, 2, 4, 8],
  });
});

test("evalNumericToken rejects arbitrary expressions", () => {
  assert.equal(evalNumericToken("1 << 3"), 8);
  assert.equal(evalNumericToken("42"), 42);
  assert.equal(evalNumericToken("Number.MAX_SAFE_INTEGER"), null);
});

test("parseTsUnion collects literals across a multi-line union", () => {
  const source = `
export type WorkDisplayStatus =
  | "approved"
  | "rejected"
  | "pending"
  | "syncing"
  | "uploading"
  | "sync_failed"
  | "offline";
`;
  assert.deepEqual(parseTsUnion(source, "WorkDisplayStatus"), [
    "approved",
    "rejected",
    "pending",
    "syncing",
    "uploading",
    "sync_failed",
    "offline",
  ]);
});

test("parseTsUnion survives a comment containing a semicolon inside the union", () => {
  const source = `
export type WorkDisplayStatus =
  | "approved"
  | "rejected"
  // deprecated; use rejected
  | "archived";
`;
  assert.deepEqual(parseTsUnion(source, "WorkDisplayStatus"), ["approved", "rejected", "archived"]);
});

test("parseTsInterfaceKeys collects top-level keys", () => {
  const source = `
export interface JobKindMap {
  work: WorkJobPayload;
  approval: ApprovalJobPayload;
}
`;
  assert.deepEqual(parseTsInterfaceKeys(source, "JobKindMap"), ["work", "approval"]);
});

test("parseTsObjectKeys reads keys and numeric values", () => {
  const source = `
export const GARDEN_ROLE_IDS = {
  gardener: 0,
  evaluator: 1,
  operator: 2,
} as const;
`;
  assert.deepEqual(parseTsObjectKeys(source, "GARDEN_ROLE_IDS"), {
    keys: ["gardener", "evaluator", "operator"],
    values: [0, 1, 2],
  });
});

test("parseTsObjectValues reads string values from numeric-keyed records", () => {
  const source = `
const DOMAIN_SLUG_PREFIX: Record<ActionDomainValue, string> = {
  0: "solar",
  1: "agro",
  2: "edu",
  3: "waste",
};
`;
  assert.deepEqual(parseTsObjectValues(source, "DOMAIN_SLUG_PREFIX"), ["solar", "agro", "edu", "waste"]);
});

test("parseTsReadonlyArray reads string literals", () => {
  const source = `
export const ACTION_DOMAINS: readonly ActionDomain[] = [
  "solar",
  "waste",
] as const;
`;
  assert.deepEqual(parseTsReadonlyArray(source, "ACTION_DOMAINS"), ["solar", "waste"]);
});

test("extractQuotedConstant reads a multi-line Solidity constant in full", () => {
  const source = `
contract DeployBadgeSchema {
    string internal constant GREEN_GOODS_BADGE_SCHEMA =
        "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier";
}
`;
  assert.equal(
    extractQuotedConstant(source, "GREEN_GOODS_BADGE_SCHEMA"),
    "string badgeType, address recipient, uint40 earnedAt, string evidenceUri, uint8 tier"
  );
  assert.equal(extractQuotedConstant(source, "MISSING_CONSTANT"), null);
});

test("parseTsPropertyUnion is line-anchored so substatus cannot satisfy status", () => {
  const source = `
export interface Thing {
  substatus: "wrong" | "target";
  status: "approved" | "rejected";
}
`;
  assert.deepEqual(parseTsPropertyUnion(source, "Thing", "status"), ["approved", "rejected"]);
});

test("parseTsPropertyUnion scopes to the named container", () => {
  const source = `
export interface OtherThing {
  status: "wrong" | "container";
}

export interface EnhancedWorkApproval extends WorkApproval {
  type: "work_approval";
  status: "approved" | "rejected" | "pending" | "syncing" | "failed";
  size: number;
}
`;
  assert.deepEqual(parseTsPropertyUnion(source, "EnhancedWorkApproval", "status"), [
    "approved",
    "rejected",
    "pending",
    "syncing",
    "failed",
  ]);
});

// ---------------------------------------------------------------------------
// Docs parsers
// ---------------------------------------------------------------------------

test("parseGlossaryTable strips bold names and captures definitions", () => {
  const source = `
## Domain Entities

Intro text.

| Term | Type | Allowed surfaces | Definition |
|------|------|------------------|------------|
| **Garden** | entity | admin · client | A community of gardeners. |
| **Action** | entity | admin | The unit of work template. |

---

## Personas
`;
  assert.deepEqual(parseGlossaryTable(source, "Domain Entities"), [
    { name: "Garden", definition: "A community of gardeners." },
    { name: "Action", definition: "The unit of work template." },
  ]);
});

test("parseGlossaryTable includes unbolded rows so they surface as drift", () => {
  const source = `
## Domain Entities

| Term | Type | Allowed surfaces | Definition |
|------|------|------------------|------------|
| **Garden** | entity | admin | A community of gardeners. |
| Ghost | entity | admin | An undeclared row. |

---
`;
  assert.deepEqual(parseGlossaryTable(source, "Domain Entities"), [
    { name: "Garden", definition: "A community of gardeners." },
    { name: "Ghost", definition: "An undeclared row." },
  ]);
});

test("splitTableRow honors escaped pipes", () => {
  assert.deepEqual(splitTableRow('| **Work** | entity | a \\| b | A "p" \\| "q" status. |'), [
    "",
    "**Work**",
    "entity",
    "a | b",
    'A "p" | "q" status.',
    "",
  ]);
});

test("parseCapitalsNote extracts name/index pairs", () => {
  const source =
    "> The numbering above is presentational. The canonical machine ordering is the `Capital` enum: Social (0), Material (1), Financial (2).";
  assert.deepEqual(parseCapitalsNote(source), [
    { name: "Social", value: 0 },
    { name: "Material", value: 1 },
    { name: "Financial", value: 2 },
  ]);
});

test("normalizeDocText strips markup and collapses whitespace", () => {
  assert.equal(
    normalizeDocText("A **bold** and *italic* `code` [link](https://x) \n  sentence."),
    "A bold and italic code link sentence."
  );
});

test("titleCase converts SCREAMING members", () => {
  assert.equal(titleCase("SOCIAL"), "Social");
});

// ---------------------------------------------------------------------------
// Comparison + baseline
// ---------------------------------------------------------------------------

test("compareMembers reports missing, unexpected, order, and value diffs", () => {
  assert.deepEqual(compareMembers(["a", "b"], ["a", "b"], { ordered: true }), []);
  assert.deepEqual(compareMembers(["a", "b"], ["a"], {}), ["missing [b]"]);
  assert.deepEqual(compareMembers(["a"], ["a", "c"], {}), ["unexpected [c]"]);
  assert.deepEqual(compareMembers(["a", "b"], ["b", "a"], { ordered: true }), [
    "order expected [a, b] found [b, a]",
  ]);
  assert.deepEqual(compareMembers(["a", "b"], ["b", "a"], { ordered: false }), []);
  assert.deepEqual(
    compareMembers(["a", "b"], ["a", "b"], { expectedValues: [0, 1], actualValues: [0, 2] }),
    ["value b expected 1 found 2"]
  );
});

test("compareMembers reports duplicates even when unordered", () => {
  assert.deepEqual(compareMembers(["a", "b"], ["a", "b", "b"], { ordered: false }), [
    "duplicate members [b]",
  ]);
});

test("compareMembers fails loudly when declared values are not extractable", () => {
  assert.deepEqual(compareMembers(["a", "b"], ["a", "b"], { expectedValues: [0, 1], actualValues: null }), [
    "values declared in the sidecar but not statically extractable from the source",
  ]);
});

test("compareMembers order check is safe for members containing spaces", () => {
  assert.deepEqual(compareMembers(["X", "X X"], ["X X", "X"], { ordered: true }), [
    "order expected [X, X X] found [X X, X]",
  ]);
});

const today = new Date("2026-07-25T00:00:00Z");
const finding = {
  guard: "shared-ts-vocab",
  subject: "vocab:capital/rep:capital-type",
  file: "packages/shared/src/types/hypercerts.ts",
  detail: "order expected [a] found [b]",
  message: "deviates",
};
const entry = {
  id: "capital-type-order",
  guard: "shared-ts-vocab",
  subject: "vocab:capital/rep:capital-type",
  detail: "order expected [a] found [b]",
  owner: "shared",
  expires: "2027-03-01",
  note: "Reorder CapitalType to canonical machine order.",
};

test("reconcileBaseline matches a finding to its entry", () => {
  const result = reconcileBaseline([finding], { entries: [entry] }, today);
  assert.deepEqual(result.errors, []);
  assert.equal(result.matched, 1);
});

test("reconcileBaseline fails an unlisted finding", () => {
  const result = reconcileBaseline([finding], { entries: [] }, today);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /unlisted drift/);
});

test("reconcileBaseline fails a stale entry", () => {
  const result = reconcileBaseline([], { entries: [entry] }, today);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /stale baseline entry/);
});

test("reconcileBaseline fails when the detail changed", () => {
  const changed = { ...finding, detail: "order expected [a] found [c]" };
  const result = reconcileBaseline([changed], { entries: [entry] }, today);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0], /detail changed/);
});

test("reconcileBaseline enforces entry hygiene", () => {
  const past = { ...entry, id: "past", expires: "2026-01-01" };
  const farOut = { ...entry, id: "far", expires: "2028-01-01" };
  const shortNote = { ...entry, id: "short", note: "too short" };
  const duplicate = { ...entry };
  const result = reconcileBaseline([finding], { entries: [entry, duplicate, past, farOut, shortNote] }, today);
  assert.ok(result.errors.some((e) => e.includes("duplicate entry id")));
  assert.ok(result.errors.some((e) => e.includes("expired on 2026-01-01")));
  assert.ok(result.errors.some((e) => e.includes(`more than ${BASELINE_MAX_DAYS} days`)));
  assert.ok(result.errors.some((e) => e.includes("at least 12 characters")));
});

test("reconcileBaseline rejects duplicate guard+subject entries", () => {
  const shadow = { ...entry, id: "different-id" };
  const result = reconcileBaseline([finding], { entries: [entry, shadow] }, today);
  assert.ok(result.errors.some((e) => e.includes("duplicate guard+subject")));
});

test("reconcileBaseline warns inside the 30-day expiry window", () => {
  const soon = { ...entry, expires: "2026-08-10" };
  const result = reconcileBaseline([finding], { entries: [soon] }, today);
  assert.deepEqual(result.errors, []);
  assert.equal(result.warnings.length, 1);
  assert.match(result.warnings[0], /expires in \d+ day/);
});

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

test("escapeMdxTableCode escapes every MDX-breaking character", () => {
  assert.equal(escapeMdxTableCode("a & b | c < d > e ` f { g }"), "a &amp; b \\| c &lt; d &gt; e &#96; f &#123; g &#125;");
});

const miniOntology = {
  version: 1,
  meta: { last_verified: "2026-07-25", excluded_from_v1: [] },
  entities: [
    {
      id: "garden",
      display: "Garden",
      status: "live",
      definition: "A community of gardeners.",
      layers: { solidity: ["a.sol"], docs: "g.md" },
    },
  ],
  personas: [{ id: "gardener", display: "Gardener", hat: "gardener", definition: "Does work." }],
  personas_note: "Owner has no persona.",
  vocabularies: [
    {
      id: "domain",
      status: "live",
      definition: "Where work happens.",
      canonical: { ordered: true, value_scheme: "index", members: ["SOLAR", "AGRO"] },
      representations: [
        {
          id: "solidity",
          layer: "solidity",
          file: "a.sol",
          symbol: "Domain",
          extract: "solidity-enum",
          ordered: true,
          members: ["SOLAR", "AGRO"],
        },
      ],
      mappings: [],
    },
    {
      id: "pool-state",
      status: "spec",
      definition: "Pool lifecycle.",
      spec_source: "spec.md",
      canonical: { ordered: true, value_scheme: "index", members: ["None", "Ready"] },
      planned_anchor: { file: "b.sol", symbol: "PoolState" },
      representations: [],
      mappings: [],
    },
  ],
  schemas: {
    work: {
      status: "live",
      source: "schemas.json",
      name: "Work",
      revocable: false,
      resolver: "w.sol",
      fields: [{ name: "actionUID", type: "uint256" }],
    },
  },
  constraints: [
    {
      id: "x",
      kind: "sum",
      status: "live",
      statement: "Sums to 10000.",
      enforced_at: [{ file: "y.sol", lines: "1-2" }],
      holes: [],
    },
  ],
  state_machines: [
    {
      id: "work-display-status",
      status: "live",
      vocabulary: "domain",
      states: [{ name: "pending", storage: "protocol" }],
      transitions: [],
    },
    {
      id: "pool",
      status: "spec",
      vocabulary: "pool-state",
      spec_source: "spec.md",
      states: [{ name: "Ready", storage: "on-chain" }],
      transitions: [{ from: "None", to: "Ready", layer: "on-chain", mechanism: "markPoolReady | guard" }],
    },
  ],
  integration_matrix: {
    protocols: ["Karma GAP", "Unlock"],
    rows: [{ ref: "entity:garden", label: "Garden", cells: { "Karma GAP": "Project" } }],
  },
  pattern_watches: [],
  known_issues: [{ id: "k", statement: "An issue.", anchors: ["a.sol"] }],
};

test("every sidecar anchor file is covered by the Ontology ci-gate matcher", () => {
  const sidecar = JSON.parse(
    readFileSync(new URL("../../packages/shared/src/ontology/green-goods-ontology.json", import.meta.url), "utf8")
  );
  for (const file of collectAnchorFiles(sidecar)) {
    assert.ok(
      expectedWorkflowNames([file]).includes("Ontology"),
      `sidecar anchor is outside the Ontology workflow path filter: ${file}`
    );
  }
});

test("renderers are deterministic", () => {
  assert.equal(renderOntologyMdx(miniOntology), renderOntologyMdx(miniOntology));
  assert.equal(renderEntityMatrixMdx(miniOntology), renderEntityMatrixMdx(miniOntology));
});

test("matrix renderer emits em-dash for missing cells and escapes pipes in mechanisms", () => {
  const matrix = renderEntityMatrixMdx(miniOntology);
  assert.ok(matrix.includes("| Garden | Project | — |"));
  const reference = renderOntologyMdx(miniOntology);
  assert.ok(reference.includes("markPoolReady \\| guard"));
});

// ---------------------------------------------------------------------------
// Projections guard (capabilities, concept cards, claim ledger, machines)
// ---------------------------------------------------------------------------

const projDim = (state) => ({
  state,
  evidence: [{ file: "package.json" }],
  verified_at: "2026-08-15",
});
const projCapability = (entity, availability = "complete") => ({
  entity,
  dimensions: {
    implementation: projDim("complete"),
    deployment: projDim("complete"),
    activation: projDim("complete"),
    indexing: projDim("partial"),
    availability: projDim(availability),
  },
});
const projCard = (entity) => ({
  entity,
  plain_name: "Thing",
  why_it_matters: "It matters.",
  example: "An example.",
  aliases: [],
  not_confused_with: [],
  safe_claim: "A safe sentence.",
});
const projOntology = {
  entities: [
    { id: "garden", display: "Garden", status: "live", definition: "d", layers: { solidity: ["package.json"] } },
    { id: "commitment", display: "Commitment", status: "spec", definition: "d", spec_source: "package.json" },
  ],
  personas: [{ id: "gardener", display: "Gardener", hat: "gardener", definition: "d" }],
  capabilities: [projCapability("garden"), projCapability("commitment", "blocked")],
  concept_cards: [projCard("garden"), projCard("commitment")],
  state_machines: [
    {
      id: "ok-machine",
      status: "live",
      vocabulary: "v",
      states: [{ name: "A", storage: "on-chain" }, { name: "B", storage: "on-chain" }],
      transitions: [{ from: "A", to: "B", layer: "on-chain", mechanism: "m" }],
    },
  ],
};
const projClaims = {
  maturity_values: ["available", "deployed-not-available", "in-build", "planned", "vision"],
  claims: [
    {
      id: "c1",
      claim: "Gardens are live.",
      audience: "community",
      maturity: "available",
      capabilities: ["garden"],
      evidence: [{ file: "package.json" }],
      safe_wording: "Gardens are live on Arbitrum.",
      verified_at: "2026-08-15",
    },
  ],
};

test("checkProjections passes a consistent projection set", () => {
  const { findings } = checkProjections(projOntology, projClaims, null);
  assert.deepEqual(findings, []);
});

test("checkProjections rejects available claims over blocked capabilities", () => {
  const claims = structuredClone(projClaims);
  claims.claims[0].capabilities = ["commitment"];
  const { findings } = checkProjections(projOntology, claims, null);
  assert.ok(findings.some((f) => f.detail.includes("not user-available")));
});

test("checkProjections rejects composite endpoints, missing evidence, and spec availability", () => {
  const broken = structuredClone(projOntology);
  broken.state_machines[0].transitions.push({ from: "A | B", to: "B", layer: "on-chain", mechanism: "m" });
  broken.capabilities[0].dimensions.deployment.evidence = [];
  broken.capabilities[1].dimensions.availability = projDim("complete");
  const { findings } = checkProjections(broken, projClaims, null);
  assert.ok(findings.some((f) => f.detail.includes("composite endpoint")));
  assert.ok(findings.some((f) => f.detail.includes("has no evidence")));
  assert.ok(findings.some((f) => f.detail.includes("spec but availability")));
});

test("checkProjections locks glossary counts to the sidecar", () => {
  const glossary = [
    "1. **Domain entities** — the 3 things the system tracks.",
    "2. **Personas** — the 1 people the system serves.",
    "## Domain Entities",
    "| **Garden** | ... |",
    "- **Commitment**: planned.",
    "",
    "---",
  ].join("\n");
  const { findings } = checkProjections(projOntology, projClaims, glossary);
  assert.ok(findings.some((f) => f.subject === "glossary:entity-count"));
  const good = glossary.replace("the 3 things", "the 1 things");
  const { findings: after } = checkProjections(projOntology, projClaims, good);
  assert.ok(!after.some((f) => f.subject === "glossary:entity-count"));
});

test("checkProjections rejects duplicate capability, card, and claim entries", () => {
  const dup = structuredClone(projOntology);
  dup.capabilities.push(projCapability("garden"));
  const claims = structuredClone(projClaims);
  claims.claims.push(structuredClone(claims.claims[0]));
  const { findings } = checkProjections(dup, claims, null);
  assert.ok(findings.some((f) => f.detail === "duplicate capability entry"));
  assert.ok(findings.some((f) => f.detail === "duplicate claim entry"));
});

test("isMeaningfulEvidenceValue rejects cleared deployment values, keeps booleans and zero ids", () => {
  assert.equal(isMeaningfulEvidenceValue(null), false);
  assert.equal(isMeaningfulEvidenceValue(""), false);
  assert.equal(isMeaningfulEvidenceValue("0x0000000000000000000000000000000000000000"), false);
  assert.equal(isMeaningfulEvidenceValue(`0x${"0".repeat(64)}`), false);
  assert.equal(isMeaningfulEvidenceValue(false), true); // e.g. a paused flag reading false
  assert.equal(isMeaningfulEvidenceValue(0), true); // e.g. the root garden's tokenId
  assert.equal(isMeaningfulEvidenceValue("0x6BB5b0fd70b6771B0E955Fef37f8Bd2ce911470a"), true);
});

test("every projection evidence path is covered by the Ontology ci-gate matcher", () => {
  const sidecar = JSON.parse(
    readFileSync(new URL("../../packages/shared/src/ontology/green-goods-ontology.json", import.meta.url), "utf8")
  );
  const claims = JSON.parse(
    readFileSync(new URL("../../packages/shared/src/ontology/marketing-claims.json", import.meta.url), "utf8")
  );
  for (const file of collectProjectionEvidencePaths(sidecar, claims)) {
    assert.ok(
      expectedWorkflowNames([file]).includes("Ontology"),
      `projection evidence is outside the Ontology workflow path filter: ${file}`
    );
  }
});

test("evidence equals pins the resolved value (paused flag flipping fails the gate)", () => {
  const pinned = structuredClone(projOntology);
  // Root package.json "private" is true — expecting true passes, false fails.
  pinned.capabilities[0].dimensions.activation.evidence = [
    { file: "package.json", json_path: "private", equals: true },
  ];
  assert.deepEqual(checkProjections(pinned, projClaims, null).findings, []);
  pinned.capabilities[0].dimensions.activation.evidence = [
    { file: "package.json", json_path: "private", equals: false },
  ];
  const { findings } = checkProjections(pinned, projClaims, null);
  assert.ok(findings.some((f) => f.detail.includes("off-expectation")));
});
