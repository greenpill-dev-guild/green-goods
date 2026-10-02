import * as z from "zod";
import { loadReportingProviders } from "../../../services/reporting/config";
import {
  createModelInterpreter,
  interpretWithDeadline,
  type InterpretationRequest,
  InterpretationUnavailableError,
} from "../../../services/reporting/interpretation";
import { extractWithOpenAI } from "../../../services/reporting/model-extraction";
import { routeWithJev } from "../../../services/reporting/model-routing";

/** Six synthetic text cases; no chat, database, signer, upload or chain composition is loaded. */
const CASES = [
  {
    id: "en-story",
    locale: "en",
    text: "At Aiyeloja Family Garden I planted twelve seedlings. It took an hour and a half.",
    action: null,
    intent: "report_content",
    numeric: { timeSpentMinutes: 90 },
  },
  {
    id: "es-numbers",
    locale: "es",
    text: "Planté 10 plántulas. Trabajé durante 45 minutos.",
    action: 7,
    intent: "report_content",
    numeric: { "details.seedlings": 10, timeSpentMinutes: 45 },
  },
  {
    id: "pt-numbers",
    locale: "pt",
    text: "Plantei 6 mudas. Trabalhei durante 30 minutos.",
    action: 7,
    intent: "report_content",
    numeric: { "details.seedlings": 6, timeSpentMinutes: 30 },
  },
  {
    id: "en-correction",
    locale: "en",
    text: "Correction: I planted 8 seedlings, not 12.",
    action: 7,
    intent: "correction",
    numeric: { "details.seedlings": 8 },
  },
  {
    id: "en-unstated",
    locale: "en",
    text: "I planted seedlings for some time. I did not count them or record how long it took.",
    action: 7,
    intent: "report_content",
    numeric: {},
  },
  {
    id: "en-status",
    locale: "en",
    text: "What is happening with my report?",
    action: 7,
    intent: "status",
    numeric: {},
  },
] as const;

const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative() }).optional(),
});

interface Sample {
  caseId: string;
  provider: "jev" | "openai";
  requestedModel: string;
  returnedModel: string | null;
  latencyMs: number;
  adapterValid: boolean;
  expectationsMet: boolean;
  failure: string | null;
  usage: z.infer<typeof usageSchema> | null;
  estimatedUsd: number | null;
}

function requestFor(example: (typeof CASES)[number]): InterpretationRequest {
  return {
    locale: example.locale,
    draftRevision: 1,
    message: { sourceEntryId: `eval-${example.id}`, text: example.text },
    content: {
      actionUID: example.action,
      title: null,
      timeSpentMinutes: null,
      feedback: null,
      details: example.id === "en-correction" ? { seedlings: 12 } : {},
    },
    requirements: [],
    gardens: [
      { key: "tas", label: "TAS" },
      { key: "aiyeloja", label: "Aiyeloja Family Garden" },
    ],
    actions: [
      {
        uid: 7,
        title: "Tree planting",
        inputs: [
          {
            key: "seedlings",
            title: "Seedlings planted",
            placeholder: "",
            type: "number",
            required: true,
            options: [],
            unit: "seedlings",
          },
        ],
      },
    ],
    observations: [],
  };
}

/** Calls the production adapters, retaining only metrics and expectations about synthetic data. */
export async function runModelEvaluation(
  env: Record<string, string | undefined>,
  call: typeof fetch = fetch
) {
  const { openai, interpretation: jev } = loadReportingProviders(env);
  const missing = [
    ...(!openai ? ["AGENT_REPORTING_OPENAI_API_KEY"] : []),
    ...(jev.provider === "none" ? ["AGENT_REPORTING_JEV_API_KEY"] : []),
  ];
  if (!openai || jev.provider === "none")
    throw new Error(`Missing provider credentials: ${missing.join(", ")}`);
  const samples: Sample[] = [];
  let fullFallbacks = 0;
  let partialFallbacks = 0;
  for (const example of CASES) {
    const request = requestFor(example);
    async function measure<T extends { model: string }>(
      provider: Sample["provider"],
      requestedModel: string,
      execute: (observe: typeof fetch, signal: AbortSignal) => Promise<T>,
      expected: (result: T) => boolean
    ): Promise<T | null> {
      const observed: { usage: Sample["usage"] } = { usage: null };
      const observe = (async (input, init) => {
        const response = await call(input, init);
        if (provider === "openai" && response.ok) {
          const body: unknown = await response
            .clone()
            .json()
            .catch(() => null);
          const parsed = usageSchema.safeParse(
            body && typeof body === "object" && "usage" in body ? body.usage : null
          );
          if (
            parsed.success &&
            (parsed.data.input_tokens_details?.cached_tokens ?? 0) <= parsed.data.input_tokens
          )
            observed.usage = parsed.data;
        }
        return response;
      }) as typeof fetch;
      const start = performance.now();
      let value: T | null = null;
      let failure: string | null = null;
      try {
        value = await execute(observe, AbortSignal.timeout(15_000));
      } catch (error) {
        failure = error instanceof InterpretationUnavailableError ? error.reason : "provider_error";
      }
      const usage = observed.usage;
      const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
      // GPT-4.1 mini standard text rates verified 2026-10-02; usage is measured, billing is estimated.
      // https://developers.openai.com/api/docs/models/gpt-4.1-mini
      const estimatedUsd = usage
        ? ((usage.input_tokens - cached) * 0.4 + cached * 0.1 + usage.output_tokens * 1.6) /
          1_000_000
        : null;
      samples.push({
        caseId: example.id,
        provider,
        requestedModel,
        returnedModel: value?.model ?? null,
        latencyMs: Math.round(performance.now() - start),
        adapterValid: value !== null,
        expectationsMet: value !== null && value.model === requestedModel && expected(value),
        failure,
        usage,
        estimatedUsd,
      });
      return value;
    }
    const routed = await measure(
      "jev",
      jev.model,
      (observe, signal) => routeWithJev({ ...jev, fetch: observe }, request, signal),
      (result) =>
        result.intent === example.intent &&
        result.gardenKey === (example.action === null ? "aiyeloja" : null) &&
        result.actionUID === (example.action === null ? 7 : null)
    );
    const extracted = await measure(
      "openai",
      openai.model,
      (observe, signal) => extractWithOpenAI({ ...openai, fetch: observe }, request, signal),
      (result) => {
        const numeric = Object.entries(example.numeric);
        return (
          result.intent === example.intent &&
          numeric.every(([field, value]) =>
            result.facts.some(
              (fact) =>
                fact.field === field &&
                fact.value === value &&
                Boolean(
                  fact.original && example.text.toLowerCase().includes(fact.original.toLowerCase())
                )
            )
          ) &&
          result.facts.every(
            (fact) =>
              !["timeSpentMinutes", "details.seedlings"].includes(fact.field) ||
              numeric.some(([field, value]) => fact.field === field && fact.value === value)
          ) &&
          (example.intent !== "status" || result.facts.length === 0)
        );
      }
    );
    const unavailable = async (): Promise<never> => {
      throw new InterpretationUnavailableError("provider_error");
    };
    const interpreter = createModelInterpreter({
      route: routed ? async () => routed : unavailable,
      extract: extracted ? async () => extracted : unavailable,
    });
    const combined = await interpretWithDeadline(interpreter, request, 100);
    if (!combined) fullFallbacks += 1;
    else if (combined.models.length < 2) partialFallbacks += 1;
  }
  const measuredCosts = samples.filter((sample) => sample.estimatedUsd !== null);
  return {
    dataset: "synthetic-text-v1",
    cases: CASES.length,
    calls: samples.length,
    qualityPassed: samples.every((sample) => sample.expectationsMet),
    models: { extraction: openai.model, jev: jev.model, transcription: openai.transcriptionModel },
    samples,
    fullFallbacks,
    partialFallbacks,
    openaiEstimatedUsd: measuredCosts.length
      ? measuredCosts.reduce((sum, sample) => sum + (sample.estimatedUsd ?? 0), 0)
      : null,
    costCoverage: {
      measuredOpenaiCalls: measuredCosts.length,
      jev: "not estimated; check provider billing",
      ratesChecked: "2026-10-02",
    },
    pending: [
      "photo/PDF/table quality",
      "accented voice transcription",
      "live Telegram flow",
      "live chain publication",
    ],
  };
}
