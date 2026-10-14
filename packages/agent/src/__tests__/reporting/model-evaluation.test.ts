import { describe, expect, it, vi } from "vitest";
import { runModelEvaluation } from "./driver/model-evaluation";

/** Evaluation instrumentation and grades only; fixture scores do not establish live quality. */
const env = {
  AGENT_REPORTING_OPENAI_API_KEY: "eval-secret-openai",
  AGENT_REPORTING_JEV_API_KEY: "eval-secret-jev",
};
const expectations = [
  {
    intent: "report_content",
    facts: [{ field: "timeSpentMinutes", value: 90, original: "an hour and a half" }],
  },
  {
    intent: "report_content",
    facts: [
      { field: "details.seedlings", value: 10, original: "10 plántulas" },
      { field: "timeSpentMinutes", value: 45, original: "45 minutos" },
    ],
  },
  {
    intent: "report_content",
    facts: [
      { field: "details.seedlings", value: 6, original: "6 mudas" },
      { field: "timeSpentMinutes", value: 30, original: "30 minutos" },
    ],
  },
  {
    intent: "correction",
    facts: [{ field: "details.seedlings", value: 8, original: "8 seedlings" }],
  },
  { intent: "report_content", facts: [] },
  { intent: "status", facts: [] },
];

function provider(options: { failJev?: boolean; failOpenAI?: boolean; wrongValue?: boolean } = {}) {
  let index = 0;
  const calls: Array<{ url: string; signal: AbortSignal | null | undefined }> = [];
  const fetchStub = (async (url: string, init: RequestInit) => {
    calls.push({ url, signal: init.signal });
    const body = JSON.parse(String(init.body));
    const isJev = url.includes("typesafe.ai");
    const fixture = expectations[index];
    if (!fixture) throw new Error("More than the bounded case set requested");
    if (!isJev) index += 1;
    if ((isJev && options.failJev) || (!isJev && options.failOpenAI))
      return Response.json({ error: "private provider detail" }, { status: 429 });
    if (isJev)
      return Response.json({
        model: body.model,
        answers: {
          intent: { type: "choice", choice: fixture.intent, confidence: 0.9 },
          ...(body.questions.garden
            ? { garden: { type: "choice", choice: "aiyeloja", confidence: 0.9 } }
            : {}),
          ...(body.questions.action
            ? { action: { type: "choice", choice: "a7", confidence: 0.9 } }
            : {}),
        },
      });
    const output = {
      intent: fixture.intent,
      gardenKey: null,
      actionUID: 7,
      facts: fixture.facts.map((fact) => ({
        ...fact,
        unit: null,
        ...(options.wrongValue ? { value: 999 } : {}),
      })),
    };
    return Response.json({
      model: body.model,
      status: "completed",
      output: [
        { type: "message", content: [{ type: "output_text", text: JSON.stringify(output) }] },
      ],
      usage: { input_tokens: 100, output_tokens: 10, input_tokens_details: { cached_tokens: 20 } },
    });
  }) as unknown as typeof fetch;
  return { fetchStub, calls };
}

describe("provider-only model evaluation", () => {
  it("fails before network calls when either provider key is missing", async () => {
    const call = vi.fn();
    await expect(runModelEvaluation({}, call as unknown as typeof fetch)).rejects.toThrow(
      "AGENT_REPORTING_OPENAI_API_KEY, AGENT_REPORTING_JEV_API_KEY"
    );
    await expect(
      runModelEvaluation(
        { AGENT_REPORTING_OPENAI_API_KEY: "test" },
        call as unknown as typeof fetch
      )
    ).rejects.toThrow("AGENT_REPORTING_JEV_API_KEY");
    expect(call).not.toHaveBeenCalled();
  });

  it("grades the six multilingual text cases, records usage and estimates cached-input cost", async () => {
    const { calls, fetchStub } = provider();
    const report = await runModelEvaluation(env, fetchStub);
    expect(report).toMatchObject({
      dataset: "synthetic-text-v1",
      cases: 6,
      calls: 12,
      qualityPassed: true,
      fullFallbacks: 0,
      partialFallbacks: 0,
      costCoverage: { measuredOpenaiCalls: 6, ratesChecked: "2026-10-02" },
    });
    expect(report.openaiEstimatedUsd).toBeCloseTo(0.0003, 8);
    expect(
      report.samples.every(
        (sample) => sample.adapterValid && sample.expectationsMet && sample.latencyMs >= 0
      )
    ).toBe(true);
    expect(calls).toHaveLength(12);
    expect(calls.every((call) => call.signal instanceof AbortSignal)).toBe(true);
    expect(
      calls.every((call) => /^https:\/\/(api\.openai\.com|api\.typesafe\.ai)\//.test(call.url))
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain("eval-secret");
  });

  it("reports partial fallback while preserving valid OpenAI extraction when Jev is unavailable", async () => {
    const report = await runModelEvaluation(env, provider({ failJev: true }).fetchStub);
    expect(report).toMatchObject({ qualityPassed: false, partialFallbacks: 6, fullFallbacks: 0 });
    expect(
      report.samples
        .filter((sample) => sample.provider === "openai")
        .every((sample) => sample.expectationsMet)
    ).toBe(true);
    expect(
      report.samples
        .filter((sample) => sample.provider === "jev")
        .every((sample) => sample.failure === "provider_error")
    ).toBe(true);
  });

  it("reports deterministic fallback and unknown costs when both providers fail, without exposing their response", async () => {
    const report = await runModelEvaluation(
      env,
      provider({ failJev: true, failOpenAI: true }).fetchStub
    );
    expect(report).toMatchObject({
      qualityPassed: false,
      fullFallbacks: 6,
      partialFallbacks: 0,
      openaiEstimatedUsd: null,
    });
    expect(
      report.samples.every((sample) => sample.failure === "provider_error" && !sample.adapterValid)
    ).toBe(true);
    expect(JSON.stringify(report)).not.toContain("private provider detail");
  });

  it("distinguishes a parseable structured response from a correct reported quantity", async () => {
    const report = await runModelEvaluation(env, provider({ wrongValue: true }).fetchStub);
    expect(report.qualityPassed).toBe(false);
    const sample = report.samples.find(
      (candidate) => candidate.caseId === "en-correction" && candidate.provider === "openai"
    );
    expect(sample).toMatchObject({ adapterValid: true, expectationsMet: false, failure: null });
  });
});
