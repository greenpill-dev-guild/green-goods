import type { InterpretedIntent } from "../../../services/reporting/interpretation";
import { type Locale, SCENARIOS, type Scenario } from "./dialogue-corpus";
import {
  deterministicReading,
  type Reading,
  type Sample,
  score,
  withFloor,
} from "./dialogue-scoring";

/**
 * The evaluation's figures, from stored samples. The deterministic reader is read again with the
 * current code each time, so a change to it is measured against the same model replies without
 * calling a provider again. "pipeline+floor" and "planner+floor" are the readings as a turn
 * applies them: the deterministic reader's facts first, the model's for what is left.
 */
type Row = { scenario: Scenario; locale: Locale; wording: 0 | 1; reading: Reading | null };
type Rows = Record<string, Row[]>;

const byId = new Map(SCENARIOS.map((scenario) => [scenario.id, scenario]));

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((one, other) => one - other);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)] ?? null;
}

const rate = (results: Array<boolean | null>) => {
  const scored = results.filter((result): result is boolean => result !== null);
  return scored.length ? { right: scored.filter(Boolean).length, of: scored.length } : null;
};

const EXPECTED_INTENT = (scenario: Scenario): InterpretedIntent =>
  scenario.aside === "status"
    ? "status"
    : scenario.aside === "connect"
      ? "connect"
      : scenario.aside === "greeting"
        ? "greeting"
        : scenario.kind === "correction" && scenario.corrects
          ? "correction"
          : "report_content";

function figures(rows: Row[]) {
  const clear = rows.filter((row) => !row.scenario.ambiguous);
  const scores = clear.flatMap((row) => (row.reading ? [score(row.scenario, row.reading)] : []));
  const sum = (pick: (one: (typeof scores)[number]) => number) =>
    scores.reduce((total, one) => total + pick(one), 0);
  const [tp, fp, fn] = [
    sum((one) => one.truePositives),
    sum((one) => one.falsePositives),
    sum((one) => one.falseNegatives),
  ];
  const adversarial = clear.filter((row) => row.scenario.kind === "adversarial" && row.reading);
  return {
    messages: rows.length,
    answered: rows.filter((row) => row.reading).length,
    precision: tp + fp ? Number((tp / (tp + fp)).toFixed(3)) : null,
    recall: tp + fn ? Number((tp / (tp + fn)).toFixed(3)) : null,
    unsupported: sum((one) => one.unsupported),
    authorityViolations: adversarial.reduce(
      (total, row) => total + score(row.scenario, row.reading as Reading).unsupported,
      0
    ),
    outOfListAttempts: adversarial.reduce((total, row) => total + (row.reading?.refused ?? 0), 0),
    askedAgain: sum((one) => one.askedAgain),
    restated: sum((one) => one.restated),
    invalid: sum((one) => one.invalid),
    garden: rate(scores.map((one) => one.garden)),
    activity: rate(scores.map((one) => one.activity)),
    asides: rate(scores.map((one) => one.aside)),
    corrections: rate(scores.map((one) => one.correction)),
    unquoted: clear.reduce((total, row) => total + (row.reading?.unquoted ?? 0), 0),
  };
}

export function summarize(samples: readonly Sample[]) {
  const rows: Rows = {};
  const add = (system: string, row: Row) => (rows[system] ??= []).push(row);
  const keyOf = (sample: Sample) => `${sample.scenario}|${sample.locale}|${sample.wording}`;
  const floors = new Map<string, Reading>();
  for (const sample of samples) {
    const scenario = byId.get(sample.scenario);
    if (!scenario) continue;
    if (sample.system === "deterministic") {
      // Read again with the reader as it is now.
      const text = scenario.text[sample.locale][sample.wording];
      const reading = deterministicReading(scenario, sample.locale, text);
      floors.set(keyOf(sample), reading);
      add("deterministic", { ...sample, scenario, reading });
    }
  }
  for (const sample of samples) {
    const scenario = byId.get(sample.scenario);
    if (!scenario || sample.system === "deterministic") continue;
    add(sample.system, { ...sample, scenario, reading: sample.reading });
    const floor = floors.get(keyOf(sample));
    add(`${sample.system}+floor`, {
      ...sample,
      scenario,
      reading: sample.reading && floor ? withFloor(floor, sample.reading) : (floor ?? null),
    });
  }
  const systems = Object.fromEntries(
    Object.entries(rows).map(([system, list]) => {
      const own = samples.filter((sample) => system.startsWith(sample.system));
      const latency = own.filter((sample) => sample.reading).map((sample) => sample.latencyMs);
      return [
        system,
        {
          all: figures(list),
          byLocale: Object.fromEntries(
            (["en", "es", "pt"] as const).map((locale) => [
              locale,
              figures(list.filter((row) => row.locale === locale)),
            ])
          ),
          ...(system.endsWith("+floor")
            ? {}
            : {
                latencyMs: { p50: percentile(latency, 50), p95: percentile(latency, 95) },
                tokens: {
                  input: own.reduce((total, sample) => total + sample.inputTokens, 0),
                  output: own.reduce((total, sample) => total + sample.outputTokens, 0),
                },
                usd: Number(own.reduce((total, sample) => total + sample.usd, 0).toFixed(4)),
                failures: own.reduce<Record<string, number>>((counts, sample) => {
                  if (sample.failure) counts[sample.failure] = (counts[sample.failure] ?? 0) + 1;
                  return counts;
                }, {}),
              }),
        },
      ];
    })
  );
  // Jev's routing wins over OpenAI's intent in the pipeline; where they differ, whose was right.
  const differing = samples.filter(
    (sample) =>
      sample.system === "pipeline" &&
      sample.routed &&
      sample.extracted &&
      sample.routed.intent !== sample.extracted.intent
  );
  const expected = (sample: Sample) => EXPECTED_INTENT(byId.get(sample.scenario) as Scenario);
  const jevPrecedence = {
    differing: differing.length,
    jevRight: differing.filter((sample) => sample.routed?.intent === expected(sample)).length,
    openaiRight: differing.filter((sample) => sample.extracted?.intent === expected(sample)).length,
  };
  // The labels leave these to a native speaker; each reader's answer is listed for that review.
  const forReview = Object.entries(rows).flatMap(([system, list]) =>
    list
      .filter((row) => row.scenario.ambiguous)
      .map((row) => ({
        system,
        scenario: row.scenario.id,
        locale: row.locale,
        text: row.scenario.text[row.locale][row.wording],
        read: row.reading?.facts ?? null,
      }))
  );
  return { systems, jevPrecedence, forReview };
}
