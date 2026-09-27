import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { ADA, Harness } from "./support/harness";
import { scriptedOpenAI } from "./support/media";

/**
 * Voice notes through the real coordinator, consent store and media job. ffmpeg and OpenAI Audio
 * are doubles here (`audio.test.ts` runs ffmpeg for real), so these tests prove the separate
 * consent gate, the limits and how a transcript enters the report, not transcription quality.
 */
let harness: Harness;
const VOICE = new Uint8Array([...new TextEncoder().encode("OggS"), ...new Array(60).fill(1)]);
const SAID = "I planted twelve baobab seedlings by the fence this morning";

beforeEach(() => {
  harness = new Harness();
  harness.capabilities.voice = true;
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

  it("retries an unavailable transcription, then explains and keeps the report", async () => {
    const openai = voiceOn([null, null, null, null, null]);
    await sendVoice("voice-1");
    await harness.press(ADA, "I agree");
    await harness.press(ADA, "Yes, transcribe");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      harness.clock.advance(30_000);
      await harness.drain();
    }
    expect(openai.transcriptions).toHaveLength(5);
    expect(harness.transport.sent.at(-1)?.message.text).toContain(
      "I couldn't transcribe that voice note. Your report is saved"
    );
    expect(draft()?.content.feedback).toBeNull();
  });

  it("says voice notes are unavailable when the capability or model processing is off", async () => {
    harness.capabilities.voice = false;
    await sendVoice("voice-1");
    expect((await harness.press(ADA, "I agree")).join("\n")).toContain(
      "Voice notes aren't supported yet"
    );

    harness.capabilities.voice = true;
    const replies = await sendVoice("voice-2");
    expect(replies.join("\n")).toContain("I can't listen to voice notes right now");
    expect(voiceConsents()).toBe(0);
  });
});
