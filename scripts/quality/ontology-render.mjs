#!/usr/bin/env node
// Pure renderers for the ontology drift gate. No filesystem access here —
// check-ontology.mjs reads the sidecar and writes/compares the artifacts.

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
    .map((a) => (a.lines ? `\`${a.file}:${a.lines}\`` : `\`${a.file}\``))
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
  if (vocabulary.canonical.value_scheme === "explicit") {
    lines.push("");
    lines.push("_Values are explicit (not index-derived) for this vocabulary._");
  }
  if (vocabulary.derived_members?.length) {
    lines.push("");
    lines.push(`**Derived states (never stored):** ${vocabulary.derived_members.join(" · ")}`);
  }
  if (vocabulary.status === "spec" && vocabulary.planned_anchor) {
    lines.push("");
    lines.push(
      `_Spec-only — planned anchor \`${vocabulary.planned_anchor.file}\` · \`${vocabulary.planned_anchor.symbol}\`. The drift gate flags arrival so the status flips to live with declared representations._`
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
      lines.push(`| ${esc(t.from)} | ${esc(t.to)} | ${esc(t.layer)} | ${esc(t.mechanism)} |`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

export function renderOntologyMdx(ontology) {
  const lines = [];
  lines.push("---");
  lines.push("title: Green Goods Ontology");
  lines.push("sidebar_label: Ontology");
  lines.push("slug: /reference/ontology.generated");
  lines.push("unlisted: false");
  lines.push("audience: developer");
  lines.push("owner: docs");
  lines.push(`last_verified: ${ontology.meta.last_verified}`);
  lines.push("feature_status: Live");
  lines.push("source_of_truth:");
  lines.push("  - packages/shared/src/ontology/green-goods-ontology.json");
  lines.push("  - scripts/quality/check-ontology.mjs");
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
  lines.push("| Entity | Status | Definition | Layers |");
  lines.push("|---|---|---|---|");
  for (const entity of ontology.entities) {
    const layers = [];
    if (entity.layers?.solidity?.length) layers.push("contracts");
    if (entity.layers?.indexer) layers.push(`indexer (${entity.layers.indexer.type})`);
    if (entity.layers?.shared?.length) layers.push("shared");
    if (entity.layers?.docs) layers.push("docs");
    if (entity.spec_source) layers.push("spec");
    lines.push(
      `| **${esc(entity.display)}** | ${esc(entity.status)} | ${esc(entity.definition)} | ${esc(layers.join(" · "))} |`
    );
  }
  lines.push("");

  lines.push("## Personas");
  lines.push("");
  lines.push("| Persona | Hat | Definition |");
  lines.push("|---|---|---|");
  for (const persona of ontology.personas) {
    lines.push(`| **${esc(persona.display)}** | ${esc(persona.hat)} | ${esc(persona.definition)} |`);
  }
  lines.push("");
  lines.push(prose(ontology.personas_note));
  lines.push("");

  const liveVocabularies = ontology.vocabularies.filter((v) => v.status === "live");
  const specVocabularies = ontology.vocabularies.filter((v) => v.status === "spec");

  lines.push("## Vocabularies");
  lines.push("");
  lines.push(
    "Each vocabulary has one canonical member list and a declared expected spelling per layer. The drift gate compares every representation against its source file; deviations are either declared here (layer conventions like the indexer's `UNKNOWN` sentinel) or recorded in the burn-down baseline."
  );
  lines.push("");
  for (const vocabulary of liveVocabularies) {
    lines.push(renderVocabulary(vocabulary));
  }

  lines.push("## Commitment Pooling Vocabularies (spec — not deployed)");
  lines.push("");
  lines.push(
    "Locked vocabulary from the commitment-pooling contract spec, encoded ahead of implementation so the August lanes consume one canonical definition. No code cross-checks run until the planned anchors land; the gate then forces each entry to flip to live."
  );
  lines.push("");
  for (const vocabulary of specVocabularies) {
    lines.push(renderVocabulary(vocabulary));
  }

  lines.push("## EAS Schemas");
  lines.push("");
  for (const [key, schema] of Object.entries(ontology.schemas)) {
    lines.push(`### \`${key}\` — ${schema.name}`);
    lines.push("");
    const meta = [
      `status: ${schema.status}`,
      `revocable: ${schema.revocable}`,
      schema.resolver
        ? `resolver: \`${schema.resolver}\``
        : schema.status === "spec" && schema.planned_resolver
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
    lines.push(
      `- **\`${constraint.id}\`** · ${constraint.kind} · ${constraint.status} — ${prose(constraint.statement)} _(enforced at: ${anchorList(constraint.enforced_at)})_`
    );
    for (const hole of constraint.holes) {
      lines.push(`  - ⚠️ Hole: ${prose(hole.statement)} _(${anchorList(hole.anchors)})_`);
    }
  }
  lines.push("");

  lines.push("## State Machines");
  lines.push("");
  for (const machine of ontology.state_machines.filter((m) => m.status === "live")) {
    lines.push(renderStateMachine(machine, 3));
  }
  lines.push("### Commitment pooling (spec — not deployed)");
  lines.push("");
  lines.push(
    'Transcribed from the locked contract spec: "on-chain" means a named module function performs the transition and emits the listed event; "derived" means the indexer/app computes the state from events and the chain never stores it.'
  );
  lines.push("");
  for (const machine of ontology.state_machines.filter((m) => m.status === "spec")) {
    lines.push(renderStateMachine(machine, 4));
  }

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
    "`bun run check:ontology` cross-checks the sidecar against the Solidity enums, the indexer GraphQL schema, the shared TypeScript vocabularies, the EAS schema config, and the glossary tables on every relevant change. Known drift lives in `scripts/data/ontology-drift-baseline.json` with an owner, an expiry, and a note — new drift fails CI immediately, and fixed drift fails until its baseline entry is deleted. To change the ontology, edit the sidecar and run `bun run ontology:generate`."
  );
  lines.push("");

  return lines.join("\n");
}

export function renderEntityMatrixMdx(ontology) {
  const { protocols, rows } = ontology.integration_matrix;
  const lines = [];
  lines.push("---");
  lines.push("sidebar_position: 2");
  lines.push("title: Entity Matrix");
  lines.push("slug: /builders/integrations/entity-matrix");
  lines.push("unlisted: true");
  lines.push("audience: developer");
  lines.push("owner: docs");
  lines.push(`last_verified: ${ontology.meta.last_verified}`);
  lines.push("feature_status: Planned");
  lines.push("source_of_truth:");
  lines.push("  - packages/shared/src/ontology/green-goods-ontology.json");
  lines.push("  - scripts/quality/check-ontology.mjs");
  lines.push("keywords:");
  lines.push("  - entity matrix");
  lines.push("  - protocol mapping");
  lines.push("  - karma gap");
  lines.push("  - hypercerts");
  lines.push("  - hats protocol");
  lines.push("---");
  lines.push("");
  lines.push(
    "<!-- AUTO-GENERATED by scripts/quality/check-ontology.mjs --generate from packages/shared/src/ontology/green-goods-ontology.json (integration_matrix). Do not edit; run `bun run ontology:generate`. -->"
  );
  lines.push("");
  lines.push('import {NextBestAction, StatusBadge} from "@site/src/components/docs";');
  lines.push("");
  lines.push("# Entity Matrix");
  lines.push("");
  lines.push('<StatusBadge status="Planned" />');
  lines.push("");
  lines.push(
    "This matrix is generated from the tracked ontology sidecar (`packages/shared/src/ontology/green-goods-ontology.json`, `integration_matrix` section). Cell mappings remain a draft vocabulary aid until each integration ships — a cell is a naming translation, not a shipped integration contract. The page stays unlisted until that maturity flips."
  );
  lines.push("");
  lines.push("## How to read this table");
  lines.push("");
  lines.push("- **Rows** are Green Goods domain entities (the canonical vocabulary used in code and docs).");
  lines.push("- **Columns** are partner protocols. Each cell shows the equivalent concept in that protocol.");
  lines.push("- **Empty cells** (`—`) mean no mapping exists — the protocol does not have an equivalent concept.");
  lines.push(
    "- **Role entities** (Garden Operator through Data Scientist/Researcher) map to protocol-specific role or permission types."
  );
  lines.push("");
  lines.push("## Full Entity Matrix");
  lines.push("");
  lines.push(`| Green Goods | ${protocols.join(" | ")} |`);
  lines.push(`|${Array(protocols.length + 1).fill("---").join("|")}|`);
  for (const row of rows) {
    const cells = protocols.map((protocol) => (row.cells[protocol] ? esc(row.cells[protocol]) : "—"));
    lines.push(`| ${esc(row.label)} | ${cells.join(" | ")} |`);
  }
  lines.push("");
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
