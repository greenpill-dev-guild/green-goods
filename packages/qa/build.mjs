#!/usr/bin/env node
/**
 * QA app build — copy the page and project the catalog beside it.
 *
 * The catalog lives at the repo root (scripts/data/qa-test-catalog.json) and is
 * the upstream source of truth for scenario DEFINITIONS. Projecting it into
 * dist/ at build time keeps the page a plain static file with no bundler, and
 * keeps the running app pinned to the catalog revision it was deployed from —
 * a case can never change shape underneath a session in progress.
 *
 * Only ACTIVE cases ship: retired rows stay in the catalog as an audit trail
 * and must never appear on a run sheet.
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(packageDir, "..", "..");
const outDir = path.join(packageDir, "dist");
const localeCodes = ["en", "es", "pt"];
const localeUiKeys = [
  "act",
  "allParts",
  "allSurfaces",
  "handoff",
  "journey",
  "journeyRoles",
  "knownGate",
  "language",
  "orderJourney",
  "part",
  "roleRequirements",
  "surface",
  "verify",
];

/** The fields the page actually renders — everything else stays server-side. */
function projectCase(testCase) {
  return {
    id: testCase.id,
    tab: testCase.tab,
    area: testCase.area,
    pri: testCase.priority,
    scenario: testCase.scenario,
    steps: testCase.steps,
    expected: testCase.expected,
    rp: Boolean(testCase.requiresProduction),
    rd: Boolean(testCase.requiresDevice),
    tx: Boolean(testCase.tags?.includes("tx")),
  };
}

function projectLocaleCase(localeCode, source, translated) {
  const prefix = `locale '${localeCode}' case '${source.id}'`;
  requireExactKeys(translated, ["scenario", "steps", "expected"], prefix);
  if (!Array.isArray(translated.steps) || translated.steps.length !== source.steps.length) {
    throw new Error(`qa build: ${prefix} steps must match the canonical step count`);
  }
  const projected = {
    scenario: requireText(translated.scenario, `${prefix} scenario`),
    steps: translated.steps.map((step, index) => requireText(step, `${prefix} step ${index + 1}`)),
    expected: requireText(translated.expected, `${prefix} expected`),
  };
  if (localeCode === "en") {
    const canonical = {
      scenario: source.scenario,
      steps: source.steps,
      expected: source.expected,
    };
    if (JSON.stringify(projected) !== JSON.stringify(canonical)) {
      throw new Error(`qa build: ${prefix} must match the canonical catalog`);
    }
  }
  return projected;
}

function projectJourney(journey, activeIds) {
  for (const step of journey.steps) {
    if (!activeIds.has(step.caseId)) {
      throw new Error(
        `qa build: journey '${journey.id}' references missing or retired case '${step.caseId}'`,
      );
    }
  }
  return {
    id: journey.id,
    label: journey.label,
    summary: journey.summary,
    lanes: journey.lanes.map(({ id, label, role }) => ({ id, label, role })),
    phases: journey.phases.map(({ id, label }) => ({ id, label })),
    steps: journey.steps.map(
      ({ caseId, phaseId, leadLaneId, verifyLaneIds, handoff, knownGate }) => ({
        caseId,
        phaseId,
        leadLaneId,
        ...(verifyLaneIds?.length ? { verifyLaneIds } : {}),
        ...(handoff ? { handoff } : {}),
        ...(knownGate ? { knownGate } : {}),
      }),
    ),
  };
}

function requireText(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`qa build: ${label} must be non-empty`);
  return value;
}

function requireExactKeys(value, expected, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`qa build: ${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`qa build: ${label} keys must be ${wanted.join(", ")}`);
  }
}

function projectLocaleJourney(localeCode, source, translated) {
  const prefix = `locale '${localeCode}' journey '${source.id}'`;
  requireExactKeys(translated, ["label", "summary", "lanes", "phases", "steps"], prefix);
  requireExactKeys(translated.lanes, source.lanes.map((lane) => lane.id), `${prefix} lanes`);
  requireExactKeys(translated.phases, source.phases.map((phase) => phase.id), `${prefix} phases`);
  const copySteps = source.steps.filter((step) => step.handoff || step.knownGate);
  requireExactKeys(translated.steps, copySteps.map((step) => step.caseId), `${prefix} steps`);

  const projected = {
    label: requireText(translated.label, `${prefix} label`),
    summary: requireText(translated.summary, `${prefix} summary`),
    lanes: Object.fromEntries(source.lanes.map((lane) => {
      const copy = translated.lanes[lane.id];
      requireExactKeys(copy, ["label", "role"], `${prefix} lane '${lane.id}'`);
      return [lane.id, {
        label: requireText(copy.label, `${prefix} lane '${lane.id}' label`),
        role: requireText(copy.role, `${prefix} lane '${lane.id}' role`),
      }];
    })),
    phases: Object.fromEntries(source.phases.map((phase) => [
      phase.id,
      requireText(translated.phases[phase.id], `${prefix} phase '${phase.id}'`),
    ])),
    steps: Object.fromEntries(copySteps.map((step) => {
      const copy = translated.steps[step.caseId];
      const expectedFields = [step.handoff ? "handoff" : null, step.knownGate ? "knownGate" : null]
        .filter(Boolean);
      requireExactKeys(copy, expectedFields, `${prefix} step '${step.caseId}'`);
      return [step.caseId, {
        ...(step.handoff
          ? { handoff: requireText(copy.handoff, `${prefix} step '${step.caseId}' handoff`) }
          : {}),
        ...(step.knownGate
          ? { knownGate: requireText(copy.knownGate, `${prefix} step '${step.caseId}' knownGate`) }
          : {}),
      }];
    })),
  };

  if (localeCode === "en") {
    const canonical = {
      label: source.label,
      summary: source.summary,
      lanes: Object.fromEntries(source.lanes.map((lane) => [lane.id, { label: lane.label, role: lane.role }])),
      phases: Object.fromEntries(source.phases.map((phase) => [phase.id, phase.label])),
      steps: Object.fromEntries(copySteps.map((step) => [step.caseId, {
        ...(step.handoff ? { handoff: step.handoff } : {}),
        ...(step.knownGate ? { knownGate: step.knownGate } : {}),
      }])),
    };
    if (JSON.stringify(projected) !== JSON.stringify(canonical)) {
      throw new Error(`qa build: ${prefix} must match the canonical catalog`);
    }
  }

  return projected;
}

function loadJourneyLocales(journeys, activeCases) {
  const activeById = new Map(activeCases.map((testCase) => [testCase.id, testCase]));
  const journeyCaseIds = [...new Set(journeys.flatMap((journey) =>
    journey.steps.map((step) => step.caseId),
  ))];
  return Object.fromEntries(localeCodes.map((localeCode) => {
    const localePath = path.join(packageDir, "locales", `${localeCode}.json`);
    const source = JSON.parse(readFileSync(localePath, "utf8"));
    requireExactKeys(source, ["locale", "name", "ui", "journeys", "cases"], `locale '${localeCode}'`);
    if (source.locale !== localeCode) throw new Error(`qa build: ${localePath} declares '${source.locale}'`);
    requireText(source.name, `locale '${localeCode}' name`);
    requireExactKeys(source.ui, localeUiKeys, `locale '${localeCode}' UI`);
    for (const key of localeUiKeys) requireText(source.ui[key], `locale '${localeCode}' UI '${key}'`);
    requireExactKeys(source.journeys, journeys.map((journey) => journey.id), `locale '${localeCode}' journeys`);
    requireExactKeys(source.cases, journeyCaseIds, `locale '${localeCode}' cases`);
    return [localeCode, {
      name: source.name,
      ui: source.ui,
      journeys: Object.fromEntries(journeys.map((journey) => [
        journey.id,
        projectLocaleJourney(localeCode, journey, source.journeys[journey.id]),
      ])),
      cases: Object.fromEntries(journeyCaseIds.map((caseId) => [
        caseId,
        projectLocaleCase(localeCode, activeById.get(caseId), source.cases[caseId]),
      ])),
    }];
  }));
}

const catalogPath = path.join(repoRoot, "scripts", "data", "qa-test-catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
const active = catalog.cases.filter((testCase) => testCase.status !== "retired");
const activeIds = new Set(active.map((testCase) => testCase.id));
const journeys = (catalog.journeys ?? []).map((journey) => projectJourney(journey, activeIds));
const locales = loadJourneyLocales(journeys, active);

if (active.length === 0) {
  throw new Error(`qa build: no active cases found in ${catalogPath}`);
}

mkdirSync(outDir, { recursive: true });
copyFileSync(path.join(packageDir, "index.html"), path.join(outDir, "index.html"));
copyFileSync(
  path.join(repoRoot, "packages", "shared", "src", "styles", "design-md.generated.css"),
  path.join(outDir, "design-md.generated.css"),
);
writeFileSync(
  path.join(outDir, "catalog.json"),
  `${JSON.stringify({
    version: catalog.version,
    tabs: catalog.tabs,
    journeys,
    locales,
    cases: active.map(projectCase),
  })}\n`,
);

const perTab = catalog.tabs.map((tab) => `${tab} ${active.filter((c) => c.tab === tab).length}`);
console.log(`qa build: ${active.length} active cases (${perTab.join(", ")}) -> dist/`);
