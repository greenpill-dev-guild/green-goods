#!/usr/bin/env node
// Ontology drift gate: cross-checks packages/shared/src/ontology/green-goods-ontology.json
// against Solidity enums, the indexer GraphQL schema, shared TypeScript vocabularies,
// the EAS schema config, projection evidence, and generated glossary; regenerates three artifacts
// with --generate. Zero dependencies beyond the Node standard library on purpose —
// the CI workflow runs it without installing anything, and the ci-gate matcher relies
// on that by excluding package.json/bun.lock from its path filter.
//
// Exit codes: 0 = clean; 1 = drift (unlisted finding, stale baseline entry, spec
// arrival, stale generated artifact); 2 = infrastructure (missing/unparseable
// sidecar, baseline, or anchor).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  renderAgentManifest,
  renderMarketingClaimsMdx,
  renderOntologyMdx,
} from "./ontology-render.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../..");

const SIDECAR_PATH = "packages/shared/src/ontology/green-goods-ontology.json";
const PROJECTIONS_PATH = "packages/shared/src/ontology/green-goods-projections.json";
const AGENT_MANIFEST_PATH = "packages/shared/src/ontology/agent-manifest.generated.json";
const BASELINE_PATH = "scripts/data/ontology-drift-baseline.json";
const SCHEMAS_JSON_PATH = "packages/contracts/config/schemas.json";
const QA_CATALOG_PATH = "scripts/data/qa-test-catalog.json";
const GLOSSARY_PATH = "docs/docs/reference/glossary.generated.mdx";
const GENERATED_REFERENCE_PATH = "docs/docs/reference/ontology.generated.mdx";
const GENERATED_CLAIMS_PATH = "docs/docs/community/green-goods-claims.generated.mdx";
const CLIENT_GLOSSARY_PATH = "packages/client/src/views/Public/Glossary.tsx";

// Product surfaces a term may appear on. `community` is carried verbatim from the
// glossary pending the community-surface-token known issue.
export const ONTOLOGY_SURFACES = ["admin", "client", "agent", "community", "public", "docs"];

export const BASELINE_MAX_DAYS = 250;
export const BASELINE_WARN_DAYS = 30;

// ---------------------------------------------------------------------------
// Pure text extractors (unit-tested in check-ontology.test.mjs)
// ---------------------------------------------------------------------------

export function stripLineComments(text, marker) {
  return text
    .split("\n")
    .map((line) => {
      const index = line.indexOf(marker);
      return index === -1 ? line : line.slice(0, index);
    })
    .join("\n");
}

export function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, "");
}

export function evalNumericToken(token) {
  const trimmed = token.trim();
  const shift = /^(\d+)\s*<<\s*(\d+)$/.exec(trimmed);
  if (shift) return Number(shift[1]) << Number(shift[2]);
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  return null;
}

// Comments are stripped from the WHOLE source before any declaration regex
// runs: a commented-out legacy declaration must never win the non-greedy
// match, and a `;` inside a trailing comment must never terminate a union
// capture early. Vocabulary declarations never contain string literals with
// comment markers, so whole-source stripping is safe for these extractors.
function stripCode(source) {
  return stripLineComments(stripBlockComments(source), "//");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sourceContainsSymbol(source, symbol) {
  return new RegExp(`(?<![\\w$])${escapeRegExp(symbol)}(?![\\w$])`).test(stripCode(source));
}

export function parseSolidityEnum(source, symbol) {
  const match = new RegExp(`enum\\s+${symbol}\\s*\\{([\\s\\S]*?)\\}`).exec(stripCode(source));
  if (!match) return null;
  return match[1]
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseGraphqlEnum(source, symbol) {
  const match = new RegExp(`enum\\s+${symbol}\\s*\\{([\\s\\S]*?)\\}`).exec(stripLineComments(source, "#"));
  if (!match) return null;
  return match[1]
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function parseTsNumericEnum(source, symbol) {
  const match = new RegExp(`enum ${symbol}\\s*\\{([\\s\\S]*?)\\}`).exec(stripCode(source));
  if (!match) return null;
  const body = match[1];
  const members = [];
  const values = [];
  let nextImplicit = 0;
  for (const raw of body.split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const eq = entry.indexOf("=");
    if (eq === -1) {
      members.push(entry);
      values.push(nextImplicit);
      nextImplicit += 1;
      continue;
    }
    const name = entry.slice(0, eq).trim();
    const value = evalNumericToken(entry.slice(eq + 1));
    if (value === null) return { members: null, values: null, unparseable: entry };
    members.push(name);
    values.push(value);
    nextImplicit = value + 1;
  }
  return { members, values };
}

export function parseTsStringEnum(source, symbol) {
  const match = new RegExp(`enum ${symbol}\\s*\\{([\\s\\S]*?)\\}`).exec(stripCode(source));
  if (!match) return null;
  const members = [];
  for (const raw of match[1].split(",")) {
    const entry = raw.trim();
    if (!entry) continue;
    const parsed = /^([A-Za-z_$][\w$]*)\s*=\s*["']([^"']+)["']$/.exec(entry);
    if (!parsed) return { members: null, unparseable: entry };
    if (parsed[1] !== parsed[2]) return { members: null, unparseable: entry };
    members.push(parsed[1]);
  }
  return { members };
}

export function parseTsUnion(source, symbol) {
  const match = new RegExp(`type ${symbol}\\s*=([\\s\\S]*?);`).exec(stripCode(source));
  if (!match) return null;
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

export function parseTsInterfaceKeys(source, symbol) {
  const match = new RegExp(`interface ${symbol}\\s*(?:extends [^{]+)?\\{([\\s\\S]*?)\\n\\}`).exec(stripCode(source));
  if (!match) return null;
  const keys = [];
  for (const line of match[1].split("\n")) {
    const key = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)\s*\??:/.exec(line);
    if (key) keys.push(key[1]);
  }
  return keys;
}

function extractObjectBody(source, symbol) {
  const match = new RegExp(`const ${symbol}[^={]*=\\s*\\{([\\s\\S]*?)\\}`).exec(stripCode(source));
  return match ? match[1] : null;
}

export function parseTsObjectKeys(source, symbol) {
  const body = extractObjectBody(source, symbol);
  if (body === null) return null;
  const keys = [];
  const values = [];
  let allNumeric = true;
  for (const entryMatch of body.matchAll(/(?:^|\n)\s*(?:\[?["']?)([\w$]+)(?:["']?\]?)\s*:\s*([^,\n]+)/g)) {
    keys.push(entryMatch[1]);
    const value = evalNumericToken(entryMatch[2].trim().replace(/,$/, ""));
    if (value === null) allNumeric = false;
    values.push(value);
  }
  return { keys, values: allNumeric ? values : null };
}

export function parseTsObjectValues(source, symbol) {
  const body = extractObjectBody(source, symbol);
  if (body === null) return null;
  return [...body.matchAll(/:\s*["']([^"']*)["']/g)].map((m) => m[1]);
}

export function parseTsReadonlyArray(source, symbol) {
  const match = new RegExp(`const ${symbol}[^=]*=\\s*\\[([\\s\\S]*?)\\]`).exec(stripCode(source));
  if (!match) return null;
  return [...match[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

export function extractQuotedConstant(source, symbol) {
  const match = new RegExp(`${symbol}\\s*=\\s*"([^"]*)"`).exec(stripCode(source));
  return match ? match[1] : null;
}

export function parseTsPropertyUnion(source, container, property) {
  const match = new RegExp(`interface ${container}\\s*(?:extends [^{]+)?\\{([\\s\\S]*?)\\n\\}`).exec(stripCode(source));
  if (!match) return null;
  // Line-anchored so `substatus:` can never satisfy a lookup for `status`.
  const propertyMatch = new RegExp(`(?:^|\\n)\\s*(?:readonly\\s+)?${property}\\s*\\??:\\s*([^;]+);`).exec(match[1]);
  if (!propertyMatch) return null;
  return [...propertyMatch[1].matchAll(/["']([^"']+)["']/g)].map((m) => m[1]);
}

// ---------------------------------------------------------------------------
// Docs (glossary) parsers
// ---------------------------------------------------------------------------

export function normalizeDocText(text) {
  return text
    .replaceAll("**", "")
    .replaceAll("*", "")
    .replaceAll("`", "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function splitTableRow(line) {
  // Split on unescaped pipes only, then unescape \| back to a literal pipe.
  return line.split(/(?<!\\)\|/).map((cell) => cell.trim().replaceAll("\\|", "|"));
}

export function parseGlossaryTable(source, sectionHeading) {
  const headingMatch = new RegExp(`^## ${sectionHeading}\\s*$`, "m").exec(source);
  if (!headingMatch) return null;
  const rest = source.slice(headingMatch.index);
  const nextHeading = /\n## (?!#)/.exec(rest.slice(1));
  const sectionEnd = nextHeading ? nextHeading.index + 1 : -1;
  const section = sectionEnd === -1 ? rest : rest.slice(0, sectionEnd);
  const rows = [];
  for (const line of section.split("\n")) {
    // Every data row counts — an unbolded row must surface as drift, not vanish.
    if (!line.startsWith("|")) continue;
    const cells = splitTableRow(line);
    // cells[0] is the empty string before the leading pipe.
    if (cells.length < 5) continue;
    const name = normalizeDocText(cells[1]);
    if (!name || name === "Term" || /^-+$/.test(name)) continue;
    rows.push({ name, surfaces: normalizeDocText(cells.at(-3)), definition: cells.at(-2) });
  }
  return rows;
}

/**
 * Docusaurus heading slug: lowercase, punctuation dropped, runs of anything else
 * collapsed to a single dash. Matches the anchors already linked from the docs
 * (`#smart-account-account-abstraction`, `#mdr-media-details-review`).
 */
export function slugifyHeading(text) {
  return normalizeDocText(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The hand-written Term Reference section: every `### Term` heading with its
 * effective anchor (an explicit `{#id}` wins over the slugified heading).
 */
export function parseTermReferenceHeadings(source) {
  const headingMatch = /^## Term Reference[^\n]*$/m.exec(source);
  if (!headingMatch) return null;
  const rest = source.slice(headingMatch.index);
  const nextHeading = /\n## (?!#)/.exec(rest.slice(1));
  const sectionEnd = nextHeading ? nextHeading.index + 1 : -1;
  const section = sectionEnd === -1 ? rest : rest.slice(0, sectionEnd);
  const out = [];
  for (const line of section.split("\n")) {
    const match = /^### (.+?)\s*$/.exec(line);
    if (!match) continue;
    const explicit = /\{#([A-Za-z0-9_-]+)\}\s*$/.exec(match[1]);
    const display = normalizeDocText(match[1].replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, ""));
    out.push({ display, anchor: explicit ? explicit[1] : slugifyHeading(display) });
  }
  return out;
}

/** Every heading anchor the glossary exposes, at any level — the docs' public API. */
export function parseGlossaryAnchors(source) {
  const anchors = new Set();
  for (const line of source.split("\n")) {
    const match = /^#{1,6} (.+?)\s*$/.exec(line);
    if (!match) continue;
    const explicit = /\{#([A-Za-z0-9_-]+)\}\s*$/.exec(match[1]);
    anchors.add(
      explicit ? explicit[1] : slugifyHeading(match[1].replace(/\s*\{#[A-Za-z0-9_-]+\}\s*$/, ""))
    );
  }
  for (const match of source.matchAll(/<a\s+id=["']([A-Za-z0-9_-]+)["']\s*><\/a>/g)) {
    anchors.add(match[1]);
  }
  return anchors;
}

/** The client's own editorial term list: id plus the docs anchor it deep-links to. */
export function parseClientGlossaryTerms(source) {
  const arrayMatch = /const TERMS: readonly GlossaryTerm\[\] = \[([\s\S]*?)\n\] as const;/.exec(source);
  if (!arrayMatch) return null;
  const out = [];
  for (const block of arrayMatch[1].split(/\n\s*\{/)) {
    const id = /\bid:\s*"([^"]+)"/.exec(block);
    const docsPath = /\bdocsPath:\s*"([^"]+)"/.exec(block);
    if (!id || !docsPath) continue;
    out.push({ id: id[1], docsPath: docsPath[1] });
  }
  return out;
}

export function parseCanonicalEntityCounts(source) {
  return [...source.matchAll(/\b(\d+) canonical concepts\b/g)].map((match) => Number(match[1]));
}

export function parseCapitalsNote(source) {
  const match = /canonical machine ordering is the `Capital` enum: ([^\n]+)/.exec(source);
  if (!match) return null;
  return [...match[1].matchAll(/([A-Za-z]+) \((\d+)\)/g)].map((m) => ({
    name: m[1],
    value: Number(m[2]),
  }));
}

export function titleCase(screaming) {
  return screaming.charAt(0).toUpperCase() + screaming.slice(1).toLowerCase();
}

// ---------------------------------------------------------------------------
// Comparison + baseline reconciliation (pure)
// ---------------------------------------------------------------------------

export function compareMembers(expected, actual, options = {}) {
  const diffs = [];
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((m) => !actualSet.has(m));
  const extra = actual.filter((m) => !expectedSet.has(m));
  if (missing.length) diffs.push(`missing [${missing.join(", ")}]`);
  if (extra.length) diffs.push(`unexpected [${extra.join(", ")}]`);
  const duplicates = actual.filter((m, i) => actual.indexOf(m) !== i);
  if (duplicates.length) diffs.push(`duplicate members [${[...new Set(duplicates)].join(", ")}]`);
  if (!missing.length && !extra.length && options.ordered) {
    // NUL-joined comparison: members like "Cookie Jar" contain spaces, so a
    // space join would let ["X", "X X"] vs ["X X", "X"] concatenate identically
    // and mask an order difference.
    if (expected.join("\u0000") !== actual.join("\u0000")) {
      diffs.push(`order expected [${expected.join(", ")}] found [${actual.join(", ")}]`);
    }
  }
  if (options.expectedValues) {
    if (!options.actualValues) {
      // Declared values MUST be verifiable — a single computed entry must not
      // silently switch off ordinal checking for the whole declaration.
      diffs.push("values declared in the sidecar but not statically extractable from the source");
    } else {
      const expectedByName = new Map(expected.map((name, i) => [name, options.expectedValues[i]]));
      for (let i = 0; i < actual.length; i += 1) {
        const name = actual[i];
        if (!expectedByName.has(name)) continue;
        const want = expectedByName.get(name);
        const got = options.actualValues[i];
        if (want !== got) diffs.push(`value ${name} expected ${want} found ${got}`);
      }
    }
  }
  return diffs;
}

export function reconcileBaseline(findings, baseline, today) {
  const errors = [];
  const warnings = [];
  const entries = baseline.entries ?? [];

  const seenIds = new Set();
  const seenSubjects = new Set();
  for (const entry of entries) {
    if (seenIds.has(entry.id)) errors.push(`baseline: duplicate entry id "${entry.id}"`);
    seenIds.add(entry.id);
    // Two entries sharing guard+subject would shadow each other in the
    // reconciliation maps (last one wins; the first is never detail-checked
    // and never reported stale) — reject the shape outright.
    const subjectKey = `${entry.guard}\n${entry.subject}`;
    if (seenSubjects.has(subjectKey)) {
      errors.push(`baseline: duplicate guard+subject "${entry.guard} ${entry.subject}" (entry ${entry.id})`);
    }
    seenSubjects.add(subjectKey);
    if (!entry.owner) errors.push(`baseline ${entry.id}: missing owner`);
    if (!entry.note || entry.note.length < 12) {
      errors.push(`baseline ${entry.id}: note must be at least 12 characters`);
    }
    const expires = new Date(`${entry.expires}T00:00:00Z`);
    if (Number.isNaN(expires.getTime())) {
      errors.push(`baseline ${entry.id}: invalid expires date "${entry.expires}"`);
      continue;
    }
    const days = Math.floor((expires.getTime() - today.getTime()) / 86_400_000);
    if (days < 0) errors.push(`baseline ${entry.id}: expired on ${entry.expires} — fix the drift or consciously renew`);
    else if (days > BASELINE_MAX_DAYS) {
      errors.push(`baseline ${entry.id}: expires more than ${BASELINE_MAX_DAYS} days out (${entry.expires})`);
    } else if (days <= BASELINE_WARN_DAYS) {
      warnings.push(`baseline ${entry.id}: expires in ${days} day(s) (${entry.expires})`);
    }
  }

  // NUL separator: guard and subject values can never contain it.
  const keyOf = (item) => `${item.guard}\u0000${item.subject}`;
  const entriesByKey = new Map(entries.map((entry) => [keyOf(entry), entry]));
  const findingsByKey = new Map(findings.map((finding) => [keyOf(finding), finding]));

  let matched = 0;
  for (const finding of findings) {
    const entry = entriesByKey.get(keyOf(finding));
    if (!entry) {
      errors.push(
        `unlisted drift — [${finding.guard}] ${finding.subject} @ ${finding.file}: ${finding.detail} — fix it or add a baseline entry with owner/expires/note`
      );
      continue;
    }
    if (entry.detail !== finding.detail) {
      errors.push(
        `baseline ${entry.id}: detail changed (drift on top of drift) — baseline has "${entry.detail}" but the checker found "${finding.detail}"`
      );
      continue;
    }
    matched += 1;
  }
  for (const entry of entries) {
    if (!findingsByKey.has(keyOf(entry))) {
      errors.push(`stale baseline entry ${entry.id} (${entry.guard} ${entry.subject}): the drift is fixed — delete the entry`);
    }
  }
  return { errors, warnings, matched };
}

// ---------------------------------------------------------------------------
// Guard runner (filesystem-aware)
// ---------------------------------------------------------------------------

function readRepoFile(relPath, fatal) {
  const abs = path.join(REPO_ROOT, relPath);
  if (!existsSync(abs)) {
    fatal.push(`missing file: ${relPath}`);
    return null;
  }
  return readFileSync(abs, "utf8");
}

export function collectAnchorFiles(ontology) {
  const files = new Set();
  for (const integration of ontology.integrations ?? []) {
    files.add(integration.contract_source);
    for (const file of integration.additional_sources ?? []) files.add(file);
  }
  for (const entity of ontology.entities) {
    for (const file of entity.layers?.solidity ?? []) files.add(file);
    if (entity.layers?.indexer) files.add(entity.layers.indexer.file);
    for (const file of entity.layers?.shared ?? []) files.add(file);
    if (entity.layers?.docs) files.add(entity.layers.docs);
    if (entity.spec_source) files.add(entity.spec_source);
  }
  for (const vocabulary of ontology.vocabularies) {
    if (vocabulary.spec_source) files.add(vocabulary.spec_source);
    for (const rep of vocabulary.representations) files.add(rep.file);
    for (const mapping of vocabulary.mappings ?? []) {
      if (mapping.code_anchor) files.add(mapping.code_anchor);
    }
  }
  for (const schema of Object.values(ontology.schemas)) {
    if (schema.source) files.add(schema.source);
    if (schema.spec_source) files.add(schema.spec_source);
    if (schema.resolver) files.add(schema.resolver);
  }
  for (const constraint of ontology.constraints) {
    if (constraint.spec_source) files.add(constraint.spec_source);
    for (const anchor of constraint.enforced_at) files.add(anchor.file);
    for (const hole of constraint.holes) for (const anchor of hole.anchors) files.add(anchor.file);
  }
  for (const machine of ontology.state_machines) {
    if (machine.spec_source) files.add(machine.spec_source);
    for (const anchor of machine.enforced_at ?? []) files.add(anchor.file);
  }
  for (const watch of ontology.pattern_watches) files.add(watch.file);
  for (const issue of ontology.known_issues) for (const anchor of issue.anchors) files.add(anchor);
  return files;
}

export function collectPlannedAnchors(ontology) {
  const entries = [];
  for (const vocabulary of ontology.vocabularies) {
    if (vocabulary.source_status === "specified" && vocabulary.planned_anchor) {
      entries.push({ kind: "vocabulary", id: vocabulary.id, anchor: vocabulary.planned_anchor });
    }
  }
  for (const constraint of ontology.constraints) {
    if (constraint.source_status === "specified" && constraint.planned_anchor) {
      entries.push({ kind: "constraint", id: constraint.id, anchor: constraint.planned_anchor });
    }
  }
  for (const machine of ontology.state_machines) {
    if (machine.source_status === "specified" && machine.planned_anchor) {
      entries.push({ kind: "state machine", id: machine.id, anchor: machine.planned_anchor });
    }
  }
  return entries;
}

export function collectProjectionFiles(projections) {
  const files = new Set();
  for (const capability of projections.capabilities ?? []) {
    for (const evidence of capability.evidence ?? []) files.add(evidence.file);
    for (const chain of Object.values(capability.chains ?? {})) {
      for (const evidence of chain.evidence ?? []) files.add(evidence.file);
    }
  }
  for (const claim of projections.marketing_claims ?? []) {
    for (const evidence of claim.evidence ?? []) files.add(evidence.file);
  }
  return files;
}

export function checkProjectionIntegrity(ontology, projections, fileExists) {
  const errors = [];
  const entityRefs = new Set(ontology.entities.map((entity) => `entity:${entity.id}`));
  const personaRefs = new Set(ontology.personas.map((persona) => `persona:${persona.id}`));
  const termRefs = new Set([...entityRefs, ...personaRefs]);
  const availability = new Set([
    "available",
    "deployed-not-available",
    "in-build",
    "planned",
    "vision",
  ]);
  const capabilityAxes = {
    implementation: new Set(["implemented", "partial", "not-implemented", "not-applicable"]),
    deployment: new Set(["deployed", "not-deployed", "not-applicable"]),
    activation: new Set(["active", "inactive", "not-applicable"]),
    integration: new Set(["integrated", "partial", "not-integrated", "not-applicable"]),
  };
  const unique = (label, values) => {
    const seen = new Set();
    for (const value of values) {
      if (seen.has(value)) errors.push(`${label}: duplicate "${value}"`);
      seen.add(value);
    }
  };

  unique("capabilities", projections.capabilities.map((item) => item.ref));
  unique("human concepts", projections.human_concepts.map((item) => item.ref));
  unique("marketing claims", projections.marketing_claims.map((item) => item.id));

  const capabilityRefs = new Set(projections.capabilities.map((item) => item.ref));
  const capabilityByRef = new Map(projections.capabilities.map((item) => [item.ref, item]));
  for (const ref of entityRefs) {
    if (!capabilityRefs.has(ref)) errors.push(`capabilities: missing ${ref}`);
  }
  for (const capability of projections.capabilities) {
    if (!entityRefs.has(capability.ref)) errors.push(`capability ${capability.ref}: unknown entity`);
    if (!availability.has(capability.availability)) {
      errors.push(`capability ${capability.ref}: invalid availability "${capability.availability}"`);
    }
    for (const [axis, allowed] of Object.entries(capabilityAxes)) {
      if (!allowed.has(capability[axis])) {
        errors.push(`capability ${capability.ref}: invalid ${axis} "${capability[axis]}"`);
      }
    }
    if (
      capability.availability === "available" &&
      (capability.deployment !== "deployed" ||
        capability.activation !== "active" ||
        capability.integration !== "integrated")
    ) {
      errors.push(`capability ${capability.ref}: available requires deployed, active, and integrated`);
    }
    if (capability.availability === "deployed-not-available" && capability.deployment !== "deployed") {
      errors.push(`capability ${capability.ref}: deployed-not-available requires deployed`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(capability.verified_at)) {
      errors.push(`capability ${capability.ref}: verified_at must be YYYY-MM-DD`);
    }
    if (!capability.evidence?.length) errors.push(`capability ${capability.ref}: evidence is required`);

    for (const [chainId, chain] of Object.entries(capability.chains ?? {})) {
      const label = `capability ${capability.ref} chain ${chainId}`;
      if (!/^\d+$/.test(chainId) || Number(chainId) <= 0) {
        errors.push(`${label}: chain id must be a positive integer`);
      }
      if (!availability.has(chain.availability)) {
        errors.push(`${label}: invalid availability "${chain.availability}"`);
      }
      for (const axis of ["deployment", "activation", "integration"]) {
        if (!capabilityAxes[axis].has(chain[axis])) {
          errors.push(`${label}: invalid ${axis} "${chain[axis]}"`);
        }
      }
      if (
        chain.availability === "available" &&
        (chain.deployment !== "deployed" ||
          chain.activation !== "active" ||
          chain.integration !== "integrated")
      ) {
        errors.push(`${label}: available requires deployed, active, and integrated`);
      }
      if (chain.availability === "deployed-not-available" && chain.deployment !== "deployed") {
        errors.push(`${label}: deployed-not-available requires deployed`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(chain.verified_at)) {
        errors.push(`${label}: verified_at must be YYYY-MM-DD`);
      }
      if (!chain.evidence?.length) errors.push(`${label}: evidence is required`);
    }
  }

  const humanRefs = new Set(projections.human_concepts.map((item) => item.ref));
  for (const ref of termRefs) {
    if (!humanRefs.has(ref)) errors.push(`human concepts: missing ${ref}`);
  }
  const aliasOwner = new Map();
  for (const concept of projections.human_concepts) {
    if (!termRefs.has(concept.ref)) errors.push(`human concept ${concept.ref}: unknown term`);
    for (const field of ["plain_name", "why_it_matters", "example"]) {
      if (!concept[field]?.trim()) errors.push(`human concept ${concept.ref}: ${field} is required`);
    }
    for (const alias of concept.aliases ?? []) {
      const key = alias.toLowerCase();
      const previous = aliasOwner.get(key);
      if (previous && previous !== concept.ref) {
        errors.push(`human concept alias "${alias}" is ambiguous between ${previous} and ${concept.ref}`);
      }
      aliasOwner.set(key, concept.ref);
    }
  }

  for (const claim of projections.marketing_claims) {
    if (!availability.has(claim.maturity)) {
      errors.push(`marketing claim ${claim.id}: invalid maturity "${claim.maturity}"`);
    }
    if (!claim.safe_wording?.trim()) errors.push(`marketing claim ${claim.id}: safe_wording is required`);
    if (!claim.evidence?.length) errors.push(`marketing claim ${claim.id}: evidence is required`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(claim.verified_at)) {
      errors.push(`marketing claim ${claim.id}: verified_at must be YYYY-MM-DD`);
    }
    for (const ref of claim.term_refs ?? []) {
      if (!termRefs.has(ref)) errors.push(`marketing claim ${claim.id}: unknown term ${ref}`);
      const capability = capabilityByRef.get(ref);
      if (claim.maturity === "available" && capability && capability.availability !== "available") {
        errors.push(
          `marketing claim ${claim.id}: available claim references ${ref} at ${capability.availability}`
        );
      }
    }
  }

  for (const file of collectProjectionFiles(projections)) {
    if (!fileExists(file)) errors.push(`projection evidence does not exist: ${file}`);
  }
  return errors;
}

export function checkQaCatalogRoles(ontology, catalog) {
  const errors = [];
  const allowed = new Set(["any", "none", ...ontology.personas.map((persona) => persona.id)]);
  for (const qaCase of catalog.cases ?? []) {
    if (!allowed.has(qaCase.role)) {
      errors.push(
        `QA case ${qaCase.id}: role "${qaCase.role}" is not an ontology persona or the any/none sentinel`
      );
    }
  }
  return errors;
}

export function checkSidecarIntegrity(ontology, fileExists) {
  const errors = [];
  const validSymbol = (symbol) => typeof symbol === "string" && /^[A-Za-z_$][\w$]*$/.test(symbol);
  const uniq = (label, ids) => {
    const seen = new Set();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${label}: duplicate id "${id}"`);
      seen.add(id);
    }
  };
  uniq("entities", ontology.entities.map((e) => e.id));
  uniq("personas", ontology.personas.map((p) => p.id));
  uniq("vocabularies", ontology.vocabularies.map((v) => v.id));
  uniq("constraints", ontology.constraints.map((c) => c.id));
  uniq("state_machines", ontology.state_machines.map((m) => m.id));
  uniq("pattern_watches", ontology.pattern_watches.map((w) => w.id));
  uniq("known_issues", ontology.known_issues.map((i) => i.id));
  uniq("supporting_terms", ontology.supporting_terms.map((t) => t.id));
  uniq("integrations", (ontology.integrations ?? []).map((integration) => integration.id));
  uniq("integration_matrix rows", ontology.integration_matrix.rows.map((r) => r.ref));

  const vocabularyIds = new Set(ontology.vocabularies.map((v) => v.id));
  const entityIds = new Set(ontology.entities.map((e) => e.id));
  const personaIds = new Set(ontology.personas.map((p) => p.id));
  const schemaKeys = new Set(Object.keys(ontology.schemas));

  const roleVocabulary = ontology.vocabularies.find((v) => v.id === "garden-role");
  const hatIds = new Set(
    roleVocabulary?.representations.find((r) => r.id === "shared-ids")?.members ?? []
  );
  for (const persona of ontology.personas) {
    if (!hatIds.has(persona.hat)) errors.push(`persona ${persona.id}: hat "${persona.hat}" is not a garden-role member`);
  }

  // Surfaces: where a term may legitimately appear. The glossary column is the
  // human mirror; this makes the same fact readable by agents through the manifest.
  const surfaceSet = new Set(ONTOLOGY_SURFACES);
  const checkSurfaces = (label, term) => {
    if (!Array.isArray(term.surfaces) || term.surfaces.length === 0) {
      errors.push(`${label}: surfaces is required and must list at least one surface`);
      return;
    }
    const seen = new Set();
    for (const surface of term.surfaces) {
      if (!surfaceSet.has(surface)) errors.push(`${label}: unknown surface "${surface}"`);
      if (seen.has(surface)) errors.push(`${label}: duplicate surface "${surface}"`);
      seen.add(surface);
    }
  };
  for (const entity of ontology.entities) checkSurfaces(`entity ${entity.id}`, entity);
  for (const persona of ontology.personas) checkSurfaces(`persona ${persona.id}`, persona);

  for (const term of ontology.supporting_terms) {
    for (const field of ["id", "display", "reason"]) {
      if (!term[field]?.trim()) errors.push(`supporting term ${term.id ?? "?"}: ${field} is required`);
    }
  }

  for (const integration of ontology.integrations ?? []) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(integration.id ?? "")) {
      errors.push(`integration ${integration.id ?? "?"}: id must be kebab-case`);
    }
    for (const field of ["display", "definition", "contract_source"]) {
      if (typeof integration[field] !== "string" || integration[field].trim() === "") {
        errors.push(`integration ${integration.id ?? "?"}: ${field} is required`);
      }
    }
    if (!Array.isArray(integration.deployment_fields) || integration.deployment_fields.length === 0) {
      errors.push(`integration ${integration.id ?? "?"}: deployment_fields must not be empty`);
    } else if (new Set(integration.deployment_fields).size !== integration.deployment_fields.length) {
      errors.push(`integration ${integration.id}: deployment_fields contains duplicates`);
    }
    for (const key of ["indexer_contracts", "additional_sources"]) {
      if (!Array.isArray(integration[key])) {
        errors.push(`integration ${integration.id ?? "?"}: ${key} must be an array`);
      } else if (new Set(integration[key]).size !== integration[key].length) {
        errors.push(`integration ${integration.id}: ${key} contains duplicates`);
      }
    }
    for (const source of [integration.contract_source, ...(integration.additional_sources ?? [])]) {
      if (typeof source === "string" && source && !fileExists(source)) {
        errors.push(`integration ${integration.id}: source does not exist: ${source}`);
      }
    }
  }

  for (const vocabulary of ontology.vocabularies) {
    if (vocabulary.canonical.members.length === 0) errors.push(`vocabulary ${vocabulary.id}: empty canonical member list`);
    // Display labels are the wire-vs-human seam: a member whose deployed name is not
    // the name people read. Every key must be a real member, and the divergence must
    // carry its reason so the split never degrades back into folklore.
    const displayLabels = vocabulary.canonical.display_labels;
    if (displayLabels !== undefined) {
      const memberSet = new Set(vocabulary.canonical.members);
      const entries = Object.entries(displayLabels);
      if (entries.length === 0) {
        errors.push(`vocabulary ${vocabulary.id}: display_labels must not be empty when declared`);
      }
      for (const [member, label] of entries) {
        if (!memberSet.has(member)) {
          errors.push(`vocabulary ${vocabulary.id}: display_labels key "${member}" is not a canonical member`);
        }
        if (typeof label !== "string" || label.trim() === "") {
          errors.push(`vocabulary ${vocabulary.id}: display_labels["${member}"] must be a non-empty string`);
        } else if (label === member) {
          errors.push(`vocabulary ${vocabulary.id}: display_labels["${member}"] repeats the wire name — drop the entry`);
        }
      }
      if (!vocabulary.canonical.display_labels_note?.trim()) {
        errors.push(`vocabulary ${vocabulary.id}: display_labels requires display_labels_note explaining the divergence`);
      }
    } else if (vocabulary.canonical.display_labels_note !== undefined) {
      errors.push(`vocabulary ${vocabulary.id}: display_labels_note declared without display_labels`);
    }
    if (vocabulary.source_status === "specified") {
      if (!vocabulary.spec_source) errors.push(`vocabulary ${vocabulary.id}: specified source requires spec_source`);
      if (vocabulary.representations.length > 0) {
        errors.push(`vocabulary ${vocabulary.id}: specified source must not declare implemented representations`);
      }
      if (!vocabulary.planned_anchor) errors.push(`vocabulary ${vocabulary.id}: specified source requires planned_anchor`);
      else if (!fileExists(path.dirname(vocabulary.planned_anchor.file))) {
        errors.push(
          `vocabulary ${vocabulary.id}: planned_anchor directory does not exist: ${path.dirname(vocabulary.planned_anchor.file)}`
        );
      }
      if (vocabulary.planned_anchor && !validSymbol(vocabulary.planned_anchor.symbol)) {
        errors.push(`vocabulary ${vocabulary.id}: planned_anchor requires an identifier symbol`);
      }
    }
    const repIds = new Set();
    for (const rep of vocabulary.representations) {
      if (repIds.has(rep.id)) errors.push(`vocabulary ${vocabulary.id}: duplicate representation id "${rep.id}"`);
      repIds.add(rep.id);
      if (rep.extract === "ts-property-union" && !rep.property) {
        errors.push(`vocabulary ${vocabulary.id}/rep ${rep.id}: ts-property-union requires "property"`);
      }
      if (rep.values && rep.values.length !== rep.members.length) {
        errors.push(`vocabulary ${vocabulary.id}/rep ${rep.id}: values length must match members length`);
      }
    }
    for (const mapping of vocabulary.mappings ?? []) {
      const from = vocabulary.representations.find((r) => r.id === mapping.from);
      const to = vocabulary.representations.find((r) => r.id === mapping.to);
      if (!from) errors.push(`vocabulary ${vocabulary.id}/mapping ${mapping.id}: unknown "from" rep ${mapping.from}`);
      if (!to) errors.push(`vocabulary ${vocabulary.id}/mapping ${mapping.id}: unknown "to" rep ${mapping.to}`);
    }
  }

  // Schemas name the entity they record, so the schema layer and the entity layer
  // are linked rather than sitting side by side. A schema with no entity must say why.
  for (const [key, schema] of Object.entries(ontology.schemas)) {
    if (schema.entity === undefined) {
      if (!schema.note?.trim()) {
        errors.push(`schema ${key}: no entity back-reference — declare "entity" or explain the gap in "note"`);
      }
      continue;
    }
    if (!entityIds.has(schema.entity)) {
      errors.push(`schema ${key}: entity "${schema.entity}" is not a canonical entity`);
    }
  }

  for (const constraint of ontology.constraints) {
    if (constraint.source_status === "specified") {
      if (!constraint.spec_source) {
        errors.push(`constraint ${constraint.id}: specified source requires spec_source`);
      }
      if (!constraint.planned_anchor) {
        errors.push(`constraint ${constraint.id}: specified source requires planned_anchor`);
      } else if (!validSymbol(constraint.planned_anchor.symbol)) {
        errors.push(`constraint ${constraint.id}: planned_anchor requires an identifier symbol`);
      }
      if (constraint.enforced_at.length > 0) {
        errors.push(`constraint ${constraint.id}: specified source must not declare implementation anchors`);
      }
    } else if (constraint.planned_anchor) {
      errors.push(`constraint ${constraint.id}: implemented source must not retain planned_anchor`);
    }
  }

  for (const machine of ontology.state_machines) {
    if (!vocabularyIds.has(machine.vocabulary)) {
      errors.push(`state machine ${machine.id}: unknown vocabulary "${machine.vocabulary}"`);
    }
    const stateNames = machine.states.map((state) => state.name);
    const stateSet = new Set(stateNames);
    if (stateSet.size !== stateNames.length) errors.push(`state machine ${machine.id}: duplicate state name`);
    if (machine.kind === "executable") {
      for (const [index, transition] of machine.transitions.entries()) {
        if (!Array.isArray(transition.from) || transition.from.length === 0) {
          errors.push(`state machine ${machine.id}/transition ${index}: from must contain atomic states`);
        }
        if (!Array.isArray(transition.to) || transition.to.length === 0) {
          errors.push(`state machine ${machine.id}/transition ${index}: to must contain atomic states`);
        }
        for (const endpoint of [...(transition.from ?? []), ...(transition.to ?? [])]) {
          if (!stateSet.has(endpoint)) {
            errors.push(`state machine ${machine.id}/transition ${index}: undeclared state "${endpoint}"`);
          }
        }
      }
    }
    if (machine.source_status === "specified") {
      if (!machine.spec_source) {
        errors.push(`state machine ${machine.id}: specified source requires spec_source`);
      }
      if (!machine.planned_anchor) {
        errors.push(`state machine ${machine.id}: specified source requires planned_anchor`);
      } else if (!validSymbol(machine.planned_anchor.symbol)) {
        errors.push(`state machine ${machine.id}: planned_anchor requires an identifier symbol`);
      }
      if ((machine.enforced_at ?? []).length > 0) {
        errors.push(`state machine ${machine.id}: specified source must not declare implementation anchors`);
      }
    } else if (machine.planned_anchor) {
      errors.push(`state machine ${machine.id}: implemented source must not retain planned_anchor`);
    }
  }

  for (const [kind, records] of [
    ["constraint", ontology.constraints],
    ["state machine", ontology.state_machines],
  ]) {
    for (const record of records) {
      for (const anchor of record.enforced_at ?? []) {
        if (anchor.symbol && !validSymbol(anchor.symbol)) {
          errors.push(`${kind} ${record.id}: anchor for ${anchor.file} has an invalid symbol`);
        }
      }
    }
  }

  for (const entity of ontology.entities) {
    for (const relationship of entity.relationships ?? []) {
      if (!entityIds.has(relationship.to)) {
        errors.push(`entity ${entity.id}: relationship targets unknown entity "${relationship.to}"`);
      }
    }
  }

  for (const [key, schema] of Object.entries(ontology.schemas)) {
    if (schema.check === "existence-only" && !schema.source_symbol) {
      errors.push(`schema ${key}: existence-only check requires source_symbol`);
    }
  }

  for (const row of ontology.integration_matrix.rows) {
    const [kind, id] = row.ref.split(":");
    if (kind === "entity" && !entityIds.has(id)) errors.push(`matrix row ${row.ref}: unknown entity`);
    if (kind === "persona" && !personaIds.has(id)) errors.push(`matrix row ${row.ref}: unknown persona`);
    if (kind === "schema" && !schemaKeys.has(id)) errors.push(`matrix row ${row.ref}: unknown schema`);
    if (!["entity", "persona", "schema", "concept"].includes(kind)) {
      errors.push(`matrix row ${row.ref}: ref kind must be entity/persona/schema/concept`);
    }
    for (const protocol of Object.keys(row.cells)) {
      if (!ontology.integration_matrix.protocols.includes(protocol)) {
        errors.push(`matrix row ${row.ref}: cell for undeclared protocol "${protocol}"`);
      }
    }
  }

  for (const watch of ontology.pattern_watches) {
    if (!["absent", "present"].includes(watch.expect)) errors.push(`watch ${watch.id}: invalid expect`);
    try {
      new RegExp(watch.pattern);
    } catch {
      errors.push(`watch ${watch.id}: invalid regex ${watch.pattern}`);
    }
  }

  for (const file of collectAnchorFiles(ontology)) {
    if (!fileExists(file)) errors.push(`anchor file does not exist: ${file}`);
  }

  return errors;
}

function runGuards(ontology, projections) {
  // Aliases are the third way a glossary heading can resolve: `Impact Certificate`
  // is Hypercert, `Work Submission` is Work, `Garden Operator` is the Operator persona.
  const projectionAliases = (projections.human_concepts ?? []).flatMap((concept) =>
    (concept.aliases ?? []).map((alias) => ({ alias, ref: concept.ref }))
  );
  const fatal = [];
  const errors = [];
  const findings = [];
  const counts = {};
  const sources = new Map();
  const sourceOf = (relPath) => {
    if (!sources.has(relPath)) sources.set(relPath, readRepoFile(relPath, fatal));
    return sources.get(relPath);
  };

  // G1-G3: vocabulary representations against their files.
  let solidityCount = 0;
  let graphqlCount = 0;
  let sharedCount = 0;
  for (const vocabulary of ontology.vocabularies) {
    for (const rep of vocabulary.representations) {
      const source = sourceOf(rep.file);
      if (source === null) continue;
      let actual = null;
      let actualValues = null;
      if (rep.extract === "solidity-enum") {
        actual = parseSolidityEnum(source, rep.symbol);
        solidityCount += 1;
      } else if (rep.extract === "graphql-enum") {
        actual = parseGraphqlEnum(source, rep.symbol);
        graphqlCount += 1;
      } else {
        sharedCount += 1;
        if (rep.extract === "ts-numeric-enum") {
          const parsed = parseTsNumericEnum(source, rep.symbol);
          if (parsed?.unparseable) {
            fatal.push(`unparseable enum entry "${parsed.unparseable}" for ${rep.symbol} in ${rep.file}`);
            continue;
          }
          actual = parsed?.members ?? null;
          actualValues = parsed?.values ?? null;
        } else if (rep.extract === "ts-string-enum") {
          const parsed = parseTsStringEnum(source, rep.symbol);
          if (parsed?.unparseable) {
            fatal.push(`unparseable string enum entry "${parsed.unparseable}" for ${rep.symbol} in ${rep.file}`);
            continue;
          }
          actual = parsed?.members ?? null;
        } else if (rep.extract === "ts-union") actual = parseTsUnion(source, rep.symbol);
        else if (rep.extract === "ts-interface-keys") actual = parseTsInterfaceKeys(source, rep.symbol);
        else if (rep.extract === "ts-object-keys") {
          const parsed = parseTsObjectKeys(source, rep.symbol);
          actual = parsed?.keys ?? null;
          actualValues = parsed?.values ?? null;
        } else if (rep.extract === "ts-object-values") actual = parseTsObjectValues(source, rep.symbol);
        else if (rep.extract === "ts-readonly-array") actual = parseTsReadonlyArray(source, rep.symbol);
        else if (rep.extract === "ts-property-union") {
          actual = parseTsPropertyUnion(source, rep.symbol, rep.property);
        } else {
          fatal.push(`vocabulary ${vocabulary.id}/rep ${rep.id}: unsupported extract "${rep.extract}"`);
          continue;
        }
      }
      if (actual === null) {
        fatal.push(`could not locate ${rep.symbol}${rep.property ? `.${rep.property}` : ""} in ${rep.file} (${rep.extract})`);
        continue;
      }
      const diffs = compareMembers(rep.members, actual, {
        ordered: rep.ordered,
        expectedValues: rep.values,
        actualValues,
      });
      if (diffs.length > 0) {
        const guard =
          rep.extract === "solidity-enum" ? "solidity-enums" : rep.extract === "graphql-enum" ? "graphql-enums" : "shared-ts-vocab";
        findings.push({
          guard,
          subject: `vocab:${vocabulary.id}/rep:${rep.id}`,
          file: rep.file,
          detail: diffs.join("; "),
          message: `${rep.symbol} deviates from the declared representation`,
        });
      }
    }
  }
  counts["solidity-enums"] = solidityCount;
  counts["graphql-enums"] = graphqlCount;
  counts["shared-ts-vocab"] = sharedCount;

  // G4: EAS schema config.
  const schemasJsonRaw = sourceOf(SCHEMAS_JSON_PATH);
  let schemaChecked = 0;
  let schemaSkipped = 0;
  if (schemasJsonRaw !== null) {
    let schemasJson;
    try {
      schemasJson = JSON.parse(schemasJsonRaw).schemas ?? {};
    } catch (error) {
      fatal.push(`could not parse ${SCHEMAS_JSON_PATH}: ${error.message}`);
      schemasJson = null;
    }
    if (schemasJson) {
      for (const [key, schema] of Object.entries(ontology.schemas)) {
        if (schema.source_status === "specified") {
          schemaSkipped += 1;
          continue;
        }
        if (schema.check === "existence-only") {
          schemaChecked += 1;
          const declSource = sourceOf(schema.source);
          if (declSource !== null) {
            // Exact equality against the full quoted registration constant —
            // an infix test would let fields ADDED around the declared list
            // (which change the schema UID) pass silently.
            const quoted = extractQuotedConstant(declSource, schema.source_symbol);
            if (quoted === null) {
              fatal.push(
                `schema ${key}: could not extract quoted constant ${schema.source_symbol} from ${schema.source}`
              );
            } else {
              const expectedSchemaString = schema.fields.map((f) => `${f.type} ${f.name}`).join(",");
              const squash = (text) => text.replace(/\s+/g, "");
              if (squash(quoted) !== squash(expectedSchemaString)) {
                findings.push({
                  guard: "eas-schemas",
                  subject: `schema:${key}`,
                  file: schema.source,
                  detail: `registration string expected "${expectedSchemaString}" found "${quoted}"`,
                  message: `schema ${key} deviates from its registration source`,
                });
              }
            }
          }
          continue;
        }
        if (schema.source !== SCHEMAS_JSON_PATH) {
          fatal.push(`schema ${key}: unrecognized source "${schema.source}" for a live schema`);
          continue;
        }
        schemaChecked += 1;
        const declared = schemasJson[key];
        if (!declared) {
          findings.push({
            guard: "eas-schemas",
            subject: `schema:${key}`,
            file: SCHEMAS_JSON_PATH,
            detail: "declared in the sidecar but missing from schemas.json",
            message: `schema ${key} missing from schemas.json`,
          });
          continue;
        }
        const diffs = [];
        if (declared.name !== schema.name) diffs.push(`name expected "${schema.name}" found "${declared.name}"`);
        if (declared.revocable !== schema.revocable) {
          diffs.push(`revocable expected ${schema.revocable} found ${declared.revocable}`);
        }
        const expectedFields = schema.fields.map((f) => `${f.type} ${f.name}`).join(", ");
        const actualFields = (declared.fields ?? []).map((f) => `${f.type} ${f.name}`).join(", ");
        if (expectedFields !== actualFields) {
          diffs.push(`fields expected [${expectedFields}] found [${actualFields}]`);
        }
        if (diffs.length > 0) {
          findings.push({
            guard: "eas-schemas",
            subject: `schema:${key}`,
            file: SCHEMAS_JSON_PATH,
            detail: diffs.join("; "),
            message: `schema ${key} deviates from the sidecar`,
          });
        }
      }
      const sidecarSchemaKeys = new Set(Object.keys(ontology.schemas));
      for (const key of Object.keys(schemasJson)) {
        if (!sidecarSchemaKeys.has(key)) {
          findings.push({
            guard: "eas-schemas",
            subject: `schema:${key}`,
            file: SCHEMAS_JSON_PATH,
            detail: "present in schemas.json but undeclared in the sidecar",
            message: `schema ${key} is undeclared in the ontology`,
          });
        }
      }
    }
  }
  counts["eas-schemas"] = schemaChecked;
  counts["eas-schemas-skipped"] = schemaSkipped;

  // G5: glossary tables + definition lock.
  const glossary = sourceOf(GLOSSARY_PATH);
  if (glossary !== null) {
    const liveEntities = ontology.entities.filter((e) => e.semantic_status === "canonical");
    const proseCounts = parseCanonicalEntityCounts(glossary);
    if (proseCounts.length === 0) {
      fatal.push(`could not parse a canonical entity count in ${GLOSSARY_PATH}`);
    } else {
      const staleCounts = proseCounts.filter((count) => count !== liveEntities.length);
      if (staleCounts.length > 0) {
        findings.push({
          guard: "docs-glossary",
          subject: "docs:entity-count",
          file: GLOSSARY_PATH,
          detail: `expected ${liveEntities.length}; found [${proseCounts.join(", ")}]`,
          message: "glossary canonical entity count deviates from the sidecar",
        });
      }
    }
    const entityRows = parseGlossaryTable(glossary, "Domain Entities");
    if (!entityRows || entityRows.length === 0) fatal.push(`could not parse the Domain Entities table in ${GLOSSARY_PATH}`);
    else {
      const nameDiffs = compareMembers(
        liveEntities.map((e) => e.display),
        entityRows.map((r) => r.name),
        { ordered: true }
      );
      if (nameDiffs.length > 0) {
        findings.push({
          guard: "docs-glossary",
          subject: "docs:entities",
          file: GLOSSARY_PATH,
          detail: nameDiffs.join("; "),
          message: "glossary Domain Entities table deviates from the sidecar entity set",
        });
      } else {
        for (let i = 0; i < liveEntities.length; i += 1) {
          const wantSurfaces = liveEntities[i].surfaces.join(" · ");
          if (wantSurfaces !== entityRows[i].surfaces) {
            findings.push({
              guard: "docs-glossary",
              subject: `docs:surfaces:${liveEntities[i].id}`,
              file: GLOSSARY_PATH,
              detail: `surfaces expected "${wantSurfaces}" found "${entityRows[i].surfaces}"`,
              message: `glossary allowed surfaces for ${liveEntities[i].display} deviate from the sidecar`,
            });
          }
          const want = normalizeDocText(liveEntities[i].definition);
          const got = normalizeDocText(entityRows[i].definition);
          if (want !== got) {
            findings.push({
              guard: "docs-glossary",
              subject: `docs:definition:${liveEntities[i].id}`,
              file: GLOSSARY_PATH,
              detail: `definition mismatch — sidecar "${want}" vs glossary "${got}"`,
              message: `glossary definition for ${liveEntities[i].display} deviates from the sidecar canon`,
            });
          }
        }
      }
    }
    const personaRows = parseGlossaryTable(glossary, "Personas");
    if (!personaRows || personaRows.length === 0) fatal.push(`could not parse the Personas table in ${GLOSSARY_PATH}`);
    else {
      const personaDiffs = compareMembers(
        ontology.personas.map((p) => p.display),
        personaRows.map((r) => r.name),
        { ordered: true }
      );
      if (personaDiffs.length > 0) {
        findings.push({
          guard: "docs-glossary",
          subject: "docs:personas",
          file: GLOSSARY_PATH,
          detail: personaDiffs.join("; "),
          message: "glossary Personas table deviates from the sidecar persona set",
        });
      } else {
        for (let i = 0; i < ontology.personas.length; i += 1) {
          const wantSurfaces = ontology.personas[i].surfaces.join(" · ");
          if (wantSurfaces !== personaRows[i].surfaces) {
            findings.push({
              guard: "docs-glossary",
              subject: `docs:surfaces:persona:${ontology.personas[i].id}`,
              file: GLOSSARY_PATH,
              detail: `surfaces expected "${wantSurfaces}" found "${personaRows[i].surfaces}"`,
              message: `glossary allowed surfaces for ${ontology.personas[i].display} deviate from the sidecar`,
            });
          }
          const want = normalizeDocText(ontology.personas[i].definition);
          const got = normalizeDocText(personaRows[i].definition);
          if (want !== got) {
            findings.push({
              guard: "docs-glossary",
              subject: `docs:definition:persona:${ontology.personas[i].id}`,
              file: GLOSSARY_PATH,
              detail: `definition mismatch — sidecar "${want}" vs glossary "${got}"`,
              message: `glossary definition for ${ontology.personas[i].display} deviates from the sidecar canon`,
            });
          }
        }
      }
    }
    const capitalsNote = parseCapitalsNote(glossary);
    const capitalVocabulary = ontology.vocabularies.find((v) => v.id === "capital");
    if (!capitalsNote) fatal.push(`could not parse the Capital machine-ordering note in ${GLOSSARY_PATH}`);
    else if (capitalVocabulary) {
      const expected = capitalVocabulary.canonical.members.map((m, i) => `${titleCase(m)}:${i}`);
      const actual = capitalsNote.map((c) => `${c.name}:${c.value}`);
      const capitalDiffs = compareMembers(expected, actual, { ordered: true });
      if (capitalDiffs.length > 0) {
        findings.push({
          guard: "docs-glossary",
          subject: "docs:capital-order",
          file: GLOSSARY_PATH,
          detail: capitalDiffs.join("; "),
          message: "glossary Capital machine-ordering note deviates from the canonical order",
        });
      }
    }
  }
  counts["docs-glossary"] = 1;

  // G6: the glossary's hand-written Term Reference. Every heading must resolve to a
  // canonical term, a declared alias, or a supporting term — otherwise orphan nouns
  // (the "Report" problem) accumulate in prose that nothing checks.
  let termReferenceChecked = 0;
  const glossaryAnchors = glossary === null ? new Set() : parseGlossaryAnchors(glossary);
  if (glossary !== null) {
    const headings = parseTermReferenceHeadings(glossary);
    if (!headings || headings.length === 0) {
      fatal.push(`could not parse the Term Reference section in ${GLOSSARY_PATH}`);
    } else {
      const resolvable = new Map();
      const remember = (label, owner) => {
        if (label?.trim()) resolvable.set(label.trim().toLowerCase(), owner);
      };
      for (const entity of ontology.entities) remember(entity.display, `entity:${entity.id}`);
      for (const persona of ontology.personas) remember(persona.display, `persona:${persona.id}`);
      for (const concept of projectionAliases) remember(concept.alias, concept.ref);
      const supportingSeen = new Set();
      for (const term of ontology.supporting_terms) remember(term.display, `supporting:${term.id}`);

      for (const heading of headings) {
        termReferenceChecked += 1;
        const owner = resolvable.get(heading.display.toLowerCase());
        if (!owner) {
          findings.push({
            guard: "docs-term-reference",
            subject: `docs:term:${heading.anchor}`,
            file: GLOSSARY_PATH,
            detail: `"${heading.display}" resolves to no entity, persona, declared alias, or supporting term`,
            message: "glossary Term Reference defines an undeclared term",
          });
        } else if (owner.startsWith("supporting:")) {
          supportingSeen.add(owner.slice("supporting:".length));
        }
      }
      for (const term of ontology.supporting_terms) {
        if (!supportingSeen.has(term.id)) {
          findings.push({
            guard: "docs-term-reference",
            subject: `sidecar:supporting-term:${term.id}`,
            file: SIDECAR_PATH,
            detail: `no "### ${term.display}" heading in the glossary Term Reference`,
            message: "supporting term is declared but no longer defined in the glossary",
          });
        }
      }
    }
  }
  counts["docs-term-reference"] = termReferenceChecked;

  // G7: the client's editorial glossary. Its ids must resolve to canonical terms and
  // its docsPath anchors must exist, so a renamed heading cannot silently break the
  // public /glossary deep links.
  let clientGlossaryChecked = 0;
  const clientGlossarySource = sourceOf(CLIENT_GLOSSARY_PATH);
  if (clientGlossarySource !== null) {
    const clientTerms = parseClientGlossaryTerms(clientGlossarySource);
    if (!clientTerms || clientTerms.length === 0) {
      fatal.push(`could not parse the TERMS array in ${CLIENT_GLOSSARY_PATH}`);
    } else {
      const termIds = new Set();
      for (const entity of ontology.entities) termIds.add(entity.id);
      for (const persona of ontology.personas) termIds.add(persona.id);
      for (const concept of projectionAliases) termIds.add(slugifyHeading(concept.alias));

      for (const term of clientTerms) {
        clientGlossaryChecked += 1;
        // The client writes camelCase ids; the sidecar writes kebab-case.
        const normalized = term.id.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
        if (!termIds.has(normalized)) {
          findings.push({
            guard: "client-glossary",
            subject: `client:term:${term.id}`,
            file: CLIENT_GLOSSARY_PATH,
            detail: `id "${term.id}" resolves to no entity, persona, or declared alias`,
            message: "client glossary defines a term the ontology does not know",
          });
        }
        const anchor = term.docsPath.includes("#") ? term.docsPath.split("#")[1] : null;
        if (!anchor) {
          findings.push({
            guard: "client-glossary",
            subject: `client:anchor:${term.id}`,
            file: CLIENT_GLOSSARY_PATH,
            detail: `docsPath "${term.docsPath}" carries no heading anchor`,
            message: "client glossary deep link has no anchor",
          });
        } else if (!glossaryAnchors.has(anchor)) {
          findings.push({
            guard: "client-glossary",
            subject: `client:anchor:${term.id}`,
            file: CLIENT_GLOSSARY_PATH,
            detail: `docsPath "#${anchor}" matches no heading in ${GLOSSARY_PATH}`,
            message: "client glossary deep link points at a missing glossary anchor",
          });
        }
      }
    }
  }
  counts["client-glossary"] = clientGlossaryChecked;

  // G6: declared mappings.
  let mappingCount = 0;
  for (const vocabulary of ontology.vocabularies) {
    for (const mapping of vocabulary.mappings ?? []) {
      mappingCount += 1;
      const from = vocabulary.representations.find((r) => r.id === mapping.from);
      const to = vocabulary.representations.find((r) => r.id === mapping.to);
      if (!from || !to) continue; // reported by integrity
      const diffs = [];
      if (mapping.kind === "explicit") {
        const pairKeys = Object.keys(mapping.pairs ?? {});
        const pairValues = Object.values(mapping.pairs ?? {});
        const fromSet = new Set(from.members);
        const toSet = new Set(to.members);
        for (const key of pairKeys) if (!fromSet.has(key)) diffs.push(`pair key ${key} not in ${mapping.from}`);
        for (const value of pairValues) if (!toSet.has(value)) diffs.push(`pair value ${value} not in ${mapping.to}`);
        if (mapping.total_from) {
          const unmapped = from.members.filter(
            (m) => !pairKeys.includes(m) && !(mapping.unmapped_from ?? []).includes(m)
          );
          if (unmapped.length) diffs.push(`unmapped from-members [${unmapped.join(", ")}]`);
        }
        if (mapping.bijective) {
          if (new Set(pairValues).size !== pairValues.length) diffs.push("pair values are not unique");
          const uncovered = to.members.filter(
            (m) => !pairValues.includes(m) && !(mapping.unmapped_to ?? []).includes(m)
          );
          if (uncovered.length) diffs.push(`uncovered to-members [${uncovered.join(", ")}]`);
        }
      } else if (mapping.kind === "identity") {
        const left = from.members.filter((m) => !(mapping.unmapped_from ?? []).includes(m));
        const right = to.members.filter((m) => !(mapping.unmapped_to ?? []).includes(m));
        const rightSet = new Set(right);
        const leftSet = new Set(left);
        const onlyLeft = left.filter((m) => !rightSet.has(m));
        const onlyRight = right.filter((m) => !leftSet.has(m));
        if (onlyLeft.length) diffs.push(`only in ${mapping.from}: [${onlyLeft.join(", ")}]`);
        if (onlyRight.length) diffs.push(`only in ${mapping.to}: [${onlyRight.join(", ")}]`);
      }
      if (diffs.length > 0) {
        findings.push({
          guard: "mappings",
          subject: `vocab:${vocabulary.id}/mapping:${mapping.id}`,
          file: from.file,
          detail: diffs.join("; "),
          message: `mapping ${mapping.id} is inconsistent`,
        });
      }
    }
  }
  counts.mappings = mappingCount;

  // G7: stable implementation anchors and spec arrival.
  let anchorSymbolCount = 0;
  for (const [kind, records] of [
    ["constraint", ontology.constraints],
    ["state machine", ontology.state_machines],
  ]) {
    for (const record of records) {
      for (const anchor of record.enforced_at ?? []) {
        if (!anchor.symbol) continue;
        anchorSymbolCount += 1;
        const source = sourceOf(anchor.file);
        if (source !== null && !sourceContainsSymbol(source, anchor.symbol)) {
          errors.push(
            `[anchor-symbol] ${kind} "${record.id}" no longer finds ${anchor.symbol} in ${anchor.file}`
          );
        }
      }
    }
  }
  counts["anchor-symbols"] = anchorSymbolCount;

  let arrivalWatched = 0;
  for (const { kind, id, anchor } of collectPlannedAnchors(ontology)) {
    arrivalWatched += 1;
    const abs = path.join(REPO_ROOT, anchor.file);
    if (!existsSync(abs)) continue;
    const source = readFileSync(abs, "utf8");
    if (sourceContainsSymbol(source, anchor.symbol)) {
      errors.push(
        `[spec-arrival] ${kind} "${id}" is now implemented at ${anchor.file} — flip source_status to "implemented", declare implementation anchors, and regenerate the ontology projections`
      );
    }
  }
  const schemasJsonForArrival = sources.get(SCHEMAS_JSON_PATH);
  if (schemasJsonForArrival) {
    try {
      const keys = new Set(Object.keys(JSON.parse(schemasJsonForArrival).schemas ?? {}));
      for (const [key, schema] of Object.entries(ontology.schemas)) {
        if (schema.source_status !== "specified") continue;
        arrivalWatched += 1;
        if (keys.has(key)) {
          errors.push(`[spec-arrival] schema "${key}" is now registered in schemas.json — flip source_status to "implemented"`);
        }
      }
    } catch {
      // parse failure already reported by G4
    }
  }
  counts["spec-arrival"] = arrivalWatched;

  // G8: pattern watches.
  for (const watch of ontology.pattern_watches) {
    const source = sourceOf(watch.file);
    if (source === null) continue;
    const present = new RegExp(watch.pattern).test(source);
    const violated = watch.expect === "absent" ? present : !present;
    if (violated) {
      findings.push({
        guard: "pattern-watch",
        subject: `watch:${watch.id}`,
        file: watch.file,
        detail: `pattern ${watch.expect === "absent" ? "present" : "missing"}: ${watch.pattern}`,
        message: watch.note,
      });
    }
  }
  counts["pattern-watch"] = ontology.pattern_watches.length;

  return { fatal, errors, findings, counts };
}

function checkGeneratedArtifacts(ontology, projections) {
  const errors = [];
  const renderAll = () => ({
    reference: renderOntologyMdx(ontology, projections),
    claims: renderMarketingClaimsMdx(projections),
    agent: renderAgentManifest(ontology, projections),
  });
  const first = renderAll();
  const second = renderAll();
  if (Object.keys(first).some((key) => first[key] !== second[key])) {
    errors.push("[generated-staleness] renderer is non-deterministic — render twice produced different output");
    return { errors, rendered: first };
  }
  for (const [relPath, expected] of [
    [GENERATED_REFERENCE_PATH, first.reference],
    [GENERATED_CLAIMS_PATH, first.claims],
    [AGENT_MANIFEST_PATH, first.agent],
  ]) {
    const abs = path.join(REPO_ROOT, relPath);
    const current = existsSync(abs) ? readFileSync(abs, "utf8").replace(/\r\n/g, "\n") : null;
    if (current !== expected) {
      errors.push(`[generated-staleness] stale generated artifact: ${relPath} — run \`bun run ontology:generate\` and commit`);
    }
  }
  return { errors, rendered: first };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function main() {
  const generateMode = process.argv.includes("--generate");

  const sidecarAbs = path.join(REPO_ROOT, SIDECAR_PATH);
  if (!existsSync(sidecarAbs)) {
    console.error(`check-ontology: missing sidecar ${SIDECAR_PATH}`);
    process.exit(2);
  }
  let ontology;
  try {
    ontology = JSON.parse(readFileSync(sidecarAbs, "utf8"));
  } catch (error) {
    console.error(`check-ontology: could not parse ${SIDECAR_PATH}: ${error.message}`);
    process.exit(2);
  }

  const projectionsAbs = path.join(REPO_ROOT, PROJECTIONS_PATH);
  if (!existsSync(projectionsAbs)) {
    console.error(`check-ontology: missing projections ${PROJECTIONS_PATH}`);
    process.exit(2);
  }
  let projections;
  try {
    projections = JSON.parse(readFileSync(projectionsAbs, "utf8"));
  } catch (error) {
    console.error(`check-ontology: could not parse ${PROJECTIONS_PATH}: ${error.message}`);
    process.exit(2);
  }

  const qaCatalogAbs = path.join(REPO_ROOT, QA_CATALOG_PATH);
  if (!existsSync(qaCatalogAbs)) {
    console.error(`check-ontology: missing QA catalog ${QA_CATALOG_PATH}`);
    process.exit(2);
  }
  let qaCatalog;
  try {
    qaCatalog = JSON.parse(readFileSync(qaCatalogAbs, "utf8"));
  } catch (error) {
    console.error(`check-ontology: could not parse ${QA_CATALOG_PATH}: ${error.message}`);
    process.exit(2);
  }

  const fileExists = (file) => existsSync(path.join(REPO_ROOT, file));
  const integrityErrors = [
    ...checkSidecarIntegrity(ontology, fileExists),
    ...checkProjectionIntegrity(ontology, projections, fileExists),
    ...checkQaCatalogRoles(ontology, qaCatalog),
  ];
  if (integrityErrors.length > 0) {
    console.error("check-ontology: sidecar integrity failed:\n");
    for (const error of integrityErrors) console.error(`- ${error}`);
    process.exit(2);
  }

  if (generateMode) {
    const reference = renderOntologyMdx(ontology, projections);
    const claims = renderMarketingClaimsMdx(projections);
    const agent = renderAgentManifest(ontology, projections);
    writeFileSync(path.join(REPO_ROOT, GENERATED_REFERENCE_PATH), reference);
    writeFileSync(path.join(REPO_ROOT, GENERATED_CLAIMS_PATH), claims);
    writeFileSync(path.join(REPO_ROOT, AGENT_MANIFEST_PATH), agent);
    console.log("Generated 3 ontology projections (reference, claims, agent manifest).");
    return;
  }

  const { fatal, errors, findings, counts } = runGuards(ontology, projections);
  if (fatal.length > 0) {
    console.error("check-ontology: could not evaluate anchors:\n");
    for (const error of fatal) console.error(`- ${error}`);
    process.exit(2);
  }

  errors.push(...checkGeneratedArtifacts(ontology, projections).errors);

  const baselineAbs = path.join(REPO_ROOT, BASELINE_PATH);
  if (!existsSync(baselineAbs)) {
    console.error(`check-ontology: missing baseline ${BASELINE_PATH}`);
    process.exit(2);
  }
  let baseline;
  try {
    baseline = JSON.parse(readFileSync(baselineAbs, "utf8"));
  } catch (error) {
    console.error(`check-ontology: could not parse ${BASELINE_PATH}: ${error.message}`);
    process.exit(2);
  }
  const { errors: baselineErrors, warnings, matched } = reconcileBaseline(findings, baseline, new Date());
  errors.push(...baselineErrors);

  if (errors.length > 0) {
    console.error("Ontology drift check failed:\n");
    for (const error of errors) console.error(`- ${error}`);
    process.exit(1);
  }

  console.log(
    `✅ sidecar-integrity: ${ontology.entities.length} entities, ${ontology.vocabularies.length} vocabularies, ${Object.keys(ontology.schemas).length} schemas, ${ontology.constraints.length} constraint records, ${ontology.state_machines.length} state-machine records structurally valid`
  );
  console.log(`✅ solidity-enums: ${counts["solidity-enums"]} enums verified`);
  console.log(`✅ graphql-enums: ${counts["graphql-enums"]} enums verified`);
  console.log(`✅ shared-ts-vocab: ${counts["shared-ts-vocab"]} declarations verified`);
  console.log(`✅ eas-schemas: ${counts["eas-schemas"]} schemas verified (↷ ${counts["eas-schemas-skipped"]} specified skipped)`);
  console.log("✅ docs-glossary: entity count, entities, personas, surfaces, capital ordering, and definitions locked");
  console.log(`✅ mappings: ${counts.mappings} mappings verified`);
  console.log(`✅ anchor-symbols: ${counts["anchor-symbols"]} stable implementation anchors verified`);
  console.log(`✅ spec-arrival: ${counts["spec-arrival"]} planned anchors watched`);
  console.log(`✅ pattern-watch: ${counts["pattern-watch"]} watches evaluated`);
  console.log(`✅ docs-term-reference: ${counts["docs-term-reference"]} glossary term entries resolved`);
  console.log(`✅ client-glossary: ${counts["client-glossary"]} client terms and deep links resolved`);
  console.log("✅ generated-staleness: 3 artifacts current and deterministic");
  console.log(`✅ baseline: ${matched} finding(s) baselined`);
  for (const warning of warnings) console.log(`⚠️ ${warning}`);
  console.log(`check-ontology: all guards passed, ${matched} baselined finding(s).`);
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  try {
    main();
  } catch (error) {
    console.error("check-ontology crashed:", error);
    process.exit(1);
  }
}
