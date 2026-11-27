import { type ReportField, validateDetailValue } from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { acceptsAmount, type QuestionProfile } from "../questions";
import type { StoryFact } from "./story-answers";

/**
 * The facts a read message gives, once each field's candidates are weighed: several choices for a
 * field that takes several are all of them; two different values for one field are a question,
 * not a value; a value its field or its profile cannot take is left out. A choice read only as
 * describing a count goes with that count.
 */
export function finalFacts(input: {
  read: ReadonlyMap<ReportField, StoryFact[]>;
  inputs: readonly WorkInput[];
  profile: QuestionProfile | null;
  details: Readonly<Record<string, unknown>>;
  /** The number field each choice read beside a number describes. */
  describedBy: ReadonlyMap<ReportField, ReportField>;
  /** A choice was also named after its field's name, so it stands on its own. */
  named: boolean;
}): StoryFact[] {
  const { read, inputs, profile, details, describedBy, named } = input;
  const facts: StoryFact[] = [];
  for (const [field, candidates] of read) {
    const key = field.startsWith("details.") ? field.slice("details.".length) : null;
    const definition = key ? inputs.find((candidate) => candidate.key === key) : null;
    const first = candidates[0] as StoryFact;
    const fact: StoryFact =
      definition?.type === "multi-select"
        ? {
            ...first,
            value: [...new Set(candidates.flatMap((candidate) => candidate.value))] as string[],
          }
        : first;
    const values = new Set(candidates.map((candidate) => JSON.stringify(candidate.value)));
    if (definition?.type !== "multi-select" && values.size !== 1) continue;
    if (definition && !validateDetailValue(definition, fact.value).ok) continue;
    if (definition && !acceptsAmount(profile, definition.key, details, fact.value)) continue;
    facts.push(fact);
  }
  // "3 medicinal seedlings and 9 trees" gives no count, so it gives no species either.
  const kept = new Set(facts.map((fact) => fact.field));
  return facts.filter((fact) => {
    const counted = describedBy.get(fact.field);
    return !counted || kept.has(counted) || named;
  });
}
