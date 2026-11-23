import { loadReportingProviders } from "../../../services/reporting/config";
import { validateProposal } from "../../../services/reporting/dialogue-proposal";
import {
  createModelInterpreter,
  type InterpretationRequest,
  InterpretationUnavailableError,
  proposeWithDeadline,
} from "../../../services/reporting/interpretation";
import { extractWithOpenAI } from "../../../services/reporting/model-extraction";
import { planWithOpenAI } from "../../../services/reporting/model-planner";
import { routeWithJev } from "../../../services/reporting/model-routing";
import type { ModelMeter, ModelUsage } from "../../../services/reporting/model-spend";
import { type Locale, SCENARIOS } from "./dialogue-corpus";
import {
  deterministicReading,
  readingOf,
  requestFor,
  type Sample,
  type System,
} from "./dialogue-scoring";
import { summarize } from "./dialogue-summary";

/**
 * The dialogue evaluation (PRD-1189): every corpus message, in each language and both wordings,
 * read by the deterministic reader, by the current pipeline (Jev routing and OpenAI extraction)
 * and by the dialogue planner, each through the same validation a turn applies. Only synthetic
 * corpus text is sent. Spend has a hard cap: a request whose reservation would carry the run past
 * it is never sent, and the run stops there and says so.
 */

/**
 * USD per million tokens for the pinned models, as model-spend.ts lists them (read 2026-10-16).
 * A model missing here is refused, so the cap never meets a request it cannot price.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "gpt-4.1-mini-2025-04-14": { input: 0.4, output: 1.6 },
  "jev-1.13.0": { input: 0.042, output: 0 },
};

function costOf(model: string, usage: ModelUsage): number {
  const price = PRICES[model];
  if (!price) throw new InterpretationUnavailableError("disabled");
  return ((usage.inputTokens ?? 0) * price.input + (usage.outputTokens ?? 0) * price.output) / 1e6;
}

export interface DialogueEvaluationOptions {
  call?: typeof fetch;
  /** The most the run may spend, in USD. */
  capUsd: number;
  /** Scenario ids to run; all when empty. */
  only?: readonly string[];
  timeoutMs?: number;
  /** Told about each sample as it finishes, for a progress line. */
  onSample?: (sample: Sample) => void;
}

const failureOf = (error: unknown) =>
  error instanceof InterpretationUnavailableError ? error.reason : "provider_error";

export async function runDialogueEvaluation(
  env: Record<string, string | undefined>,
  options: DialogueEvaluationOptions
) {
  const { openai, interpretation: jev } = loadReportingProviders(env);
  const missing = [
    ...(!openai ? ["AGENT_REPORTING_OPENAI_API_KEY"] : []),
    ...(jev.provider === "none" ? ["AGENT_REPORTING_JEV_API_KEY"] : []),
  ];
  if (!openai || jev.provider === "none")
    throw new Error(`Missing provider credentials: ${missing.join(", ")}`);
  const call = options.call ?? fetch;
  const timeoutMs = options.timeoutMs ?? 20_000;
  let spent = 0;
  let capped = false;
  const samples: Sample[] = [];

  /** A meter that refuses any request the cap cannot cover and counts what this sample spent. */
  const meterFor =
    (tally: { input: number; output: number; usd: number }): ModelMeter =>
    (request) => {
      const reserved = costOf(request.model, request.reserve);
      if (spent + reserved > options.capUsd) {
        capped = true;
        throw new InterpretationUnavailableError("disabled");
      }
      spent += reserved;
      return (settlement) => {
        spent -= reserved;
        const usage = settlement.outcome === "answered" ? settlement.usage : undefined;
        const billed =
          settlement.outcome === "failed" ? 0 : usage ? costOf(request.model, usage) : reserved;
        spent += billed;
        tally.usd += billed;
        tally.input += usage?.inputTokens ?? 0;
        tally.output += usage?.outputTokens ?? 0;
      };
    };

  async function measure(
    base: Omit<
      Sample,
      "reading" | "failure" | "latencyMs" | "inputTokens" | "outputTokens" | "usd"
    >,
    read: (meter: ModelMeter, signal: AbortSignal) => Promise<Partial<Sample>>
  ): Promise<Sample> {
    const tally = { input: 0, output: 0, usd: 0 };
    const started = performance.now();
    let result: Partial<Sample>;
    try {
      result = await read(meterFor(tally), AbortSignal.timeout(timeoutMs));
    } catch (error) {
      result = { reading: null, failure: failureOf(error) };
    }
    const sample: Sample = {
      ...base,
      reading: null,
      failure: null,
      ...result,
      latencyMs: Math.round(performance.now() - started),
      inputTokens: tally.input,
      outputTokens: tally.output,
      usd: tally.usd,
    };
    samples.push(sample);
    options.onSample?.(sample);
    return sample;
  }

  const chosen = SCENARIOS.filter(
    (scenario) => !options.only?.length || options.only.includes(scenario.id)
  );
  outer: for (const scenario of chosen) {
    for (const locale of ["en", "es", "pt"] as Locale[]) {
      for (const wording of [0, 1] as const) {
        const text = scenario.text[locale][wording];
        const request = requestFor(scenario, locale, text);
        const base = (system: System) => ({ scenario: scenario.id, locale, wording, system });
        await measure(base("deterministic"), async () => ({
          reading: deterministicReading(scenario, locale, text),
        }));
        await measure(base("pipeline"), (meter, signal) =>
          readPipeline(request, text, meter, signal)
        );
        await measure(base("planner"), async (meter, signal) => {
          const proposal = await planWithOpenAI({ ...openai, fetch: call }, request, signal, meter);
          const validated = validateProposal(proposal, request);
          return validated
            ? { reading: readingOf(validated, text) }
            : { reading: null, failure: "wrong_snapshot" };
        });
        if (capped) break outer;
      }
    }
  }

  async function readPipeline(
    request: InterpretationRequest,
    text: string,
    meter: ModelMeter,
    signal: AbortSignal
  ): Promise<Partial<Sample>> {
    const [routing, extraction] = await Promise.allSettled([
      routeWithJev(
        { ...jev, fetch: call } as Parameters<typeof routeWithJev>[0],
        request,
        signal,
        meter
      ),
      extractWithOpenAI(
        { ...openai, fetch: call } as Parameters<typeof extractWithOpenAI>[0],
        request,
        signal,
        meter
      ),
    ]);
    const routed = routing.status === "fulfilled" ? routing.value : null;
    const extracted = extraction.status === "fulfilled" ? extraction.value : null;
    const unavailable = async (): Promise<never> => {
      throw new InterpretationUnavailableError("provider_error");
    };
    const interpreter = createModelInterpreter({
      route: routed ? async () => routed : unavailable,
      extract: extracted ? async () => extracted : unavailable,
    });
    const proposal = await proposeWithDeadline(interpreter, request, 1_000);
    const validated = proposal ? validateProposal(proposal, request) : null;
    const reasons = [routing, extraction]
      .filter((settled) => settled.status === "rejected")
      .map((settled) => failureOf((settled as PromiseRejectedResult).reason));
    return {
      reading: validated ? readingOf(validated, text) : null,
      failure: validated
        ? reasons.length
          ? `partial:${reasons.join(",")}`
          : null
        : reasons.join(",") || "malformed",
      routed: routed
        ? { intent: routed.intent, garden: routed.gardenKey, activity: routed.actionUID }
        : null,
      extracted: extracted ? { intent: extracted.intent } : null,
    };
  }

  return {
    dataset: "dialogue-corpus-v1",
    scenarios: chosen.length,
    messages: chosen.length * 6,
    models: { extraction: openai.model, planner: openai.model, jev: jev.model },
    spentUsd: Number(spent.toFixed(4)),
    capUsd: options.capUsd,
    stoppedAtCap: capped,
    summary: summarize(samples),
    samples,
  };
}
