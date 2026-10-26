import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { modelSpend } from "../../services/reporting/model-spend";
import { ADA, Harness, spendDailyModelCap } from "./support/harness";
import { scriptedOpenAI, shadedPhoto } from "./support/media";

/**
 * Voice notes through the real coordinator, consent store and media job. ffmpeg and OpenAI Audio
 * are doubles here (`audio.test.ts` runs ffmpeg for real), so these tests prove the separate
 * consent gate, the limits and how a transcript enters the report, not transcription quality.
 */
let harness: Harness;
const VOICE = new Uint8Array([...new TextEncoder().encode("OggS"), ...new Array(60).fill(1)]);
const SAID = "I planted twelve baobab seedlings by the fence this morning";

beforeEach(() => {
  harness = new Harness({ controls: { voice: true } });
});

afterEach(() => {
  harness.close();
});

function voiceOn(transcripts: Array<string | null>) {
  const openai = scriptedOpenAI([], transcripts);
  harness.openai = openai.config;
  setControl(harness.core, "model_processing", true, { actor: "test", reason: "voice test" });
  return openai;
}

function sendVoice(id: string): Promise<string[]> {
  harness.mediaFiles.set(id, VOICE);
  return harness.say(ADA, "", {
    text: undefined,
    media: [{ providerMediaId: id, declaredMime: "audio/ogg; codecs=opus" }],
  });
}

function draft() {
  const row = harness.core.db.query("SELECT id FROM work_drafts").get() as { id: string };
  return loadDraft(harness.core, row.id);
}

function voiceConsents(): number {
  return (
    harness.core.db
      .query("SELECT count(*) AS n FROM consent_records WHERE purpose = 'voice'")
      .get() as { n: number }
  ).n;
}

describe("voice notes", () => {
  it("asks separately before a recording leaves the Agent, then shows what it heard", async () => {
    const openai = voiceOn([SAID, "and watered them"]);
    await sendVoice("voice-1");
    const asked = await harness.press(ADA, "I agree");
    expect(asked.join("\n")).toContain("Can I transcribe your voice notes?");
    expect(harness.audio.normalized).toBe(0);
    expect(openai.transcriptions).toEqual([]);

    const heard = await harness.press(ADA, "Yes, transcribe");
    expect(heard[0]).toBe("Thank you. I'm transcribing your voice note now.");
    expect(heard[1]).toBe(`I heard: “${SAID}”\nIf I got anything wrong, just send the correction.`);
    expect(openai.transcriptions).toEqual([
      { model: "test-transcribe", language: "en", bytes: VOICE.byteLength },
    ]);
    const content = draft()?.content;
    expect(content?.feedback).toBe(SAID);
    expect(content?.provenance.feedback).toMatchObject({
      kind: "transcribed",
      origin: "model",
      model: "test-transcribe",
      gardenerStated: false,
    });
    // The recording itself never becomes public evidence.
    expect(content?.evidence).toEqual([]);
    expect(voiceConsents()).toBe(1);

    // Consent is asked once: the next note is transcribed straight away.
    const next = await sendVoice("voice-2");
    expect(openai.transcriptions).toHaveLength(2);
    expect(next.join("\n")).not.toContain("Can I transcribe");
    expect(next[0]).toContain("I heard: “and watered them”");
    expect(modelSpend(harness.core).calls["openai:transcription:answered"]).toBe(2);
  });

  it("keeps a declined note untranscribed and returns to the open question", async () => {
    const openai = voiceOn([SAID]);
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "1");
    await harness.press(ADA, "Tree planting");
    await sendVoice("voice-1");

    const replies = await harness.press(ADA, "No, I'll type");
    expect(replies[0]).toBe("OK, I won't transcribe voice notes. Please type your update instead.");
    expect(replies.at(-1)).toContain("Seedlings planted?");
    expect(openai.transcriptions).toEqual([]);
    expect(harness.audio.normalized).toBe(0);
    expect(voiceConsents()).toBe(0);
    expect(harness.core.db.query("SELECT state FROM media_assets").get()).toEqual({
      state: "unsupported",
    });
  });

  it("answers a photo that waited with a declined note, and never counts it again", async () => {
    const empty = { observations: [], uncertain: [], facts: [] };
    harness.openai = scriptedOpenAI([empty, empty]).config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "voice test" });
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "1");
    await harness.press(ADA, "Tree planting");
    // The photo is in while the note waits for its own consent, so the batch has not ended yet.
    harness.mediaFiles.set("photo-1", await shadedPhoto(1));
    await harness.post(
      harness.message(ADA, { media: [{ providerMediaId: "photo-1", declaredMime: "image/jpeg" }] })
    );
    expect(await sendVoice("voice-1")).toEqual([
      expect.stringContaining("Can I transcribe your voice notes?"),
    ]);

    const declined = await harness.press(ADA, "No, I'll type");
    expect(declined.slice(0, 2)).toEqual([
      "OK, I won't transcribe voice notes. Please type your update instead.",
      "Photo added to your report.",
    ]);
    expect(declined.at(-1)).toContain("Seedlings planted?");
    harness.mediaFiles.set("photo-2", await shadedPhoto(2));
    const next = await harness.say(ADA, "", {
      text: undefined,
      media: [{ providerMediaId: "photo-2", declaredMime: "image/jpeg" }],
    });
    expect(next[0]).toBe("Photo added to your report.");
  });

  it("refuses a recording over two minutes without sending it anywhere", async () => {
    const openai = voiceOn([SAID]);
    await sendVoice("voice-1");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Yes, transcribe");
    openai.transcriptions.length = 0;

    harness.audio.seconds = 150;
    const replies = await sendVoice("voice-2");
    expect(replies[0]).toContain("longer than 2 minutes");
    expect(openai.transcriptions).toEqual([]);
  });

  it("retries an unavailable transcription, then explains and carries the report on", async () => {
    const openai = voiceOn([null, null, null, null, null]);
    await sendVoice("voice-1");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Yes, transcribe");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      harness.clock.advance(30_000);
      await harness.drain();
    }
    expect(openai.transcriptions).toHaveLength(5);
    // The note was all the report had to go on, so its next question follows the reason.
    expect(harness.transport.texts().slice(-2)).toEqual([
      "I couldn't transcribe that voice note. Your report is saved; please try again or type your update.",
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden",
    ]);
    expect(draft()?.content.feedback).toBeNull();
  });

  it("says voice notes are unavailable when the voice switch or model processing is off", async () => {
    setControl(harness.core, "voice", false, { actor: "operator", reason: "voice off" });
    await sendVoice("voice-1");
    expect((await harness.press(ADA, "I agree")).join("\n")).toContain(
      "Voice notes aren't supported yet"
    );

    setControl(harness.core, "voice", true, { actor: "operator", reason: "voice on" });
    const replies = await sendVoice("voice-2");
    expect(replies.join("\n")).toContain("I can't listen to voice notes right now");
    expect(voiceConsents()).toBe(0);

    // A day whose model spend reached its cap declines a note the same way, sending nothing.
    const openai = voiceOn([SAID]);
    spendDailyModelCap(harness.core);
    expect((await sendVoice("voice-3")).join("\n")).toContain(
      "I can't listen to voice notes right now"
    );
    expect(openai.transcriptions).toEqual([]);
  });
});
