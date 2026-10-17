import * as z from "zod";
import { InterpretationUnavailableError } from "./interpretation";
import {
  imageTokenCeiling,
  inputTokenCeiling,
  type ModelMeter,
  type ModelPurpose,
  tokenCeiling,
} from "./model-spend";

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
 * Held against the daily cap until a reply states its usage, and a true ceiling of it. The request
 * apart from its images and files is reserved at one token per UTF-8 byte: instructions, content,
 * the output schema and the JSON around them, whose structure more than covers the provider's own
 * message framing. An image's encoded bytes say nothing useful about its tokens, so it is reserved
 * at the model's ceiling for an image of its largest possible size. A file is billed for its
 * extracted text and an image of every page, which nothing short of the whole context window
 * bounds, so a request with one reserves that.
 */
function reservedInputTokens(
  model: string,
  request: object,
  content: readonly InputPart[],
  imageEdge: number | undefined
): number {
  const withoutBinaries = JSON.stringify(request, (key, value) =>
    key === "image_url" || key === "file_data" ? "" : value
  );
  const window = inputTokenCeiling(model);
  let tokens = tokenCeiling(withoutBinaries);
  for (const part of content) {
    if (part.type === "input_file") return window ?? tokens;
    if (part.type === "input_image") {
      const image = imageEdge === undefined ? null : imageTokenCeiling(model, imageEdge);
      tokens += image ?? window ?? 0;
    }
  }
  return window === null ? tokens : Math.min(tokens, window);
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
    /** The most pixels a side of any image in `content`; without it an image reserves the window. */
    imageEdge?: number;
  },
  signal: AbortSignal,
  meter?: ModelMeter
): Promise<{ model: string; output: unknown }> {
  const call = config.fetch ?? fetch;
  const request = {
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
  };
  const settle = meter?.({
    provider: "openai",
    model: config.model,
    purpose: input.purpose,
    reserve: {
      inputTokens: reservedInputTokens(config.model, request, input.content, input.imageEdge),
      outputTokens: input.maxOutputTokens,
    },
  });
  let response: Response;
  try {
    response = await call(`${config.baseUrl.replace(/\/+$/, "")}/responses`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(request),
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
