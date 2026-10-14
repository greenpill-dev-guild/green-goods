import { activeConsentId } from "../consent";
import { readControl } from "../controls";
import { inTransaction } from "../database";
import { InterpretationUnavailableError } from "../interpretation";
import { participantWriter } from "../notify";
import type { OpenAIConfig } from "../openai-responses";
import { openPrompt } from "../prompts";
import type { ReportingCore } from "../runtime";
import type { AudioTools } from "./audio";
import type { Limitation } from "./commit";
import { LocalToolError } from "./subprocess";
import { transcribeVoice } from "./transcribe";

/**
 * Voice notes: a separately enabled and separately consented path. Nothing from a recording leaves
 * the Agent until the person agrees to transcription in chat; until then the note is held
 * unprocessed. With consent it is normalized locally and sent to OpenAI Audio only, never to Jev.
 * The transcript joins the report as transcribed content that the person sees at once and can
 * correct; the recording itself is never public evidence and follows the private-file retention.
 */
export type VoiceOutcome =
  | { kind: "held" }
  | { kind: "retry" }
  | { kind: "limitation"; limitation: Limitation }
  | { kind: "heard"; text: string; model: string; seconds: number };

export interface VoiceDeps {
  core: ReportingCore;
  audio: AudioTools;
  openai: (OpenAIConfig & { transcriptionModel?: string | null }) | null;
}

interface VoiceAsset {
  id: string;
  conversationId: string;
  participantId: string;
  sourceEntryId: string;
}

function limitation(value: Limitation): VoiceOutcome {
  return { kind: "limitation", limitation: value };
}

/** Holds the note and asks once, whatever the number of notes waiting for the same answer. */
function holdForConsent(core: ReportingCore, asset: VoiceAsset, subjectId: string): void {
  inTransaction(core.db, () => {
    core.db
      .query(
        `UPDATE media_assets SET state = 'quarantined', asset_kind = 'audio', updated_at = $now
         WHERE id = $id`
      )
      .run({ id: asset.id, now: core.clock.now() });
    if (openPrompt(core, asset.conversationId)?.kind === "voice_consent") return;
    const writer = participantWriter(core, {
      participantId: asset.participantId,
      conversationId: asset.conversationId,
      dedupePrefix: `voice-consent:${asset.id}`,
    });
    writer?.ask(
      {
        subjectKind: "consent",
        resourceId: subjectId,
        resourceRevision: null,
        kind: "voice_consent",
        options: [
          { id: "agree", label: writer.text("voice.agree"), value: "agree" },
          { id: "decline", label: writer.text("voice.decline"), value: "decline" },
        ],
      },
      () => writer.text("voice.consent")
    );
  });
}

export async function hearVoiceNote(
  deps: VoiceDeps,
  asset: VoiceAsset,
  input: { bytes: Uint8Array; mime: string; locale: string; lastAttempt: boolean }
): Promise<VoiceOutcome> {
  const { core, openai } = deps;
  const transcriptionModel = openai?.transcriptionModel;
  if (!openai || !transcriptionModel || !readControl(core, "model_processing").enabled) {
    return limitation("media.voicePaused");
  }
  const source = core.db
    .query("SELECT channel_subject_id FROM source_entries WHERE id = $id")
    .get({ id: asset.sourceEntryId }) as { channel_subject_id: string } | null;
  if (!source) return limitation("media.unsupported");
  if (!activeConsentId(core, source.channel_subject_id, "voice")) {
    holdForConsent(core, asset, source.channel_subject_id);
    return { kind: "held" };
  }

  let normalized: Awaited<ReturnType<AudioTools["normalize"]>>;
  try {
    normalized = await deps.audio.normalize(input.bytes, input.mime);
  } catch (error) {
    // Missing ffmpeg is an unavailable capability, not a problem with this recording.
    if (error instanceof LocalToolError && error.reason === "unavailable") {
      return limitation("media.voicePaused");
    }
    return limitation("media.unreadable");
  }
  if (!normalized.ok) {
    return limitation(normalized.reason === "too_long" ? "media.voiceTooLong" : "media.unreadable");
  }

  try {
    const heard = await transcribeVoice(
      { ...openai, transcriptionModel },
      { wav: normalized.wav, locale: input.locale },
      AbortSignal.timeout(60_000)
    );
    if (!heard.text) return limitation("media.voiceEmpty");
    return { kind: "heard", text: heard.text, model: heard.model, seconds: normalized.seconds };
  } catch (error) {
    if (!(error instanceof InterpretationUnavailableError)) throw error;
    return input.lastAttempt ? limitation("media.voiceFailed") : { kind: "retry" };
  }
}
