import {
  type ActionDefinition,
  type ReportField,
  validateDetailValue,
} from "@green-goods/shared/modules/agent-reporting";
import { isGreeting } from "../../../services/reporting/coordinator/commands";
import { readStory } from "../../../services/reporting/coordinator/story-answers";
import type { ValidatedProposal } from "../../../services/reporting/dialogue-proposal";
import type {
  InterpretationRequest,
  InterpretedIntent,
} from "../../../services/reporting/interpretation";
import { QUESTION_PROFILES, questionProfileFor } from "../../../services/reporting/questions";
import { planting, snapshot } from "../support/fixtures";
import { ACTIVITIES, GARDENS, type Locale, type Scenario } from "./dialogue-corpus";

/**
 * How the dialogue evaluation turns one synthetic message into a request, what each reader made
 * of it in one shape, and how that is scored against the corpus labels. Nothing here calls a
 * provider, so the same samples can be scored again after the reader that needs no model changes.
 */
export type System = "deterministic" | "pipeline" | "planner";

/** What one reader made of one message, after the validation every model reading goes through. */
export interface Reading {
  facts: Record<string, unknown>;
  garden: string | null;
  activity: number | null;
  intent: InterpretedIntent;
  corrects: boolean;
  /** Actions validation took out: a garden, activity, field or question that was not on offer. */
  refused: number;
  /** Facts whose quoted words are not in the message. */
  unquoted: number;
  /** Fields whose values are the gardener's own words, read with no model. */
  stated?: string[];
}

export interface Sample {
  scenario: string;
  locale: Locale;
  wording: 0 | 1;
  system: System;
  reading: Reading | null;
  /** Why no reading came back: a timeout, a provider error, a malformed or refused reply, the cap. */
  failure: string | null;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  usd: number;
  /** For the pipeline: what Jev and OpenAI said apart, to see whose answer won. */
  routed?: { intent: InterpretedIntent; garden: string | null; activity: number | null } | null;
  extracted?: { intent: InterpretedIntent } | null;
}

type ActivityName = keyof typeof ACTIVITIES;

function definitionOf(name: ActivityName): ActionDefinition {
  const activity = ACTIVITIES[name];
  return planting({
    actionUID: activity.uid,
    slug: activity.slug,
    title: activity.title,
    inputs: activity.inputs.map((input) => ({ ...input, options: [...input.options] })),
  });
}

const FIELD_TITLE: Record<string, string> = { timeSpentMinutes: "Time spent" };

/** The request a turn would send for this message: the bounded view, built here by hand. */
export function requestFor(
  scenario: Scenario,
  locale: Locale,
  text: string
): InterpretationRequest {
  const { situation } = scenario;
  const chosen = situation.activity ? definitionOf(situation.activity) : null;
  const offered = chosen ? [chosen] : (Object.keys(ACTIVITIES) as ActivityName[]).map(definitionOf);
  const details = situation.details ?? {};
  const asked = situation.asked ?? null;
  const askedInput = chosen?.inputs.find((input) => `details.${input.key}` === asked);
  const missing = chosen
    ? [
        ...chosen.inputs
          .filter((input) => input.required && details[input.key] === undefined)
          .map((input) => ({ kind: "detail" as const, key: input.key })),
        ...(situation.minutes === undefined ? [{ kind: "time" as const }] : []),
      ]
    : [{ kind: "garden" as const }, { kind: "action" as const }];
  const stated = [
    ...Object.keys(details).map((key) => `details.${key}`),
    ...(situation.minutes === undefined ? [] : ["timeSpentMinutes"]),
  ];
  return {
    version: 1,
    locale,
    goal: "report",
    draftRevision: 3,
    message: { sourceEntryId: `eval-${scenario.id}`, text },
    turns: [],
    question: asked
      ? {
          kind: asked === "timeSpentMinutes" ? "time" : "field",
          field: asked,
          text: `${askedInput?.title ?? FIELD_TITLE[asked]}?`,
          options: askedInput?.options ?? [],
        }
      : null,
    content: {
      actionUID: chosen?.actionUID ?? null,
      title: null,
      timeSpentMinutes: situation.minutes ?? null,
      feedback: null,
      details,
    },
    provenance: Object.fromEntries(
      stated.map((field) => [field, { origin: "gardener", stated: true }])
    ),
    conflicts: [],
    requirements: missing,
    gardens: GARDENS.map((garden) => ({ ...garden })),
    actions: offered.map((definition) => ({
      uid: definition.actionUID,
      title: definition.title,
      inputs: definition.inputs,
    })),
    observations: [],
    // Synthetic text written for the corpus; it never passed through a conversation.
  } as unknown as InterpretationRequest;
}

const quoted = (facts: Array<{ original?: string }>, text: string) =>
  facts.filter((fact) => fact.original && !text.toLowerCase().includes(fact.original.toLowerCase()))
    .length;

/** A model's validated proposal as a reading. */
export function readingOf(validated: ValidatedProposal, text: string): Reading {
  const { interpretation } = validated;
  return {
    facts: Object.fromEntries(interpretation.facts.map((fact) => [fact.field, fact.value])),
    garden: interpretation.gardenKey,
    activity: interpretation.actionUID,
    intent: interpretation.intent,
    corrects: interpretation.intent === "correction",
    refused: validated.refused.filter((refusal) => refusal.reason !== "empty").length,
    unquoted: quoted(interpretation.facts, text),
  };
}

/** What the reader that needs no model takes from the message, with the current code. */
export function deterministicReading(scenario: Scenario, locale: Locale, text: string): Reading {
  const { situation } = scenario;
  const frozen = situation.activity ? snapshot(definitionOf(situation.activity)) : null;
  const facts = readStory(text, {
    snapshot: frozen,
    profile: questionProfileFor(frozen, QUESTION_PROFILES),
    details: situation.details ?? {},
    locale,
    asked: (situation.asked ?? null) as ReportField | null,
  });
  const before: Record<string, unknown> = {
    ...Object.fromEntries(
      Object.entries(situation.details ?? {}).map(([key, value]) => [`details.${key}`, value])
    ),
    timeSpentMinutes: situation.minutes,
  };
  const corrects = facts.some(
    (fact) => before[fact.field] !== undefined && before[fact.field] !== fact.value
  );
  return {
    facts: Object.fromEntries(facts.map((fact) => [fact.field, fact.value])),
    garden: null,
    activity: null,
    intent: isGreeting(text)
      ? "greeting"
      : facts.length > 0
        ? corrects
          ? "correction"
          : "report_content"
        : "unclear",
    corrects,
    refused: 0,
    unquoted: quoted(facts, text),
    stated: facts.map((fact) => fact.field),
  };
}

/**
 * A model reading as the turn applies it after the reader that needs no model: what the words
 * name outright is the gardener's and stays, and the model fills only what that left empty.
 */
export function withFloor(floor: Reading, model: Reading): Reading {
  return { ...model, facts: { ...model.facts, ...floor.facts }, stated: Object.keys(floor.facts) };
}

/** Fields the evaluation scores: numbers, choices and time. Free text is checked only for `never`. */
const SCORED =
  /^(?:timeSpentMinutes|details\.(?:seedlings|species|area|milestoneValue|milestoneType))$/u;
const same = (one: unknown, other: unknown) => JSON.stringify(one) === JSON.stringify(other);
const ASIDES: Record<NonNullable<Scenario["aside"]>, InterpretedIntent> = {
  status: "status",
  connect: "connect",
  greeting: "greeting",
};
const REQUIRED_TIME = "timeSpentMinutes";

const INPUTS = new Map<string, (typeof ACTIVITIES)[keyof typeof ACTIVITIES]["inputs"][number]>(
  Object.values(ACTIVITIES).flatMap((activity) =>
    activity.inputs.map((input) => [`details.${input.key}`, input] as const)
  )
);

/**
 * A reading as a turn applies it. A value the report already holds changes nothing, so it is not
 * scored for or against the reader. Every value a report holds here is the gardener's, so a
 * model's different value for it is a disagreement the turn asks about, never the value: it is
 * not applied, and counted as a conflict. A value its field cannot take ("12 kg" for a count,
 * ["25"] for a number) is dropped by the report rules, and counted as invalid.
 */
function asApplied(scenario: Scenario, reading: Reading) {
  const { details = {}, minutes } = scenario.situation;
  const held = (field: string) =>
    field === "timeSpentMinutes" ? minutes : details[field.slice("details.".length)];
  let restated = 0;
  let invalid = 0;
  let conflicts = 0;
  const facts: Record<string, unknown> = {};
  for (const [field, value] of Object.entries(reading.facts)) {
    const holding = held(field);
    if (same(holding, value)) {
      restated += 1;
      continue;
    }
    if (holding !== undefined && holding !== null && !reading.stated?.includes(field)) {
      conflicts += 1;
      continue;
    }
    const input = INPUTS.get(field);
    const valid =
      field === "timeSpentMinutes"
        ? typeof value === "number" && Number.isFinite(value) && value > 0
        : input
          ? validateDetailValue({ ...input, options: [...input.options] }, value).ok
          : true;
    if (valid) facts[field] = value;
    else invalid += 1;
  }
  return { facts, restated, invalid, conflicts };
}

export interface Score {
  truePositives: number;
  falsePositives: number;
  falseNegatives: number;
  /** Values the labels say must never be read: an injected count, a field nobody mentioned. */
  unsupported: number;
  garden: boolean | null;
  activity: boolean | null;
  aside: boolean | null;
  correction: boolean | null;
  /** Facts the message gave that the report would still ask for. */
  askedAgain: number;
  /** Values the report already held, and values their field could not take. */
  restated: number;
  invalid: number;
  /** A model's values that disagreed with the gardener's: asked about, not applied. */
  conflicts: number;
}

export function score(scenario: Scenario, read: Reading): Score {
  const expected = scenario.facts ?? {};
  const applied = asApplied(scenario, read);
  const reading = { ...read, facts: applied.facts };
  const proposed = Object.entries(reading.facts).filter(([field]) => SCORED.test(field));
  const right = proposed.filter(([field, value]) => same(expected[field], value)).length;
  const never = scenario.never ?? {};
  const unsupported = Object.entries(reading.facts).filter(
    ([field, value]) =>
      never.fields?.includes(field) ||
      never.values?.some((bad) => same(bad, value) || same([bad], value))
  ).length;
  const missed = Object.entries(expected).filter(
    ([field, value]) => !same(reading.facts[field], value)
  );
  return {
    truePositives: right,
    falsePositives: proposed.length - right,
    falseNegatives: missed.length,
    unsupported,
    garden: scenario.kind === "selection" ? reading.garden === (scenario.garden ?? null) : null,
    activity:
      scenario.kind === "selection" ? reading.activity === (scenario.activity ?? null) : null,
    aside: scenario.aside ? reading.intent === ASIDES[scenario.aside] : null,
    correction:
      scenario.kind === "correction" ? reading.corrects === (scenario.corrects ?? false) : null,
    askedAgain: missed.filter(([field]) => field === REQUIRED_TIME || field.startsWith("details."))
      .length,
    restated: applied.restated,
    invalid: applied.invalid,
    conflicts: applied.conflicts,
  };
}
