import {
  type ActionDefinitionSnapshot,
  parseNumberAnswer,
  type ReportField,
  validateDetailValue,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import { acceptsAmount, profiledInput, profiledWords, type QuestionProfile } from "../questions";
import {
  choiceIn,
  choiceNames,
  durationIn,
  gluedUnit,
  numeric,
  ownWords,
  type Token,
  tokenize,
} from "./story-tokens";
import * as W from "./story-words";

/**
 * Reads several named facts out of one message, with no model. It is the floor that works with
 * every model off, so it reads a message only when it can account for every word of each clause
 * that holds a number: the number, what it counts ("12 seedlings", "5 kW", "3 hours"), the choices
 * that describe it ("12 baobab seedlings"), and words from story-words.ts that cannot change what
 * the number means ("we planted", "today", "by the fence"). A clause with any other word, a
 * negation, or a sign that the number is not work done ("lost", "expected", "next week") leaves
 * the whole message to a question, since what it cannot read may change what it can. A message
 * that answers no open question also has to say it reports work ("planted", "it took", "total").
 */
export interface StoryFact {
  field: ReportField;
  value: string | number | string[];
  /** The words the value was read from. */
  original: string;
  unit?: string;
}

export interface StoryContext {
  snapshot: ActionDefinitionSnapshot | null;
  profile: QuestionProfile | null;
  details: Readonly<Record<string, unknown>>;
  locale: string;
  /** The fields the open question asks for: a bare number or a choice named alone answers it. */
  asked?: ReportField | readonly ReportField[] | null;
}

const CHOICE_TYPES = new Set<WorkInput["type"]>(["select", "band", "multi-select"]);

export function readStory(text: string, context: StoryContext): StoryFact[] {
  const { snapshot, profile, details, locale } = context;
  // A question back ("12?", "the 2 of us?") is not an answer.
  if (!snapshot || !text.trim() || /[?¿]/u.test(text)) return [];
  const inputs = snapshot.definition.inputs
    .filter((input) => input.type !== "repeater")
    .map((input) => profiledInput(profile, input, details));
  const numbers = inputs.filter((input) => input.type === "number");
  const choices = inputs.filter((input) => CHOICE_TYPES.has(input.type));
  const own = ownWords(inputs);
  const asked = [context.asked ?? []].flat();
  const askedKeys = new Set(asked.map((field) => field.replace(/^details\./u, "")));
  const askedNumber = numbers.find((input) => askedKeys.has(input.key)) ?? null;
  // A number's partner in a question that asks the two together is answered with it.
  const partners = (profile?.groups ?? [])
    .filter((group) => askedNumber && group.fields.includes(askedNumber.key))
    .flatMap((group) => group.fields);
  const askedChoices = choices.filter(
    (input) => askedKeys.has(input.key) || partners.includes(input.key)
  );
  const negations = W.negations(locale);
  const afterAFact = W.afterAFact(locale);
  const tokens = tokenize(text);
  const read = new Map<ReportField, StoryFact[]>();
  const durations: Array<{
    minutes: number;
    unit: "hours" | "minutes";
    original: string;
  }> = [];
  const said = (from: number, to: number) =>
    text.slice(tokens[from]?.start ?? 0, tokens[to - 1]?.end ?? 0);
  const note = (fact: StoryFact) => read.set(fact.field, [...(read.get(fact.field) ?? []), fact]);
  /** No word yet but fillers: a bare number here answers the open question. */
  let plain = true;
  /** A choice was named after its field's name, which says what it is without a verb. */
  let named = false;

  /** The number field a word names: by its unit, a word its profile lists, or its own title. */
  const nounOf = (token: Token | undefined): WorkInput | null => {
    if (token?.kind !== "word") return null;
    const named = numbers.filter(
      (input) =>
        (input.unit && W.wordKey(input.unit) === token.word) ||
        profiledWords(profile, input.key, locale, details).some(
          (alias) => W.wordKey(alias) === token.word
        ) ||
        own.get(input.key)?.has(token.word)
    );
    return named.length === 1
      ? (named[0] as WorkInput)
      : (named.find((input) => input === askedNumber) ?? null);
  };

  const names = choiceNames(choices);
  const choiceAt = (at: number, among?: readonly WorkInput[]) => choiceIn(names, tokens, at, among);
  /** Whether a choice says what a number counts: the two are asked together, or the activity counts one thing. */
  const describes = (counted: WorkInput, choice: WorkInput) =>
    (profile?.groups ?? []).some(
      (group) => group.fields.includes(counted.key) && group.fields.includes(choice.key)
    ) || numbers.length === 1;
  const noteChoice = (input: WorkInput, key: string, original: string) =>
    note({
      field: `details.${input.key}`,
      value: input.type === "multi-select" ? [key] : key,
      original,
    });

  const durationAt = (at: number) => durationIn(tokens, at);

  /** A number with what it counts, read from a token; the token after it, or null when unplaced. */
  const quantityAt = (at: number): number | null => {
    if (W.CLOCK_LEADS.has(tokens[at - 1]?.word ?? "")) return null;
    const duration = durationAt(at);
    if (duration) {
      // A duration is time spent, unless the activity counts something in that unit itself.
      const inUnit = (input: WorkInput) =>
        (W.HOURS.has(W.wordKey(input.unit ?? "")) && duration.unit === "hours") ||
        (W.MINUTES.has(W.wordKey(input.unit ?? "")) && duration.unit === "minutes");
      const field = askedKeys.has("timeSpentMinutes") ? undefined : numbers.find(inUnit);
      if (field && duration.simple !== null)
        note({
          field: `details.${field.key}`,
          value: duration.simple,
          original: said(at, duration.end),
          ...(field.unit ? { unit: field.unit } : {}),
        });
      else
        durations.push({
          minutes: duration.minutes,
          unit: duration.unit,
          original: said(at, duration.end),
        });
      return duration.end;
    }
    const token = tokens[at] as Token;
    const split = gluedUnit(token);
    const amount = parseNumberAnswer(split ? (split[1] as string) : token.raw);
    if (!amount.ok || (token.kind === "glued" && !split)) return null;
    let next = split ? at : at + 1;
    const describing: Array<{ input: WorkInput; key: string }> = [];
    for (let choice = choiceAt(next); choice && !split; choice = choiceAt(next)) {
      describing.push(choice);
      next += choice.words.length;
    }
    const unitToken = split
      ? { ...token, kind: "word" as const, word: W.wordKey(split[2] as string) }
      : tokens[next];
    let counted = nounOf(unitToken);
    if (counted) next += 1;
    else if (plain && askedNumber && !split) counted = askedNumber;
    if (!counted) return null;
    // What it counts may be named after it too: "12 plántulas de neem", "40 mudas de baobá e neem".
    if (["of", "de", "da", "do", "del", "das", "dos"].includes(tokens[next]?.word ?? "")) {
      for (let choice = choiceAt(next + 1); choice; choice = choiceAt(next + 1)) {
        describing.push(choice);
        next += 1 + choice.words.length;
        if (!W.JOINERS.has(tokens[next]?.word ?? "")) break;
      }
    }
    if (!describing.every((choice) => describes(counted as WorkInput, choice.input))) return null;
    const original = said(at, next);
    note({
      field: `details.${counted.key}`,
      value: amount.value,
      original,
      ...(counted.unit ? { unit: counted.unit } : {}),
    });
    for (const choice of describing) noteChoice(choice.input, choice.key, original);
    return next;
  };

  /** "species: neem", "the species was neem and moringa": a choice after its field's name. */
  const labelAt = (at: number): number | null => {
    const input = choices.find((choice) => own.get(choice.key)?.has(tokens[at]?.word ?? ""));
    if (!input || !W.NAMING.has(tokens[at + 1]?.word ?? tokens[at + 1]?.raw ?? "")) return null;
    let next = at + 2;
    const picked: string[] = [];
    for (let choice = choiceAt(next, [input]); choice; choice = choiceAt(next, [input])) {
      picked.push(choice.key);
      next += choice.words.length;
      if (!W.JOINERS.has(tokens[next]?.word ?? "") || !choiceAt(next + 1, [input])) break;
      next += 1;
    }
    for (const key of picked) noteChoice(input, key, said(at, next));
    named ||= picked.length > 0;
    return picked.length > 0 ? next : null;
  };

  /** "14 seedlings, not 12": a clause that only sets a number aside. */
  const setsAside = (clause: Token[]) => {
    const lead = clause.findIndex(
      (token) =>
        !negations.has(token.word) &&
        !["instead", "rather", "than", "vez", "lugar", "de", "en", "em", "of"].includes(token.word)
    );
    const rest = clause.slice(lead);
    return (
      lead > 0 &&
      rest[0]?.kind === "number" &&
      (rest.length === 1 || (rest.length === 2 && nounOf(rest[1]) !== null))
    );
  };

  /** Reads one clause; false when a word in it is not accounted for. */
  const readClause = (clause: Token[], offset: number): boolean => {
    let [place, tail, placed] = [false, false, false];
    for (let i = offset; i < offset + clause.length; ) {
      const token = tokens[i] as Token;
      const { word } = token;
      const morning =
        word === W.TOMORROW_OR_MORNING && W.MORNING_LEAD.has(tokens[i - 1]?.word ?? "");
      if (
        negations.has(word) ||
        (W.NOT_DONE.has(word) && !morning) ||
        (word === W.TOMORROW_OR_MORNING && !morning)
      )
        return setsAside(clause);
      if (tail) {
        if (numeric(token) || token.kind === "date") return false;
        i += 1;
        continue;
      }
      if (numeric(token) || (token.kind === "word" && durationAt(i))) {
        const next = quantityAt(i);
        if (next === null) return false;
        [i, placed, place, plain] = [next, true, false, false];
        continue;
      }
      if (token.kind === "date") {
        if (nounOf(tokens[i + 1]) || W.HOURS.has(tokens[i + 1]?.word ?? "")) return false;
        i += 1;
        continue;
      }
      const labelled = labelAt(i);
      if (labelled !== null) {
        [i, placed, plain] = [labelled, true, false];
        continue;
      }
      const answer = askedChoices.length > 0 ? choiceAt(i, askedChoices) : null;
      if (answer) {
        noteChoice(answer.input, answer.key, said(i, i + answer.words.length));
        [i, placed, plain] = [i + answer.words.length, true, false];
        continue;
      }
      i += 1;
      if (place) {
        place = !(W.PEOPLE.has(word) || W.REPORT_CUES.has(word) || W.WORK_TIME.has(word));
        continue;
      }
      if (W.BEFORE_A_NUMBER.has(word) && numeric(tokens[i])) continue;
      if (placed && W.JOINERS.has(word)) continue;
      if (placed && afterAFact.has(word)) tail = true;
      else if (!placed && W.PLACE_OPENERS.has(word)) [place, plain] = [true, false];
      else if (
        W.FILLERS.has(word) ||
        W.PEOPLE.has(word) ||
        W.REPORT_CUES.has(word) ||
        W.WORK_TIME.has(word) ||
        W.JOINERS.has(word) ||
        morning
      )
        continue;
      else if (token.capital && i - 1 > offset) plain = false;
      else return false;
    }
    return true;
  };

  let start = 0;
  for (let end = 0; end <= tokens.length; end += 1) {
    if (end < tokens.length && tokens[end]?.kind !== "break") continue;
    const clause = tokens.slice(start, end);
    const readable = readClause(clause, start);
    // A clause that cannot be read leaves the message alone: it may change what the rest says.
    if (!readable) return [];
    start = end + 1;
  }
  const words = new Set(tokens.map((token) => token.word));
  // With no question open, a message has to say it reports work, or name a field outright. A word
  // for time ("it took", "levou") says only how long, so it cues a duration and never a count.
  const timed = [...words].some((word) => W.WORK_TIME.has(word));
  const cued =
    named ||
    [...words].some((word) => W.REPORT_CUES.has(word)) ||
    (timed && read.size === 0 && durations.length > 0);
  if (asked.length === 0 && !cued) return [];
  // A duration is time spent on the work when time is what was asked, when the message also names
  // something else the activity records, or when it says so. Two durations are not one.
  const aboutWork = askedKeys.has("timeSpentMinutes") || read.size > 0 || timed;
  const [duration, ...others] = durations;
  if (aboutWork && duration && others.length === 0)
    note({
      field: "timeSpentMinutes",
      value: duration.minutes,
      original: duration.original,
      unit: duration.unit,
    });
  return finalFacts();

  function finalFacts(): StoryFact[] {
    const facts: StoryFact[] = [];
    for (const [field, candidates] of read) {
      const key = field.startsWith("details.") ? field.slice("details.".length) : null;
      const input = key ? inputs.find((candidate) => candidate.key === key) : null;
      const first = candidates[0] as StoryFact;
      // Several choices named for a field that takes several are all of them.
      const fact: StoryFact =
        input?.type === "multi-select"
          ? {
              ...first,
              value: [...new Set(candidates.flatMap((candidate) => candidate.value))] as string[],
            }
          : first;
      const values = new Set(candidates.map((candidate) => JSON.stringify(candidate.value)));
      // Two different values for one field is a question to ask, not a value to pick.
      if (input?.type !== "multi-select" && values.size !== 1) continue;
      if (input && !validateDetailValue(input, fact.value).ok) continue;
      if (input && !acceptsAmount(profile, input.key, details, fact.value)) continue;
      facts.push(fact);
    }
    return facts;
  }
}
