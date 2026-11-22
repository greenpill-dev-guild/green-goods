import type { ActionDefinitionSnapshot } from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { type AgentLocale, normalizeAgentLocale } from "../../i18n";
import type { ReportingCopyKey } from "./copy";

/**
 * How the chat asks an activity's fields: an Agent-owned layer of wording over the activity's own
 * definition. The definition stays the authority on which fields exist, their types, their choices
 * and whether they are required; a profile only says how a field is asked, which field has to be
 * known first, which words a gardener may use for it, and which fields go together.
 *
 * A profile is written against one activity, named by its slug, and against the field types it
 * lists. It is used only for a definition that still has those fields with those types, and a
 * report keeps the profile version it started with. Every other activity, and every field a
 * profile leaves out, is asked from the definition's own title and hint.
 */
/** What a number means under one choice of the field it follows. */
interface ChoiceMeaning {
  ask: ReportingCopyKey;
  /** The unit the number is in, when it is a measure. */
  unit?: string;
  /** A count of things: a whole number, one or more. */
  count?: true;
  /** Words a gardener may use for what is counted, so "2 reformas" names it. */
  words?: Partial<Record<AgentLocale, readonly string[]>>;
}

interface FieldQuestion {
  /** The input type this question was written for. */
  type: WorkInput["type"];
  /** The question as the chat puts it; left out, the definition's title and hint ask it. */
  ask?: ReportingCopyKey;
  /** The field whose answer has to be known before this one means anything. */
  after?: string;
  /**
   * For a number whose meaning follows another field's choice: the unit and the question per
   * choice. A choice with no entry has no approved meaning yet, so it is asked from the
   * definition, with no unit and no example.
   */
  by?: { field: string; choices: Record<string, ChoiceMeaning> };
  /** A count of things: a whole number, one or more. */
  count?: true;
  /**
   * Words a gardener may use for this field's quantity, so "12 mudas" names it. They are matched
   * against what people write and never shown, so they sit here and not in the copy catalogs.
   */
  words?: Partial<Record<AgentLocale, readonly string[]>>;
}

export interface QuestionProfile {
  slug: string;
  version: number;
  fields: Record<string, FieldQuestion>;
  /** Two related fields asked in one question. An answer may give either, both or more. */
  groups?: ReadonlyArray<{ fields: readonly [string, string]; ask: ReportingCopyKey }>;
}

/**
 * What an Infrastructure Milestone's number measures for each type, as the activity's owner
 * decided on 21 Nov 2026 (RESR-89). The three capacity types take the unit their label names.
 * "Retrofit completed" and "Commissioning" are counts: how many were finished, or handed over, in
 * this report. A type added to the activity later has no entry here, so the chat asks it with the
 * definition's own words and never fills or suggests a value until its meaning is decided.
 */
const MILESTONE_MEANING: Record<string, ChoiceMeaning> = {
  "Solar kW installed": { unit: "kW", ask: "question.milestoneSolar" },
  "Battery kWh added": { unit: "kWh", ask: "question.milestoneBattery" },
  "Internet Mbps provisioned": { unit: "Mbps", ask: "question.milestoneInternet" },
  "Retrofit completed": {
    count: true,
    ask: "question.milestoneRetrofit",
    words: { en: ["retrofits"], es: ["rehabilitaciones", "reformas"], pt: ["reformas"] },
  },
  Commissioning: {
    count: true,
    ask: "question.milestoneCommissioning",
    words: { en: ["systems"], es: ["sistemas"], pt: ["sistemas"] },
  },
};

export const QUESTION_PROFILES: readonly QuestionProfile[] = [
  {
    slug: "solar.install_milestone",
    version: 1,
    fields: {
      milestoneType: { type: "select", ask: "question.milestoneType" },
      milestoneValue: {
        type: "number",
        after: "milestoneType",
        by: { field: "milestoneType", choices: MILESTONE_MEANING },
      },
    },
  },
  {
    slug: "agro.planting_event",
    version: 1,
    fields: {
      seedlingsPlanted: {
        type: "number",
        ask: "question.seedlingsPlanted",
        count: true,
        words: {
          en: ["seedlings", "trees", "saplings"],
          es: ["plántulas", "plantones", "árboles"],
          pt: ["mudas", "árvores"],
        },
      },
      participants: {
        type: "number",
        ask: "question.participants",
        count: true,
        words: {
          en: ["people", "participants", "volunteers"],
          es: ["personas", "participantes", "voluntarios"],
          pt: ["pessoas", "participantes", "voluntários"],
        },
      },
      speciesTags: { type: "multi-select", ask: "question.speciesTags" },
    },
    groups: [{ fields: ["seedlingsPlanted", "speciesTags"], ask: "question.seedlingsAndSpecies" }],
  },
];

/** A profile as a report pins it: `slug@version`. */
export function profileRef(profile: QuestionProfile): string {
  return `${profile.slug}@${profile.version}`;
}

function fits(profile: QuestionProfile, snapshot: ActionDefinitionSnapshot): boolean {
  const { inputs } = snapshot.definition;
  const input = (key: string) => inputs.find((candidate) => candidate.key === key);
  const fieldsFit = Object.entries(profile.fields).every(([key, question]) => {
    if (input(key)?.type !== question.type) return false;
    if (question.after && !input(question.after)) return false;
    // A per-choice meaning stands only for choices the definition still offers.
    const chooser = question.by ? input(question.by.field) : undefined;
    return (
      !question.by ||
      (chooser?.type === "select" &&
        Object.keys(question.by.choices).every((choice) => chooser.options.includes(choice)))
    );
  });
  return (
    fieldsFit &&
    (profile.groups ?? []).every((group) => group.fields.every((key) => input(key) !== undefined))
  );
}

/**
 * The profile to ask an activity's fields with. `pinned` is the version a report already uses: it
 * gets that one or none, never a newer one that might ask its open questions differently. A new
 * report gets the newest version written for the activity. Either way a profile whose fields no
 * longer match the definition is not used.
 */
export function questionProfileFor(
  snapshot: ActionDefinitionSnapshot | null,
  profiles: readonly QuestionProfile[],
  pinned?: string | null
): QuestionProfile | null {
  if (!snapshot) return null;
  const written = profiles
    .filter((profile) => profile.slug === snapshot.definition.slug)
    .sort((one, other) => other.version - one.version);
  const profile =
    pinned === undefined
      ? written[0]
      : written.find((candidate) => profileRef(candidate) === pinned);
  return profile && fits(profile, snapshot) ? profile : null;
}

type Details = Readonly<Record<string, unknown>>;

function chosenMeaning(question: FieldQuestion | undefined, details: Details) {
  const choice = question?.by ? details[question.by.field] : undefined;
  return typeof choice === "string" ? question?.by?.choices[choice] : undefined;
}

/** A field as the report asks and reads it: with the unit its profile gives it, if any. */
export function profiledInput(
  profile: QuestionProfile | null,
  input: WorkInput,
  details: Details
): WorkInput {
  const unit = chosenMeaning(profile?.fields[input.key], details)?.unit;
  return unit ? { ...input, unit } : input;
}

/** The reviewed question for a field, or null when the definition's own words ask it. */
export function profiledQuestion(
  profile: QuestionProfile | null,
  key: string,
  details: Details
): ReportingCopyKey | null {
  const question = profile?.fields[key];
  return chosenMeaning(question, details)?.ask ?? (question?.by ? null : (question?.ask ?? null));
}

/** The words a gardener may use for a field's quantity in this language, besides its unit. */
export function profiledWords(
  profile: QuestionProfile | null,
  key: string,
  locale: string,
  details: Details = {}
): readonly string[] {
  const question = profile?.fields[key];
  const language = normalizeAgentLocale(locale);
  return [
    ...(question?.words?.[language] ?? []),
    ...(chosenMeaning(question, details)?.words?.[language] ?? []),
  ];
}

/**
 * Whether a number may stand for a field: a count takes a whole number of one or more, and any
 * other amount is left to the activity's own rules.
 */
export function acceptsAmount(
  profile: QuestionProfile | null,
  key: string,
  details: Details,
  value: unknown
): boolean {
  const question = profile?.fields[key];
  if (!question?.count && !chosenMeaning(question, details)?.count) return true;
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}
