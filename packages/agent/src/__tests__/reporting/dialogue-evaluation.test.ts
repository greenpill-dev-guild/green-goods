import { describe, expect, it } from "vitest";
import { SCENARIOS } from "./driver/dialogue-corpus";
import { runDialogueEvaluation } from "./driver/dialogue-evaluation";
import { deterministicReading, score } from "./driver/dialogue-scoring";

const KEYS = { AGENT_REPORTING_OPENAI_API_KEY: "sk-test", AGENT_REPORTING_JEV_API_KEY: "jev-test" };

/** The dialogue evaluation's own guarantees, with no provider called. */
describe("the dialogue evaluation", () => {
  it("labels at least thirty scenarios, each in three languages and two wordings", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(30);
    for (const scenario of SCENARIOS)
      for (const locale of ["en", "es", "pt"] as const)
        expect(new Set(scenario.text[locale]).size).toBe(2);
  });

  it("never sends a request the cap cannot cover, and says it stopped there", async () => {
    const sent: string[] = [];
    const call = (async (input: RequestInfo | URL) => {
      sent.push(String(input));
      return new Response("{}", { status: 500 });
    }) as typeof fetch;
    const report = await runDialogueEvaluation(KEYS, { call, capUsd: 0.000_001 });
    expect(sent).toEqual([]);
    expect(report.stoppedAtCap).toBe(true);
    expect(report.spentUsd).toBe(0);
    expect(report.samples.filter((sample) => sample.system !== "deterministic")).toEqual(
      expect.arrayContaining([expect.objectContaining({ reading: null, failure: "disabled" })])
    );
  });

  it("goes on with the reader that needs no model when every provider is down", async () => {
    const call = (async (_input: RequestInfo | URL): Promise<Response> => {
      throw new TypeError("network down");
    }) as typeof fetch;
    const report = await runDialogueEvaluation(KEYS, {
      call,
      capUsd: 1,
      only: ["story-count-time"],
    });
    const failures = report.samples.filter((sample) => sample.system !== "deterministic");
    expect(failures.every((sample) => sample.reading === null && sample.failure)).toBe(true);
    expect(report.spentUsd).toBeGreaterThan(0);
    const floor = report.samples.find(
      (sample) => sample.system === "deterministic" && sample.locale === "en"
    );
    expect(floor?.reading?.facts).toMatchObject({ "details.seedlings": 30 });
  });

  it("finds no injected value or unasked field in what the deterministic reader takes", () => {
    for (const scenario of SCENARIOS.filter((one) => one.kind === "adversarial"))
      for (const locale of ["en", "es", "pt"] as const)
        for (const text of scenario.text[locale])
          expect(score(scenario, deterministicReading(scenario, locale, text)).unsupported).toBe(0);
  });
});
