import * as z from "zod";
import { InterpretationUnavailableError } from "../interpretation";
import type { OpenAIConfig } from "../openai-responses";

/**
 * One OpenAI Audio transcription of a normalized voice note, with the model the operator pinned.
 * Only the decoded recording and a language hint leave the Agent; the result is plain text that
 * the report rules then treat as transcribed, never as something the gardener typed. Every failure
 * becomes an InterpretationUnavailableError so the media job can retry or explain.
 */
const LANGUAGES = new Set(["en", "es", "pt"]);
const transcriptSchema = z.object({ text: z.string().max(10_000) });

export async function transcribeVoice(
  config: OpenAIConfig & { transcriptionModel: string },
  input: { wav: Uint8Array; locale: string },
  signal: AbortSignal
): Promise<{ model: string; text: string }> {
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
    throw new InterpretationUnavailableError(signal.aborted ? "timeout" : "provider_error");
  }
  if (!response.ok) throw new InterpretationUnavailableError("provider_error");
  const body = transcriptSchema.safeParse(await response.json().catch(() => null));
  if (!body.success) throw new InterpretationUnavailableError("malformed");
  return { model: config.transcriptionModel, text: body.data.text.trim() };
}
