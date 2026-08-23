import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  BASELINE_MAX_DAYS,
  checkProjectionIntegrity,
  checkSidecarIntegrity,
  collectAnchorFiles,
  collectPlannedAnchors,
  collectProjectionFiles,
  compareMembers,
  evalNumericToken,
  extractQuotedConstant,
  normalizeDocText,
  parseCapitalsNote,
  parseCanonicalEntityCounts,
  parseClientGlossaryTerms,
  parseGlossaryAnchors,
  parseGlossaryTable,
  parseGraphqlEnum,
  parseSolidityEnum,
  parseTsInterfaceKeys,
  parseTsNumericEnum,
  parseTsObjectKeys,
  parseTsObjectValues,
  parseTsPropertyUnion,
  parseTsReadonlyArray,
  parseTsStringEnum,
  parseTsUnion,
  reconcileBaseline,
  slugifyHeading,
  parseTermReferenceHeadings,
  splitTableRow,
  sourceContainsSymbol,
  titleCase,
} from "./check-ontology.mjs";
import { expectedWorkflowNames } from "./ci-gate.mjs";
import {
  escapeMdxTableCode,
  renderAgentManifest,
  renderEntityMatrixMdx,
  renderHumanOntologyMdx,
  renderMarketingClaimsMdx,
  renderOntologyMdx,
} from "./ontology-render.mjs";

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

test("parseTsStringEnum reads identity-valued members and rejects renamed values", () => {
  const source = `
export enum FundingState {
  UNKNOWN = "UNKNOWN",
  PLEDGED = "PLEDGED",
}
`;
  assert.deepEqual(parseTsStringEnum(source, "FundingState"), {
    members: ["UNKNOWN", "PLEDGED"],
  });
  assert.deepEqual(parseTsStringEnum('enum Broken { FOO = "bar" }', "Broken"), {
    members: null,
    unparseable: 'FOO = "bar"',
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
    { name: "Garden", surfaces: "admin · client", definition: "A community of gardeners." },
    { name: "Action", surfaces: "admin", definition: "The unit of work template." },
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
    { name: "Garden", surfaces: "admin", definition: "A community of gardeners." },
    { name: "Ghost", surfaces: "admin", definition: "An undeclared row." },
  ]);
});

test("parseCanonicalEntityCounts finds every prose count", () => {
  assert.deepEqual(
    parseCanonicalEntityCounts(
      "Domain entities — 17 canonical concepts.\nThe 17 canonical concepts are below."
    ),
    [17, 17]
  );
});

test("slugifyHeading matches the anchors the docs already link to", () => {
  assert.equal(slugifyHeading("Smart Account (Account Abstraction)"), "smart-account-account-abstraction");
  assert.equal(slugifyHeading("MDR (Media-Details-Review)"), "mdr-media-details-review");
  assert.equal(slugifyHeading("PWA (Progressive Web App)"), "pwa-progressive-web-app");
  assert.equal(slugifyHeading("**Cookie Jar**"), "cookie-jar");
});

test("parseTermReferenceHeadings prefers an explicit anchor over the slug", () => {
  const source = [
    "## Term Reference (Community-Facing Definitions)",
    "",
    "### Garden Operator {#operator}",
    "Trusted coordinators.",
    "",
    "### Work Approval",
    "The review decision.",
  ].join("\n");
  assert.deepEqual(parseTermReferenceHeadings(source), [
    { display: "Garden Operator", anchor: "operator" },
    { display: "Work Approval", anchor: "work-approval" },
  ]);
});

test("parseTermReferenceHeadings returns null when the section is absent", () => {
  assert.equal(parseTermReferenceHeadings("## Personas\n\n### Gardener\n"), null);
});

test("parseGlossaryAnchors collects explicit and slugified anchors at every level", () => {
  const anchors = parseGlossaryAnchors("# Glossary\n## Domain Entities\n### Garden Operator {#operator}\n");
  assert.ok(anchors.has("glossary"));
  assert.ok(anchors.has("domain-entities"));
  assert.ok(anchors.has("operator"));
  assert.ok(!anchors.has("garden-operator"));
});

test("parseClientGlossaryTerms reads ids and docs anchors from the TERMS array", () => {
  const source = [
    "const TERMS: readonly GlossaryTerm[] = [",
    "  {",
    '    id: "cookieJar",',
    '    defaultLabel: "Cookie Jar",',
    '    docsPath: "/glossary#cookie-jar",',
    "  },",
    "  {",
    '    id: "work",',
    '    docsPath: "/glossary#work",',
    "  },",
    "] as const;",
    "",
    'const DOCS_BASE = "https://docs.greengoods.app";',
  ].join("\n");
  assert.deepEqual(parseClientGlossaryTerms(source), [
    { id: "cookieJar", docsPath: "/glossary#cookie-jar" },
    { id: "work", docsPath: "/glossary#work" },
  ]);
});

test("parseClientGlossaryTerms returns null when the array is not found", () => {
  assert.equal(parseClientGlossaryTerms("const OTHER = [];"), null);
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
      semantic_status: "canonical",
      definition: "A community of gardeners.",
      layers: { solidity: ["a.sol"], docs: "g.md" },
      surfaces: ["admin", "client"],
    },
  ],
  personas: [
    {
      id: "gardener",
      display: "Gardener",
      hat: "gardener",
      definition: "Does work.",
      surfaces: ["client"],
    },
  ],
  personas_note: "Owner has no persona.",
  supporting_terms_note: "Glossary-only terms.",
  supporting_terms: [{ id: "outcome", display: "Outcome", reason: "Lives inside an Assessment." }],
  vocabularies: [
    {
      id: "domain",
      source_status: "implemented",
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
      source_status: "specified",
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
      source_status: "implemented",
      source: "schemas.json",
      name: "Work",
      entity: "garden",
      revocable: false,
      resolver: "w.sol",
      fields: [{ name: "actionUID", type: "uint256" }],
    },
  },
  constraints: [
    {
      id: "x",
      kind: "sum",
      source_status: "implemented",
      statement: "Sums to 10000.",
      enforced_at: [{ file: "y.sol", lines: "1-2" }],
      holes: [],
    },
  ],
  state_machines: [
    {
      id: "work-display-status",
      source_status: "implemented",
      kind: "executable",
      vocabulary: "domain",
      states: [{ name: "pending", storage: "protocol" }],
      transitions: [],
    },
    {
      id: "pool",
      source_status: "specified",
      kind: "executable",
      vocabulary: "pool-state",
      spec_source: "spec.md",
      planned_anchor: { file: "pool.sol", symbol: "PoolState" },
      states: [{ name: "Ready", storage: "on-chain" }],
      transitions: [{ from: ["Ready"], to: ["Ready"], layer: "on-chain", mechanism: "markPoolReady | guard" }],
    },
  ],
  integration_matrix: {
    protocols: ["Karma GAP", "Unlock"],
    rows: [{ ref: "entity:garden", label: "Garden", cells: { "Karma GAP": "Project" } }],
  },
  pattern_watches: [],
  known_issues: [{ id: "k", statement: "An issue.", anchors: ["a.sol"] }],
};

const miniProjections = {
  version: 1,
  capabilities: [
    {
      ref: "entity:garden",
      implementation: "implemented",
      deployment: "deployed",
      activation: "active",
      integration: "integrated",
      availability: "available",
      evidence: [{ file: "a.sol", note: "Deployed source." }],
      verified_at: "2026-07-25",
    },
  ],
  human_concepts: [
    {
      ref: "entity:garden",
      plain_name: "A community",
      why_it_matters: "It coordinates work.",
      who_touches_it: ["Gardener"],
      example: "A local garden.",
      aliases: ["community garden"],
      not_confused_with: ["wallet"],
    },
    {
      ref: "persona:gardener",
      plain_name: "A person doing work",
      why_it_matters: "The work starts here.",
      who_touches_it: ["Operator"],
      example: "A person plants a tree.",
      aliases: ["field worker"],
      not_confused_with: ["Operator"],
    },
  ],
  marketing_claims: [
    {
      id: "garden",
      claim: "Gardens coordinate work.",
      audience: ["community"],
      maturity: "available",
      term_refs: ["entity:garden"],
      evidence: [{ file: "a.sol", note: "Deployed source." }],
      safe_wording: "Communities can coordinate work in a Garden.",
      verified_at: "2026-07-25",
    },
  ],
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

test("every projection evidence file is covered by the Ontology ci-gate matcher", () => {
  const projections = JSON.parse(
    readFileSync("packages/shared/src/ontology/green-goods-projections.json", "utf8")
  );
  for (const file of collectProjectionFiles(projections)) {
    assert.ok(
      expectedWorkflowNames([file]).includes("Ontology"),
      `projection evidence is outside the Ontology workflow path filter: ${file}`
    );
  }
});

test("renderers are deterministic", () => {
  assert.equal(
    renderOntologyMdx(miniOntology, miniProjections),
    renderOntologyMdx(miniOntology, miniProjections)
  );
  assert.equal(renderEntityMatrixMdx(miniOntology), renderEntityMatrixMdx(miniOntology));
  assert.equal(renderHumanOntologyMdx(miniOntology, miniProjections), renderHumanOntologyMdx(miniOntology, miniProjections));
  assert.equal(renderMarketingClaimsMdx(miniProjections), renderMarketingClaimsMdx(miniProjections));
  assert.equal(renderAgentManifest(miniOntology, miniProjections), renderAgentManifest(miniOntology, miniProjections));
});

test("ontology renderer omits an empty specified-machines section", () => {
  const implemented = structuredClone(miniOntology);
  implemented.state_machines = implemented.state_machines.map((machine) => ({
    ...machine,
    source_status: "implemented",
    planned_anchor: undefined,
  }));

  const rendered = renderOntologyMdx(implemented, miniProjections);
  assert.equal(rendered.includes("Specified machines without an implemented source"), false);
});

test("matrix renderer emits em-dash for missing cells and escapes pipes in mechanisms", () => {
  const matrix = renderEntityMatrixMdx(miniOntology);
  assert.ok(matrix.includes("| Garden | Project | — |"));
  const reference = renderOntologyMdx(miniOntology, miniProjections);
  assert.ok(reference.includes("markPoolReady \\| guard"));
  assert.ok(matrix.includes("### Entities"));
});

test("integrity rejects undeclared executable transition endpoints and relationship targets", () => {
  const broken = structuredClone(miniOntology);
  broken.entities[0].relationships = [{ to: "missing", kind: "points-to" }];
  broken.state_machines[0].transitions = [
    { from: ["pending"], to: ["missing"], layer: "derived", mechanism: "bad" },
  ];
  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.some((error) => error.includes('undeclared state "missing"')));
  assert.ok(errors.some((error) => error.includes('unknown entity "missing"')));
});

test("specified constraints and state machines require specs and planned anchors", () => {
  const broken = structuredClone(miniOntology);
  broken.constraints[0] = {
    ...broken.constraints[0],
    source_status: "specified",
    enforced_at: [],
  };
  delete broken.state_machines[1].planned_anchor;

  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.includes("constraint x: specified source requires spec_source"));
  assert.ok(errors.includes("constraint x: specified source requires planned_anchor"));
  assert.ok(errors.includes("state machine pool: specified source requires planned_anchor"));
});

test("planned arrival covers vocabularies, constraints, and state machines", () => {
  const ontology = structuredClone(miniOntology);
  ontology.constraints.push({
    id: "planned-constraint",
    kind: "functional",
    source_status: "specified",
    spec_source: "spec.md",
    planned_anchor: { file: "needs.sol", symbol: "NeedsResolver" },
    statement: "Needs stay scoped to their garden.",
    enforced_at: [],
    holes: [],
  });

  assert.deepEqual(collectPlannedAnchors(ontology), [
    {
      kind: "vocabulary",
      id: "pool-state",
      anchor: { file: "b.sol", symbol: "PoolState" },
    },
    {
      kind: "constraint",
      id: "planned-constraint",
      anchor: { file: "needs.sol", symbol: "NeedsResolver" },
    },
    {
      kind: "state machine",
      id: "pool",
      anchor: { file: "pool.sol", symbol: "PoolState" },
    },
  ]);
  assert.equal(sourceContainsSymbol("// NeedsResolver\ncontract Other {}", "NeedsResolver"), false);
  assert.equal(sourceContainsSymbol("contract NeedsResolver {}", "NeedsResolver"), true);
});

test("integrity rejects missing, unknown, and duplicated surfaces", () => {
  const broken = structuredClone(miniOntology);
  broken.entities[0].surfaces = ["admin", "dashboard", "admin"];
  delete broken.personas[0].surfaces;

  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.includes('entity garden: unknown surface "dashboard"'));
  assert.ok(errors.includes('entity garden: duplicate surface "admin"'));
  assert.ok(
    errors.includes("persona gardener: surfaces is required and must list at least one surface")
  );
});

test("integrity rejects display labels that are not canonical members or carry no reason", () => {
  const broken = structuredClone(miniOntology);
  broken.vocabularies[0].canonical.display_labels = { WATER: "Water", SOLAR: "SOLAR" };

  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.includes('vocabulary domain: display_labels key "WATER" is not a canonical member'));
  assert.ok(
    errors.includes('vocabulary domain: display_labels["SOLAR"] repeats the wire name — drop the entry')
  );
  assert.ok(
    errors.includes("vocabulary domain: display_labels requires display_labels_note explaining the divergence")
  );
});

test("integrity accepts a documented display label and rejects an orphan note", () => {
  const labelled = structuredClone(miniOntology);
  labelled.vocabularies[0].canonical.display_labels = { SOLAR: "Solar Infrastructure" };
  labelled.vocabularies[0].canonical.display_labels_note = "Deployed enum keeps the short name.";
  assert.deepEqual(
    checkSidecarIntegrity(labelled, () => true).filter((error) => error.includes("display_labels")),
    []
  );

  const orphan = structuredClone(miniOntology);
  orphan.vocabularies[0].canonical.display_labels_note = "Explains nothing.";
  assert.ok(
    checkSidecarIntegrity(orphan, () => true).includes(
      "vocabulary domain: display_labels_note declared without display_labels"
    )
  );
});

test("integrity rejects an unknown schema entity and an unexplained missing one", () => {
  const broken = structuredClone(miniOntology);
  broken.schemas.work.entity = "nowhere";
  broken.schemas.orphan = {
    source_status: "implemented",
    source: "schemas.json",
    name: "Orphan",
    revocable: false,
    resolver: null,
    fields: [],
  };

  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.includes('schema work: entity "nowhere" is not a canonical entity'));
  assert.ok(
    errors.includes(
      'schema orphan: no entity back-reference — declare "entity" or explain the gap in "note"'
    )
  );
});

test("integrity rejects incomplete and duplicated supporting terms", () => {
  const broken = structuredClone(miniOntology);
  broken.supporting_terms = [
    { id: "outcome", display: "Outcome", reason: "Lives inside an Assessment." },
    { id: "outcome", display: "Outcome", reason: "" },
  ];

  const errors = checkSidecarIntegrity(broken, () => true);
  assert.ok(errors.includes('supporting_terms: duplicate id "outcome"'));
  assert.ok(errors.includes("supporting term outcome: reason is required"));
});

test("projection integrity requires capability and human coverage", () => {
  const broken = structuredClone(miniProjections);
  broken.capabilities = [];
  broken.human_concepts = broken.human_concepts.slice(0, 1);
  const errors = checkProjectionIntegrity(miniOntology, broken, () => true);
  assert.ok(errors.includes("capabilities: missing entity:garden"));
  assert.ok(errors.includes("human concepts: missing persona:gardener"));
});

test("projection integrity rejects unsupported availability", () => {
  const broken = structuredClone(miniProjections);
  broken.capabilities[0].activation = "inactive";
  broken.capabilities[0].integration = "not-integrated";
  const errors = checkProjectionIntegrity(miniOntology, broken, () => true);
  assert.ok(
    errors.includes("capability entity:garden: available requires deployed, active, and integrated")
  );
});

test("projection integrity validates chain-scoped availability and evidence", () => {
  const broken = structuredClone(miniProjections);
  broken.capabilities[0].chains = {
    "42161": {
      deployment: "deployed",
      activation: "inactive",
      integration: "not-integrated",
      availability: "available",
      evidence: [],
      verified_at: "16-08-2026",
    },
  };
  const errors = checkProjectionIntegrity(miniOntology, broken, () => true);
  assert.ok(
    errors.includes(
      "capability entity:garden chain 42161: available requires deployed, active, and integrated"
    )
  );
  assert.ok(errors.includes("capability entity:garden chain 42161: evidence is required"));
  assert.ok(
    errors.includes("capability entity:garden chain 42161: verified_at must be YYYY-MM-DD")
  );
});

test("projection integrity rejects available capabilities without deployment", () => {
  const broken = structuredClone(miniProjections);
  broken.capabilities[0].deployment = "not-deployed";
  broken.capabilities[0].chains = {
    "42161": {
      deployment: "not-deployed",
      activation: "active",
      integration: "integrated",
      availability: "available",
      evidence: [{ file: "chain-readback.json", note: "Hosted read-back." }],
      verified_at: "2026-08-16",
    },
  };
  const errors = checkProjectionIntegrity(miniOntology, broken, () => true);
  assert.ok(
    errors.includes("capability entity:garden: available requires deployed, active, and integrated")
  );
  assert.ok(
    errors.includes(
      "capability entity:garden chain 42161: available requires deployed, active, and integrated"
    )
  );
});

test("projection evidence collection includes chain-scoped records", () => {
  const projections = structuredClone(miniProjections);
  projections.capabilities[0].chains = {
    "42161": {
      deployment: "deployed",
      activation: "active",
      integration: "integrated",
      availability: "available",
      evidence: [{ file: "chain-readback.json", note: "Hosted read-back." }],
      verified_at: "2026-08-16",
    },
  };
  assert.ok(collectProjectionFiles(projections).has("chain-readback.json"));
});
