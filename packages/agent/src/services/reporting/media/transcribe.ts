import * as z from "zod";
import { InterpretationUnavailableError } from "../interpretation";
import type { ModelMeter, ModelUsage } from "../model-spend";
import type { OpenAIConfig } from "../openai-responses";

/**
 * One OpenAI Audio transcription of a normalized voice note, with the model the operator pinned.
 * Only the decoded recording and a language hint leave the Agent; the result is plain text that
 * the report rules then treat as transcribed, never as something the gardener typed. Every failure
 * becomes an InterpretationUnavailableError so the media job can retry or explain. The meter
 * records every request before it is sent, reserving the recording's length, which the provider
 * prices per minute, and settles it with the tokens or duration the reply bills.
 */
const LANGUAGES = new Set(["en", "es", "pt"]);
const transcriptSchema = z.object({ text: z.string().max(10_000) });
const usageSchema = z.object({
  usage: z.union([
    z.object({
      input_tokens: z.number().int().nonnegative(),
      output_tokens: z.number().int().nonnegative(),
    }),
    z.object({ type: z.literal("duration"), seconds: z.number().nonnegative() }),
  ]),
});

function billed(json: unknown): ModelUsage | undefined {
  const parsed = usageSchema.safeParse(json);
  if (!parsed.success) return undefined;
  const { usage } = parsed.data;
  return "seconds" in usage
    ? { audioSeconds: usage.seconds }
    : { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

export async function transcribeVoice(
  config: OpenAIConfig & { transcriptionModel: string },
  input: { wav: Uint8Array; locale: string; seconds: number },
  signal: AbortSignal,
  meter?: ModelMeter
): Promise<{ model: string; text: string }> {
  const settle = meter?.({
    provider: "openai",
    model: config.transcriptionModel,
    purpose: "transcription",
    reserve: { audioSeconds: input.seconds },
  });
  const form = new FormData();
  form.append(
    "file",
    new Blob([new Uint8Array(input.wav)], { type: "audio/wav" }),
    "voice-note.wav"
  );
  form.append("model", config.transcriptionModel);
  form.append("response_format", "json");
  const language = input.locale.slice(0, 2).toLowerCase();
  if (LANGUAGES.has(language)) form.append("language", language);
  const call = config.fetch ?? fetch;
  let response: Response;
  try {
    response = await call(`${config.baseUrl.replace(/\/+$/, "")}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${config.apiKey}` },
      body: form,
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
  const usage = billed(json);
  settle?.({ outcome: "answered", ...(usage ? { usage } : {}) });
  const body = transcriptSchema.safeParse(json);
  if (!body.success) throw new InterpretationUnavailableError("malformed");
  return { model: config.transcriptionModel, text: body.data.text.trim() };
}
