import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadReportingProviders } from "../../services/reporting/config";
import { setControl } from "../../services/reporting/controls";
import { createModelInterpreter } from "../../services/reporting/interpretation";
import { extractWithOpenAI } from "../../services/reporting/model-extraction";
import {
  type ModelCall,
  modelProcessingOn,
  modelSpend,
  recordModelCall,
} from "../../services/reporting/model-spend";
import { operatorSnapshot } from "../../services/reporting/ops";
import { drain } from "../../services/reporting/worker";
import { reportUntilSummary } from "./support/flows";
import { ADA, Harness, spendDailyModelCap } from "./support/harness";

/**
 * The model spend ledger and its $2 daily cap on real SQLite: pricing, the UTC day boundary, the
 * operator view, and a chat turn that stops calling the model at the cap. Provider replies are
 * scripted; live billing is not exercised. Files and voice notes at the cap are covered beside
 * their own pause cases in media.sqlite.test.ts and voice.sqlite.test.ts.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

const EXTRACTION = "gpt-4.1-mini-2025-04-14";
const TRANSCRIPTION = "gpt-4o-mini-transcribe-2025-12-15";

function call(fields: Partial<ModelCall>): ModelCall {
  return {
    provider: "openai",
    model: EXTRACTION,
    purpose: "extraction",
    outcome: "answered",
    ...fields,
  };
}

function costs(): Array<number | null> {
  return (
    harness.core.db
      .query("SELECT cost_micro_usd AS cost FROM model_calls ORDER BY rowid")
      .all() as Array<{ cost: number | null }>
  ).map((row) => row.cost);
}

describe("model spend ledger", () => {
  it("prices answered calls at the pinned rate, rounding up, and leaves unknown costs out", () => {
    const calls: Array<Partial<ModelCall>> = [
      { inputTokens: 1_000, outputTokens: 100 },
      { inputTokens: 3, outputTokens: 0 },
      { model: TRANSCRIPTION, purpose: "transcription", inputTokens: 120, outputTokens: 30 },
      { model: TRANSCRIPTION, purpose: "transcription", audioSeconds: 42 },
      { outcome: "failed" },
      { outcome: "unanswered" },
      { provider: "jev", model: "jev-1.13.0", purpose: "routing" },
      { model: "a-model-without-a-price", inputTokens: 1_000 },
    ];
    for (const fields of calls) recordModelCall(harness.core, call(fields));
    // $0.40/$1.60 per million tokens; $1.25/$5 for audio tokens or $0.003 a minute.
    expect(costs()).toEqual([560, 2, 300, 2_100, null, null, null, null]);
  });

  it("has a price for every model this build pins", () => {
    const { openai } = loadReportingProviders({
      AGENT_REPORTING_OPENAI_API_KEY: "sk-test",
      AGENT_REPORTING_JEV_API_KEY: "jev-test",
    });
    const pinned = [openai?.model, openai?.transcriptionModel].filter((model): model is string =>
      Boolean(model)
    );
    expect(pinned).toHaveLength(2);
    for (const model of pinned) recordModelCall(harness.core, call({ model, inputTokens: 1_000 }));
    expect(costs().every((cost) => cost !== null && cost > 0)).toBe(true);
  });

  it("turns model processing off for the rest of the UTC day once $2 is spent", () => {
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "spend cap" });
    harness.clock.time = Date.parse("2026-10-16T23:00:00Z");
    recordModelCall(harness.core, call({ inputTokens: 4_999_997 }));
    expect(modelSpend(harness.core).spentMicroUsd).toBe(1_999_999);
    expect(modelProcessingOn(harness.core)).toBe(true);

    recordModelCall(harness.core, call({ inputTokens: 3 }));
    expect(modelSpend(harness.core)).toMatchObject({
      day: "2026-10-16",
      spentMicroUsd: 2_000_001,
      capReached: true,
    });
    expect(modelProcessingOn(harness.core)).toBe(false);

    harness.clock.time = Date.parse("2026-10-17T00:00:00Z");
    expect(modelProcessingOn(harness.core)).toBe(true);
    // The operator's switch still decides under the cap.
    setControl(harness.core, "model_processing", false, { actor: "test", reason: "paused" });
    expect(modelProcessingOn(harness.core)).toBe(false);
  });

  it("records a chat turn's model call, then stops asking the model once the cap is reached", async () => {
    await reportUntilSummary(harness);
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "spend cap" });
    const requests: unknown[] = [];
    const fetchStub = (async (_url: string, init: RequestInit) => {
      requests.push(init.body);
      const extraction = { intent: "correction", gardenKey: null, actionUID: null, facts: [] };
      return new Response(
        JSON.stringify({
          model: EXTRACTION,
          status: "completed",
          usage: { input_tokens: 1_000, output_tokens: 100, total_tokens: 1_100 },
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: JSON.stringify(extraction) }],
            },
          ],
        })
      );
    }) as unknown as typeof fetch;
    const openai = {
      apiKey: "sk-test",
      baseUrl: "https://openai.test/v1",
      model: EXTRACTION,
      fetch: fetchStub,
    };
    const deps = {
      ...harness.deps(),
      interpreter: createModelInterpreter({
        route: null,
        extract: (request, signal, meter) => extractWithOpenAI(openai, request, signal, meter),
      }),
    };
    const pending = () =>
      (
        harness.core.db
          .query(
            "SELECT count(*) AS n FROM inbox_events WHERE kind = 'message' AND state = 'pending'"
          )
          .get() as { n: number }
      ).n;

    await harness.post(harness.message(ADA, { text: "Actually it took two hours" }));
    await drain(deps);
    expect(requests).toHaveLength(1);
    expect(costs()).toEqual([560]);

    spendDailyModelCap(harness.core);
    await harness.post(harness.message(ADA, { text: "No, it took three hours" }));
    await drain(deps);
    // The turn was answered without the model, and the ledger gained nothing but the cap filler.
    expect(pending()).toBe(0);
    expect(requests).toHaveLength(1);
    expect(costs()).toHaveLength(2);
  });

  it("shows the day's spend and calls to the operator, from a ledger with no identifiers", () => {
    recordModelCall(harness.core, call({ inputTokens: 1_000, outputTokens: 100 }));
    recordModelCall(harness.core, call({ outcome: "unanswered" }));
    recordModelCall(
      harness.core,
      call({ provider: "jev", model: "jev-1.13.0", purpose: "routing" })
    );

    expect(operatorSnapshot(harness.core).modelSpend).toEqual({
      day: "2026-09-27",
      spentMicroUsd: 560,
      capMicroUsd: 2_000_000,
      capReached: false,
      calls: {
        "jev:routing:answered": 1,
        "openai:extraction:answered": 1,
        "openai:extraction:unanswered": 1,
      },
    });
    const columns = (
      harness.core.db.query("PRAGMA table_info(model_calls)").all() as Array<{ name: string }>
    ).map((column) => column.name);
    expect(columns).toEqual([
      "id",
      "day",
      "provider",
      "model",
      "purpose",
      "outcome",
      "input_tokens",
      "output_tokens",
      "cost_micro_usd",
      "created_at",
    ]);
  });
});
