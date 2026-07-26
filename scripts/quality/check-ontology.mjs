#!/usr/bin/env node
// Ontology drift gate: cross-checks packages/shared/src/ontology/green-goods-ontology.json
// against Solidity enums, the indexer GraphQL schema, shared TypeScript vocabularies,
// the EAS schema config, and the glossary tables; regenerates the two docs artifacts
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

import { renderEntityMatrixMdx, renderOntologyMdx } from "./ontology-render.mjs";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(__filename), "../..");

const SIDECAR_PATH = "packages/shared/src/ontology/green-goods-ontology.json";
const BASELINE_PATH = "scripts/data/ontology-drift-baseline.json";
const SCHEMAS_JSON_PATH = "packages/contracts/config/schemas.json";
const GLOSSARY_PATH = "docs/docs/reference/glossary-community.md";
const GENERATED_REFERENCE_PATH = "docs/docs/reference/ontology.generated.mdx";
const GENERATED_MATRIX_PATH = "docs/docs/builders/integrations/entity-matrix.mdx";

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
  const sectionEnd = rest.indexOf("\n---");
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
    rows.push({ name, definition: cells[4] });
  }
  return rows;
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
    for (const anchor of constraint.enforced_at) files.add(anchor.file);
    for (const hole of constraint.holes) for (const anchor of hole.anchors) files.add(anchor.file);
  }
  for (const machine of ontology.state_machines) {
    if (machine.spec_source) files.add(machine.spec_source);
  }
  for (const watch of ontology.pattern_watches) files.add(watch.file);
  for (const issue of ontology.known_issues) for (const anchor of issue.anchors) files.add(anchor);
  return files;
}

export function checkSidecarIntegrity(ontology, fileExists) {
  const errors = [];
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

  for (const vocabulary of ontology.vocabularies) {
    if (vocabulary.canonical.members.length === 0) errors.push(`vocabulary ${vocabulary.id}: empty canonical member list`);
    if (vocabulary.status === "spec") {
      if (!vocabulary.spec_source) errors.push(`vocabulary ${vocabulary.id}: spec status requires spec_source`);
      if (vocabulary.representations.length > 0) {
        errors.push(`vocabulary ${vocabulary.id}: spec status must not declare live representations`);
      }
      if (!vocabulary.planned_anchor) errors.push(`vocabulary ${vocabulary.id}: spec status requires planned_anchor`);
      else if (!fileExists(path.dirname(vocabulary.planned_anchor.file))) {
        errors.push(
          `vocabulary ${vocabulary.id}: planned_anchor directory does not exist: ${path.dirname(vocabulary.planned_anchor.file)}`
        );
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

  for (const machine of ontology.state_machines) {
    if (!vocabularyIds.has(machine.vocabulary)) {
      errors.push(`state machine ${machine.id}: unknown vocabulary "${machine.vocabulary}"`);
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

function runGuards(ontology) {
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
        if (schema.status === "spec") {
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
    const liveEntities = ontology.entities.filter((e) => e.status === "live");
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

  // G7: spec arrival.
  let arrivalWatched = 0;
  for (const vocabulary of ontology.vocabularies) {
    if (vocabulary.status !== "spec" || !vocabulary.planned_anchor) continue;
    arrivalWatched += 1;
    const abs = path.join(REPO_ROOT, vocabulary.planned_anchor.file);
    if (!existsSync(abs)) continue;
    // Bare-symbol probe on the comment-stripped source: arrival must trip even
    // if the vocabulary lands as a type alias or constant set rather than an
    // enum, but a commented-out mention must not trip it.
    const source = stripCode(readFileSync(abs, "utf8"));
    if (new RegExp(`\\b${vocabulary.planned_anchor.symbol}\\b`).test(source)) {
      errors.push(
        `[spec-arrival] vocabulary "${vocabulary.id}" is now implemented at ${vocabulary.planned_anchor.file} — flip status to "live", declare representations, and regenerate the docs artifacts`
      );
    }
  }
  const schemasJsonForArrival = sources.get(SCHEMAS_JSON_PATH);
  if (schemasJsonForArrival) {
    try {
      const keys = new Set(Object.keys(JSON.parse(schemasJsonForArrival).schemas ?? {}));
      for (const [key, schema] of Object.entries(ontology.schemas)) {
        if (schema.status === "spec" && keys.has(key)) {
          errors.push(`[spec-arrival] schema "${key}" is now registered in schemas.json — flip status to "live"`);
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

function checkGeneratedArtifacts(ontology) {
  const errors = [];
  const first = { reference: renderOntologyMdx(ontology), matrix: renderEntityMatrixMdx(ontology) };
  const second = { reference: renderOntologyMdx(ontology), matrix: renderEntityMatrixMdx(ontology) };
  if (first.reference !== second.reference || first.matrix !== second.matrix) {
    errors.push("[generated-staleness] renderer is non-deterministic — render twice produced different output");
    return { errors, rendered: first };
  }
  for (const [relPath, expected] of [
    [GENERATED_REFERENCE_PATH, first.reference],
    [GENERATED_MATRIX_PATH, first.matrix],
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

  const integrityErrors = checkSidecarIntegrity(ontology, (file) => existsSync(path.join(REPO_ROOT, file)));
  if (integrityErrors.length > 0) {
    console.error("check-ontology: sidecar integrity failed:\n");
    for (const error of integrityErrors) console.error(`- ${error}`);
    process.exit(2);
  }

  if (generateMode) {
    const reference = renderOntologyMdx(ontology);
    const matrix = renderEntityMatrixMdx(ontology);
    writeFileSync(path.join(REPO_ROOT, GENERATED_REFERENCE_PATH), reference);
    writeFileSync(path.join(REPO_ROOT, GENERATED_MATRIX_PATH), matrix);
    console.log(`Generated ${GENERATED_REFERENCE_PATH} and ${GENERATED_MATRIX_PATH}.`);
    return;
  }

  const { fatal, errors, findings, counts } = runGuards(ontology);
  if (fatal.length > 0) {
    console.error("check-ontology: could not evaluate anchors:\n");
    for (const error of fatal) console.error(`- ${error}`);
    process.exit(2);
  }

  errors.push(...checkGeneratedArtifacts(ontology).errors);

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
    `✅ sidecar-integrity: ${ontology.entities.length} entities, ${ontology.vocabularies.length} vocabularies, ${Object.keys(ontology.schemas).length} schemas, ${ontology.constraints.length} constraints, ${ontology.state_machines.length} state machines validated`
  );
  console.log(`✅ solidity-enums: ${counts["solidity-enums"]} enums verified`);
  console.log(`✅ graphql-enums: ${counts["graphql-enums"]} enums verified`);
  console.log(`✅ shared-ts-vocab: ${counts["shared-ts-vocab"]} declarations verified`);
  console.log(`✅ eas-schemas: ${counts["eas-schemas"]} schemas verified (↷ ${counts["eas-schemas-skipped"]} spec skipped)`);
  console.log("✅ docs-glossary: entities, personas, capital ordering, and definitions locked");
  console.log(`✅ mappings: ${counts.mappings} mappings verified`);
  console.log(`✅ spec-arrival: ${counts["spec-arrival"]} planned anchors watched`);
  console.log(`✅ pattern-watch: ${counts["pattern-watch"]} watches evaluated`);
  console.log("✅ generated-staleness: 2 artifacts current and deterministic");
  console.log(`✅ baseline: ${matched} finding(s) baselined`);
  for (const warning of warnings) console.log(`⚠️ ${warning}`);
  console.log(`check-ontology: 11 guards passed, ${matched} baselined finding(s).`);
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
