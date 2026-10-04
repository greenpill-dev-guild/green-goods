import * as z from "zod";
import { InterpretationUnavailableError } from "./interpretation";

/**
 * One OpenAI Responses call with a strict JSON schema and no stored response. Callers pass only
 * the task content; every failure (transport, status, refusal, incomplete or unparsable output)
 * becomes an InterpretationUnavailableError so the conversation falls back to plain questions.
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

export function dataUrl(mime: string, bytes: Uint8Array): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export async function structuredResponse(
  config: OpenAIConfig,
  input: {
    instructions: string;
    content: InputPart[];
    schemaName: string;
    schema: object;
    maxOutputTokens: number;
  },
  signal: AbortSignal
): Promise<{ model: string; output: unknown }> {
  const call = config.fetch ?? fetch;
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
    throw new InterpretationUnavailableError(signal.aborted ? "timeout" : "provider_error");
  }
  if (!response.ok) throw new InterpretationUnavailableError("provider_error");
  const body = responseSchema.safeParse(await response.json().catch(() => null));
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
