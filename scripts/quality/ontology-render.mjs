#!/usr/bin/env node
// Pure renderers for the ontology drift gate. No filesystem access here —
// check-ontology.mjs reads the sidecar and writes/compares the artifacts.

import { createHash } from "node:crypto";

import { generatedFrontmatter } from "../docs/generator-core.mjs";

export function escapeMdxTableCode(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("|", "\\|")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("`", "&#96;")
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;");
}

const esc = escapeMdxTableCode;

// Prose slots (definitions, statements, notes) are sidecar-authored free text
// rendered outside table cells: escape only the MDX expression/JSX openers so
// a brace or angle bracket in a statement can never break the docs build.
export function escapeMdxProse(value) {
  return String(value)
    .replaceAll("{", "&#123;")
    .replaceAll("}", "&#125;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

const prose = escapeMdxProse;

function anchorList(anchors) {
  return anchors
    .map((a) => {
      if (a.symbol) return `\`${a.file}#${a.symbol}\``;
      return a.lines ? `\`${a.file}:${a.lines}\`` : `\`${a.file}\``;
    })
    .join(", ");
}

function membersWithValues(vocabulary) {
  const { canonical } = vocabulary;
  if (canonical.value_scheme === "none") return canonical.members.join(" · ");
  return canonical.members
    .map((name, index) => {
      const value = canonical.value_scheme === "index" ? index : undefined;
      return value === undefined ? name : `${name} (${value})`;
    })
    .join(" · ");
}

function renderVocabulary(vocabulary) {
  const lines = [];
  lines.push(`### \`${vocabulary.id}\``);
  lines.push("");
  if (vocabulary.id === "signal-pool-type" || vocabulary.id === "commitment-pool-type") {
    lines.push(":::warning Name collision");
    lines.push(
      "Solidity carries two unrelated `PoolType` enums: the live Gardens V2 signal-pool vocabulary (`signal-pool-type`, ActionSignal/HypercertSignal) and the commitment-pooling anchor vocabulary (`commitment-pool-type`, Garden/Protocol). They are separate vocabularies in this ontology — never merge or cross-map them."
    );
    lines.push(":::");
    lines.push("");
  }
  lines.push(prose(vocabulary.definition));
  lines.push("");
  lines.push(`**Canonical members:** ${membersWithValues(vocabulary)}`);
  if (vocabulary.canonical.display_labels) {
    const labels = Object.entries(vocabulary.canonical.display_labels)
      .map(([member, label]) => `\`${member}\` reads as **${label}**`)
      .join(" · ");
    lines.push("");
    lines.push(`**Display labels:** ${labels}`);
    lines.push("");
    lines.push(prose(vocabulary.canonical.display_labels_note));
  }
  if (vocabulary.canonical.value_scheme === "explicit") {
    lines.push("");
    lines.push("_Values are explicit (not index-derived) for this vocabulary._");
  }
  if (vocabulary.derived_members?.length) {
    lines.push("");
    lines.push(`**Derived states (never stored):** ${vocabulary.derived_members.join(" · ")}`);
  }
  if (vocabulary.source_status === "specified" && vocabulary.planned_anchor) {
    lines.push("");
    lines.push(
      `_Specified source — planned anchor \`${vocabulary.planned_anchor.file}\` · \`${vocabulary.planned_anchor.symbol}\`. The drift gate flags arrival so the source status becomes implemented with declared representations._`
    );
  }
  if (vocabulary.representations.length > 0) {
    lines.push("");
    lines.push("| Representation | Layer | Source | Expected members | Note |");
    lines.push("|---|---|---|---|---|");
    for (const rep of vocabulary.representations) {
      const source = `${rep.file} · ${rep.symbol}${rep.property ? `.${rep.property}` : ""}`;
      const members = rep.values
        ? rep.members.map((m, i) => `${m}=${rep.values[i]}`).join(", ")
        : rep.members.join(", ");
      lines.push(
        `| ${esc(rep.id)} | ${esc(rep.layer)} | <code>${esc(source)}</code> | <code>${esc(members)}</code> | ${esc(rep.note ?? "")} |`
      );
    }
  }
  for (const mapping of vocabulary.mappings ?? []) {
    lines.push("");
    const pairs = mapping.pairs
      ? Object.entries(mapping.pairs)
          .map(([from, to]) => `${from} → ${to}`)
          .join(", ")
      : "identity (same spelling on both sides)";
    const qualifiers = [
      mapping.kind,
      mapping.total_from ? "total" : "partial",
      mapping.bijective ? "bijective" : null,
      mapping.unmapped_to?.length ? `unmapped on the right: ${mapping.unmapped_to.join(", ")}` : null,
      mapping.unmapped_from?.length ? `unmapped on the left: ${mapping.unmapped_from.join(", ")}` : null,
    ]
      .filter(Boolean)
      .join("; ");
    lines.push(`- **Mapping \`${mapping.id}\`** (${mapping.from} → ${mapping.to}; ${qualifiers}): ${pairs}.`);
    if (mapping.code_anchor) {
      lines.push(`  - Code anchor: \`${mapping.code_anchor}\``);
    } else {
      lines.push("  - Code anchor: none — no runtime mapping function exists yet.");
    }
    if (mapping.note) lines.push(`  - ${prose(mapping.note)}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderStateMachine(machine, headingLevel) {
  const h = "#".repeat(headingLevel);
  const lines = [];
  lines.push(`${h} \`${machine.id}\``);
  lines.push("");
  if (machine.note) {
    lines.push(prose(machine.note));
    lines.push("");
  }
  if (machine.source_status === "specified" && machine.planned_anchor) {
    lines.push(
      `_Specified in \`${machine.spec_source}\`; the gate watches \`${machine.planned_anchor.file}#${machine.planned_anchor.symbol}\` for implementation arrival._`
    );
    lines.push("");
  } else if (machine.enforced_at?.length) {
    lines.push(`_Implementation evidence: ${anchorList(machine.enforced_at)}._`);
    lines.push("");
  }
  lines.push("| State | Storage |");
  lines.push("|---|---|");
  for (const state of machine.states) {
    lines.push(`| ${esc(state.name)} | ${esc(state.storage)} |`);
  }
  if (machine.transitions.length > 0) {
    lines.push("");
    lines.push("| From | To | Layer | Mechanism |");
    lines.push("|---|---|---|---|");
    for (const t of machine.transitions) {
      lines.push(
        `| ${esc(t.from.join(" · "))} | ${esc(t.to.join(" · "))} | ${esc(t.layer)} | ${esc(t.mechanism)} |`
      );
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function renderOntologyMdx(ontology, projections) {
  const capabilityByRef = new Map(
    projections.capabilities.map((capability) => [capability.ref, capability])
  );
  const lines = [];
  lines.push("---");
  lines.push("title: Green Goods Ontology");
  lines.push("sidebar_label: Ontology");
  lines.push("slug: /reference/ontology");
  lines.push("audience: developer");
  lines.push("owner: docs");
  lines.push("feature_status: Live");
  lines.push("generated: true");
  lines.push("generator: scripts/quality/check-ontology.mjs");
  lines.push("generated_from:");
  lines.push("  - packages/shared/src/ontology/green-goods-ontology.json");
  lines.push("  - packages/shared/src/ontology/green-goods-projections.json");
  lines.push(
    `source_digest: "${semanticSourceDigest([
      ["packages/shared/src/ontology/green-goods-ontology.json", ontology],
      ["packages/shared/src/ontology/green-goods-projections.json", projections],
    ])}"`,
  );
  lines.push("source_of_truth:");
  lines.push("  - packages/shared/src/ontology/green-goods-ontology.json");
  lines.push("  - packages/shared/src/ontology/green-goods-projections.json");
  lines.push("keywords:");
  lines.push("  - ontology");
  lines.push("  - vocabulary");
  lines.push("  - entities");
  lines.push("  - schemas");
  lines.push("  - state machines");
  lines.push("---");
  lines.push("");
  lines.push(
    "<!-- AUTO-GENERATED by scripts/quality/check-ontology.mjs --generate from packages/shared/src/ontology/green-goods-ontology.json. Do not edit; run `bun run ontology:generate`. -->"
  );
  lines.push("");
  lines.push("# Green Goods Ontology");
  lines.push("");
  lines.push(
    "The formal specification of the Green Goods shared vocabulary: the entities the protocol tracks, the controlled vocabularies each layer spells its own way, the EAS schemas, the constraints the contracts enforce, and the lifecycle state machines. The source of truth is the machine-readable sidecar `packages/shared/src/ontology/green-goods-ontology.json`; this page is generated from it and CI fails when either drifts from the code."
  );
  lines.push("");

  lines.push("## Entities");
  lines.push("");
  lines.push("| Entity | Semantic status | Availability | Capability | Surfaces | Definition | Layers |");
  lines.push("|---|---|---|---|---|---|---|");
  for (const entity of ontology.entities) {
    const capability = capabilityByRef.get(`entity:${entity.id}`);
    const layers = [];
    if (entity.layers?.solidity?.length) layers.push("contracts");
    if (entity.layers?.indexer) layers.push(`indexer (${entity.layers.indexer.type})`);
    if (entity.layers?.shared?.length) layers.push("shared");
    if (entity.layers?.docs) layers.push("docs");
    if (entity.spec_source) layers.push("spec");
    lines.push(
      `| **${esc(entity.display)}** | ${esc(entity.semantic_status)} | ${esc(capability.availability)} | ${esc(`${capability.implementation} · ${capability.deployment} · ${capability.activation} · ${capability.integration}`)} | ${esc(entity.surfaces.join(" · "))} | ${esc(entity.definition)} | ${esc(layers.join(" · "))} |`
    );
  }
  lines.push("");

  lines.push("## Personas");
  lines.push("");
  lines.push("| Persona | Hat | Surfaces | Definition |");
  lines.push("|---|---|---|---|");
  for (const persona of ontology.personas) {
    lines.push(
      `| **${esc(persona.display)}** | ${esc(persona.hat)} | ${esc(persona.surfaces.join(" · "))} | ${esc(persona.definition)} |`
    );
  }
  lines.push("");
  lines.push(prose(ontology.personas_note));
  lines.push("");

  lines.push("## Supporting terms");
  lines.push("");
  lines.push(prose(ontology.supporting_terms_note));
  lines.push("");
  lines.push("| Term | Why it is not an entity |");
  lines.push("|---|---|");
  for (const term of ontology.supporting_terms) {
    lines.push(`| **${esc(term.display)}** | ${esc(term.reason)} |`);
  }
  lines.push("");

  const implementedVocabularies = ontology.vocabularies.filter(
    (v) => v.source_status === "implemented"
  );
  const specifiedVocabularies = ontology.vocabularies.filter(
    (v) => v.source_status === "specified"
  );

  lines.push("## Vocabularies");
  lines.push("");
  lines.push(
    "Each vocabulary has one canonical member list and a declared expected spelling per layer. The drift gate compares every representation against its source file; deviations are either declared here (layer conventions like the indexer's `UNKNOWN` sentinel) or recorded in the burn-down baseline."
  );
  lines.push("");
  for (const vocabulary of implementedVocabularies) {
    lines.push(renderVocabulary(vocabulary));
  }

  lines.push("## Specified vocabularies without an implemented source");
  lines.push("");
  lines.push(
    "These vocabularies are canonical specifications whose declared implementation anchor has not arrived. The gate watches each anchor and requires the source status and representations to be updated when it lands."
  );
  lines.push("");
  for (const vocabulary of specifiedVocabularies) {
    lines.push(renderVocabulary(vocabulary));
  }

  lines.push("## EAS Schemas");
  lines.push("");
  for (const [key, schema] of Object.entries(ontology.schemas)) {
    lines.push(`### \`${key}\` — ${schema.name}`);
    lines.push("");
    const meta = [
      `source: ${schema.source_status}`,
      `revocable: ${schema.revocable}`,
      schema.resolver
        ? `resolver: \`${schema.resolver}\``
        : schema.source_status === "specified" && schema.planned_resolver
          ? `planned resolver: \`${schema.planned_resolver}\``
          : "resolver: none",
    ].join(" · ");
    lines.push(meta);
    lines.push("");
    if (schema.note) {
      lines.push(prose(schema.note));
      lines.push("");
    }
    lines.push("| Field | Type |");
    lines.push("|---|---|");
    for (const field of schema.fields) {
      lines.push(`| ${esc(field.name)} | <code>${esc(field.type)}</code> |`);
    }
    lines.push("");
  }

  lines.push("## Constraints");
  lines.push("");
  lines.push(
    "Cross-layer invariants and where they are enforced. This catalog is documentation-grade: the drift gate verifies the anchors exist, not the semantics — the contracts and their tests own the semantics."
  );
  lines.push("");
  for (const constraint of ontology.constraints) {
    const evidence =
      constraint.source_status === "specified" && constraint.planned_anchor
        ? `specified in \`${constraint.spec_source}\`; watches \`${constraint.planned_anchor.file}#${constraint.planned_anchor.symbol}\``
        : `enforced at: ${anchorList(constraint.enforced_at)}`;
    lines.push(
      `- **\`${constraint.id}\`** · ${constraint.kind} · ${constraint.source_status} — ${prose(constraint.statement)} _(${evidence})_`
    );
    for (const hole of constraint.holes) {
      lines.push(`  - ⚠️ Hole: ${prose(hole.statement)} _(${anchorList(hole.anchors)})_`);
    }
  }
  lines.push("");

  lines.push("## State Machines");
  lines.push("");
  for (const machine of ontology.state_machines.filter((m) => m.source_status === "implemented")) {
    lines.push(renderStateMachine(machine, 3));
  }
  const specifiedMachines = ontology.state_machines.filter((m) => m.source_status === "specified");
  if (specifiedMachines.length > 0) {
    lines.push("### Specified machines without an implemented source");
    lines.push("");
    lines.push(
      '"On-chain" means a named function performs the transition; "derived" means a reader computes it. These machines remain specified until their declared runtime source arrives.'
    );
    lines.push("");
    for (const machine of specifiedMachines) {
      lines.push(renderStateMachine(machine, 4));
    }
  }

  lines.push("## Agent query seam");
  lines.push("");
  lines.push(
    "Agents and application code should use the compact read-only query API exported by `@green-goods/shared`. It resolves canonical ids, typed refs, display names, and declared aliases without importing the full semantic sidecar."
  );
  lines.push("");
  lines.push("```ts");
  lines.push("import {");
  lines.push("  getOntologyMaturity,");
  lines.push("  getOntologyRelationships,");
  lines.push("  getOntologySafeClaims,");
  lines.push("  getOntologyTerm,");
  lines.push("} from \"@green-goods/shared\";");
  lines.push("");
  lines.push('const term = getOntologyTerm("Commitment");');
  lines.push('const maturity = getOntologyMaturity("entity:commitment");');
  lines.push('const relationships = getOntologyRelationships("Commitment");');
  lines.push('const claims = getOntologySafeClaims("Commitment");');
  lines.push("```");
  lines.push("");
  lines.push(
    "Use `maturity.availability` and the returned evidence before making a release claim. A canonical term can still be planned or deployed without being available to users."
  );
  lines.push("");

  lines.push("## Known Issues");
  lines.push("");
  for (const issue of ontology.known_issues) {
    lines.push(`- **\`${issue.id}\`** — ${prose(issue.statement)} _(${issue.anchors.map((a) => `\`${a}\``).join(", ")})_`);
  }
  lines.push("");

  if (ontology.meta.excluded_from_v1.length > 0) {
    lines.push("## Deliberately excluded from v1");
    lines.push("");
    for (const exclusion of ontology.meta.excluded_from_v1) {
      lines.push(`- ${prose(exclusion)}`);
    }
    lines.push("");
  }

  lines.push("## How this page stays honest");
  lines.push("");
  lines.push(
    "`bun run check:ontology` cross-checks declared representations, evidence paths, stable implementation symbols, state-machine structure, Solidity and GraphQL enums, shared TypeScript vocabularies, EAS schemas, and glossary tables. Constraint prose and transition behavior remain test-owned rather than inferred by this gate. Known drift stays bidirectional in `scripts/data/ontology-drift-baseline.json`. To change the ontology, edit its semantic or projection source and run `bun run ontology:generate`."
  );
  lines.push("");

  return lines.join("\n");
}

export function renderEntityMatrixMdx(
  ontology,
  {
    sources = [
      "packages/shared/src/ontology/green-goods-ontology.json",
      "scripts/quality/check-ontology.mjs",
      "scripts/quality/ontology-render.mjs",
    ],
    digest = "sha256:unavailable",
  } = {}
) {
  const { protocols, rows } = ontology.integration_matrix;
  const lines = [];
  lines.push(
    generatedFrontmatter({
      title: "Entity Matrix",
      slug: "/builders/integrations/entity-matrix",
      featureStatus: "Planned",
      sources,
      digest,
      extra: ["sidebar_position: 2"],
    }).trimEnd()
  );
  lines.push("");
  lines.push('import {NextBestAction, StatusBadge} from "@site/src/components/docs";');
  lines.push("");
  lines.push("# Entity Matrix");
  lines.push("");
  lines.push('<StatusBadge status="Planned" />');
  lines.push("");
  lines.push(
    "This matrix is generated from the tracked ontology sidecar (`packages/shared/src/ontology/green-goods-ontology.json`, `integration_matrix` section). Cell mappings remain a draft vocabulary aid until each integration ships — a cell is a naming translation, not a shipped integration contract. The planned status keeps that maturity visible without hiding the reference from navigation or the sitemap."
  );
  lines.push("");
  lines.push("## How to read this table");
  lines.push("");
  lines.push("- **Rows** are grouped as entities, schemas, personas, or integration-facing concepts.");
  lines.push("- **Columns** are partner protocols. Each cell shows the equivalent concept in that protocol.");
  lines.push("- **Empty cells** (`—`) mean no mapping exists — the protocol does not have an equivalent concept.");
  lines.push(
    "- **Role entities** (Garden Operator through Data Scientist/Researcher) map to protocol-specific role or permission types."
  );
  lines.push("");
  lines.push("## Integration Matrix");
  lines.push("");
  for (const [kind, heading] of [
    ["entity", "Entities"],
    ["schema", "Schemas"],
    ["persona", "Personas"],
    ["concept", "Integration-facing concepts"],
  ]) {
    const groupedRows = rows.filter((row) => row.ref.startsWith(`${kind}:`));
    if (groupedRows.length === 0) continue;
    lines.push(`### ${heading}`);
    lines.push("");
    lines.push(`| Green Goods | ${protocols.join(" | ")} |`);
    lines.push(`|${Array(protocols.length + 1).fill("---").join("|")}|`);
    for (const row of groupedRows) {
      const cells = protocols.map((protocol) =>
        row.cells[protocol] ? esc(row.cells[protocol]) : "—"
      );
      lines.push(`| ${esc(row.label)} | ${cells.join(" | ")} |`);
    }
    lines.push("");
  }
  lines.push("## Protocol integration notes");
  lines.push("");
  lines.push("### Active integrations");
  lines.push("");
  lines.push("These protocols have draft entity mappings and active or planned code integrations:");
  lines.push("");
  lines.push(
    "- **Karma GAP**: Project reporting and milestone tracking. Maps all 5 core entities (Garden through Work Approval) and all role types."
  );
  lines.push(
    "- **Hypercerts**: Impact certification tokens. Maps core entities to Hypercert Data and roles to Creator/Funder/Evaluator."
  );
  lines.push(
    "- **Octant**: Vault and treasury management. Maps Garden to Vault Owner, with role mappings for admin, proposer, voter, and depositor flows."
  );
  lines.push(
    "- **Gardens V2**: Community governance primitives. Maps Garden to Community, with role mappings for council and community membership."
  );
  lines.push(
    "- **Hats Protocol**: On-chain role management. Maps all 6 role types to protocol-specific hat levels (Top Hat, Operator Hat, Gardener Hat, Community Member, Garden Supporter, Garden Analyst)."
  );
  lines.push("- **Silvi**: Forestry and agroforestry partner. Currently maps only Garden to Project.");
  lines.push("- **Cookie Jar**: Payout and reward primitive. Currently maps only Garden to Jar.");
  lines.push("- **Unlock**: Credential and badge primitive. Currently maps only Badges to Unlock NFT.");
  lines.push("");
  lines.push("### Integration planned");
  lines.push("");
  lines.push("These protocols appear in the matrix but have no entity mappings yet:");
  lines.push("");
  lines.push("- **ENS**: Ethereum Name Service — name resolution integration planned.");
  lines.push("- **Lido**: Liquid staking — yield integration planned.");
  lines.push("- **FTC**: Integration scope to be defined.");
  lines.push("");
  lines.push("## Using the matrix");
  lines.push("");
  lines.push("### For developers");
  lines.push("");
  lines.push(
    "When implementing a new protocol integration, consult this matrix to understand which Green Goods entities have equivalents in the target protocol. This prevents naming confusion and ensures API boundaries align with established mappings."
  );
  lines.push("");
  lines.push("### For agents");
  lines.push("");
  lines.push(
    'When a task involves a partner protocol, use this matrix to translate between vocabularies. For example, if a Karma GAP issue references "Project Milestones", map that to Green Goods Assessments.'
  );
  lines.push("");
  lines.push("### Maintenance");
  lines.push("");
  lines.push(
    "The mapping data lives in the ontology sidecar's `integration_matrix` section. When a new protocol partnership is established, add a column only after its source-backed implementation or specification exists — edit the sidecar and run `bun run ontology:generate`. `bun run check:ontology` fails CI whenever this page drifts from the sidecar."
  );
  lines.push("");
  lines.push("<NextBestAction");
  lines.push('  title="Next best action"');
  lines.push('  why="See the full integrations overview with surface-level status for each protocol connection."');
  lines.push('  actionLabel="Integrations overview"');
  lines.push('  actionHref="./overview"');
  lines.push("  alternatives={[");
  lines.push('    {label: "EAS integration", href: "./eas"},');
  lines.push("  ]}");
  lines.push("/>");
  lines.push("");

  return lines.join("\n");
}

function renderEvidenceList(evidence) {
  return evidence.map((item) => `\`${esc(item.file)}\` — ${prose(item.note)}`).join("<br />");
}

export function renderMarketingClaimsMdx(projections) {
  const lines = [
    "---",
    "title: What Green Goods Can Honestly Claim",
    "sidebar_label: Capability & Claims",
    "slug: /community/green-goods-claims",
    "audience: all",
    "owner: docs",
    "feature_status: Live",
    "generated: true",
    "generator: scripts/quality/check-ontology.mjs",
    "generated_from:",
    "  - packages/shared/src/ontology/green-goods-projections.json",
    `source_digest: "${semanticSourceDigest([
      ["packages/shared/src/ontology/green-goods-projections.json", projections],
    ])}"`,
    "source_of_truth:",
    "  - packages/shared/src/ontology/green-goods-projections.json",
    "---",
    "",
    "<!-- AUTO-GENERATED by bun run ontology:generate. Do not edit directly. -->",
    "",
    "# What Green Goods Can Honestly Claim",
    "",
    "This ledger separates what people can use now from deployed protocol capability, work in progress, plans, and longer-term vision. Marketing and partnership language should reuse the safe wording below.",
    "",
  ];
  for (const maturity of ["available", "deployed-not-available", "in-build", "planned", "vision"]) {
    const claims = projections.marketing_claims.filter((claim) => claim.maturity === maturity);
    if (!claims.length) continue;
    lines.push(`## ${maturity}`);
    lines.push("");
    for (const claim of claims) {
      lines.push(`### ${prose(claim.safe_wording)}`);
      lines.push("");
      lines.push(`**Internal claim:** ${prose(claim.claim)}`);
      lines.push("");
      lines.push(`**Audience:** ${claim.audience.map(prose).join(" · ")}`);
      lines.push("");
      lines.push(`**Evidence:** ${renderEvidenceList(claim.evidence)} (verified ${claim.verified_at})`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

export function renderAgentManifest(ontology, projections) {
  const capabilityByRef = new Map(projections.capabilities.map((item) => [item.ref, item]));
  const humanByRef = new Map(projections.human_concepts.map((item) => [item.ref, item]));
  const claimsByRef = new Map();
  for (const claim of projections.marketing_claims) {
    for (const ref of claim.term_refs) {
      if (!claimsByRef.has(ref)) claimsByRef.set(ref, []);
      claimsByRef.get(ref).push({
        id: claim.id,
        maturity: claim.maturity,
        safe_wording: claim.safe_wording,
        verified_at: claim.verified_at,
      });
    }
  }
  const terms = [];
  for (const entity of ontology.entities) {
    const ref = `entity:${entity.id}`;
    terms.push({
      ref,
      id: entity.id,
      kind: "entity",
      canonical: entity.display,
      definition: entity.definition,
      semantic_status: entity.semantic_status,
      surfaces: entity.surfaces,
      aliases: humanByRef.get(ref)?.aliases ?? [],
      relationships: entity.relationships ?? [],
      maturity: capabilityByRef.get(ref),
      safe_claims: claimsByRef.get(ref) ?? [],
    });
  }
  for (const persona of ontology.personas) {
    const ref = `persona:${persona.id}`;
    terms.push({
      ref,
      id: persona.id,
      kind: "persona",
      canonical: persona.display,
      definition: persona.definition,
      semantic_status: "canonical",
      surfaces: persona.surfaces,
      aliases: humanByRef.get(ref)?.aliases ?? [],
      relationships: [],
      maturity: null,
      safe_claims: claimsByRef.get(ref) ?? [],
    });
  }
  const pretty = JSON.stringify({ version: 1, verified_at: ontology.meta.last_verified, terms }, null, 2);
  const lines = pretty.split("\n");
  const compact = [];
  for (let index = 0; index < lines.length; index += 1) {
    const opening = /^(\s*)("[^"]+": )\[$/.exec(lines[index]);
    if (!opening) {
      compact.push(lines[index]);
      continue;
    }
    const values = [];
    let cursor = index + 1;
    while (/^\s+"(?:[^"\\]|\\.)*",?$/.test(lines[cursor] ?? "")) {
      values.push(lines[cursor].trim().replace(/,$/, ""));
      cursor += 1;
    }
    const closing = /^(\s*)\](,?)$/.exec(lines[cursor] ?? "");
    const candidate = `${opening[1]}${opening[2]}[${values.join(", ")}]${closing?.[2] ?? ""}`;
    if (values.length > 0 && closing && candidate.length <= 100) {
      compact.push(candidate);
      index = cursor;
    } else {
      compact.push(lines[index]);
    }
  }
  return `${compact.join("\n")}\n`;
}
function semanticSourceDigest(sources) {
  const hash = createHash("sha256");
  for (const [label, value] of sources) {
    hash.update(`${label}\n${JSON.stringify(value)}\n`);
  }
  return `sha256:${hash.digest("hex")}`;
}
