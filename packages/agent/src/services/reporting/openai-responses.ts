import * as z from "zod";
import { InterpretationUnavailableError } from "./interpretation";
import type { ModelMeter, ModelPurpose } from "./model-spend";

/**
 * One OpenAI Responses call with a strict JSON schema and no stored response. Callers pass only
 * the task content; every failure (transport, status, refusal, incomplete or unparsable output)
 * becomes an InterpretationUnavailableError so the conversation falls back to plain questions.
 * The meter records every request before it is sent and settles it with the tokens billed whenever
 * the reply states them, including replies whose output is then rejected.
 */
export interface OpenAIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  fetch?: typeof fetch;
}

export type InputPart =
  | { type: "input_text"; text: string }
  | { type: "input_image"; image_url: string; detail: "low" | "high" | "auto" }
  | { type: "input_file"; filename: string; file_data: string };

const responseSchema = z.object({
  model: z.string(),
  status: z.string().optional(),
  output: z.array(
    z.object({
      type: z.string(),
      content: z.array(z.object({ type: z.string(), text: z.string().optional() })).optional(),
    })
  ),
});

const usageSchema = z.object({
  usage: z.object({
    input_tokens: z.number().int().nonnegative(),
    output_tokens: z.number().int().nonnegative(),
  }),
});

export function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * Generous ceilings, not prices, held against the daily cap until a reply states its usage: text
 * at four characters a token, an image at 2,500 tokens and a file at 3,000 tokens for each of the
 * at most 20 pages a PDF may have (media/documents.ts).
 */
const IMAGE_RESERVE_TOKENS = 2_500;
const FILE_RESERVE_TOKENS = 20 * 3_000;

function reservedInputTokens(instructions: string, content: readonly InputPart[]): number {
  let tokens = Math.ceil(instructions.length / 4);
  for (const part of content) {
    if (part.type === "input_text") tokens += Math.ceil(part.text.length / 4);
    else tokens += part.type === "input_image" ? IMAGE_RESERVE_TOKENS : FILE_RESERVE_TOKENS;
  }
  return tokens;
}

export async function structuredResponse(
  config: OpenAIConfig,
  input: {
    purpose: Extract<ModelPurpose, "extraction" | "media">;
    instructions: string;
    content: InputPart[];
    schemaName: string;
    schema: object;
    maxOutputTokens: number;
  },
  signal: AbortSignal,
  meter?: ModelMeter
): Promise<{ model: string; output: unknown }> {
  const call = config.fetch ?? fetch;
  const settle = meter?.({
    provider: "openai",
    model: config.model,
    purpose: input.purpose,
    reserve: {
      inputTokens: reservedInputTokens(input.instructions, input.content),
      outputTokens: input.maxOutputTokens,
    },
  });
  let response: Response;
  try {
    response = await call(`${config.baseUrl.replace(/\/+$/, "")}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: config.model,
        store: false,
        max_output_tokens: input.maxOutputTokens,
        input: [
          { role: "system", content: [{ type: "input_text", text: input.instructions }] },
          { role: "user", content: input.content },
        ],
        text: {
          format: {
            type: "json_schema",
            name: input.schemaName,
            strict: true,
            schema: input.schema,
          },
        },
      }),
      signal,
    });
  } catch {
    settle?.({ outcome: "unanswered" });
    throw new InterpretationUnavailableError(signal.aborted ? "timeout" : "provider_error");
  }
  if (!response.ok) {
    settle?.({ outcome: "failed" });
    throw new InterpretationUnavailableError("provider_error");
  }
  const json: unknown = await response.json().catch(() => null);
  const usage = usageSchema.safeParse(json);
  settle?.({
    outcome: "answered",
    ...(usage.success
      ? {
          usage: {
            inputTokens: usage.data.usage.input_tokens,
            outputTokens: usage.data.usage.output_tokens,
          },
        }
      : {}),
  });
  const body = responseSchema.safeParse(json);
  if (!body.success || (body.data.status && body.data.status !== "completed")) {
    throw new InterpretationUnavailableError("malformed");
  }
  const text = body.data.output
    .flatMap((item) => item.content ?? [])
    .find((part) => part.type === "output_text")?.text;
  if (!text || text.length > 40_000) throw new InterpretationUnavailableError("malformed");
  try {
    return { model: body.data.model, output: JSON.parse(text) };
  } catch {
    throw new InterpretationUnavailableError("malformed");
  }
}
