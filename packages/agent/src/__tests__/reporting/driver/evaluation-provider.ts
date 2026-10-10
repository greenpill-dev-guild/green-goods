import * as z from "zod";
import { InterpretationUnavailableError } from "../../../services/reporting/interpretation";

const usageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  input_tokens_details: z.object({ cached_tokens: z.number().int().nonnegative() }).optional(),
});

export interface EvaluationSample {
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

/** Retains typed outcomes and usage, never provider bodies, headers or error messages. */
export async function measureProvider<T extends { model: string }>(
  call: typeof fetch,
  options: {
    caseId: string;
    provider: EvaluationSample["provider"];
    model: string;
    timeoutMs: number;
  },
  execute: (observe: typeof fetch, signal: AbortSignal) => Promise<T>,
  expected: (result: T) => boolean
): Promise<{ value: T | null; sample: EvaluationSample }> {
  const observed: { usage: EvaluationSample["usage"] } = { usage: null };
  const observe = (async (input, init) => {
    const response = await call(input, init);
    if (options.provider === "openai" && response.ok) {
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
    value = await execute(observe, AbortSignal.timeout(options.timeoutMs));
  } catch (error) {
    failure = error instanceof InterpretationUnavailableError ? error.reason : "provider_error";
  }
  const usage = observed.usage;
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  // GPT-4.1 mini standard token rates, checked 2026-10-02. Image/PDF input is included
  // in the measured input-token count; this estimate is not a provider billing receipt.
  // https://developers.openai.com/api/docs/models/gpt-4.1-mini
  const estimatedUsd = usage
    ? ((usage.input_tokens - cached) * 0.4 + cached * 0.1 + usage.output_tokens * 1.6) / 1_000_000
    : null;
  return {
    value,
    sample: {
      caseId: options.caseId,
      provider: options.provider,
      requestedModel: options.model,
      returnedModel: value
        ? value.model === options.model
          ? options.model
          : "unexpected_model"
        : null,
      latencyMs: Math.round(performance.now() - start),
      adapterValid: value !== null,
      expectationsMet: value !== null && value.model === options.model && expected(value),
      failure,
      usage,
      estimatedUsd,
    },
  };
}
