import ExcelJS from "exceljs";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { currentConfirmation } from "../../services/reporting/confirmations";
import { setControl } from "../../services/reporting/controls";
import { ALBUM_QUIET_MS } from "../../services/reporting/coordinator/context";
import { lifecycleState } from "../../services/reporting/coordinator/draft-commit";
import { loadDraft } from "../../services/reporting/drafts";
import { modelSpend } from "../../services/reporting/model-spend";
import { planting, snapshot, TAS } from "./support/fixtures";
import { reportUntilSummary } from "./support/flows";
import { ADA, Harness, spendDailyModelCap, summaryToken } from "./support/harness";
import { evidenceFiles, scriptedOpenAI, shadedPhoto, VIDEO_CLIP, zip } from "./support/media";

/**
 * Attachments through the real coordinator, stores and media job. Photos run through Sharp for
 * real; provider downloads, document tools and the OpenAI endpoint are doubles, so these tests
 * prove handling and limits, not model quality or converter fidelity.
 */
let harness: Harness;

beforeEach(() => {
  harness = new Harness();
});

afterEach(() => {
  harness.close();
});

async function plantingDraft(): Promise<void> {
  await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
  await harness.press(ADA, "I agree");
  await harness.say(ADA, "1");
  await harness.press(ADA, "Tree planting");
}

async function send(id: string, bytes: Uint8Array, mime: string, text?: string): Promise<string[]> {
  harness.mediaFiles.set(id, bytes);
  return harness.say(ADA, text ?? "", {
    ...(text ? {} : { text: undefined }),
    media: [{ providerMediaId: id, declaredMime: mime }],
  });
}

function draft() {
  const row = harness.core.db.query("SELECT id FROM work_drafts").get() as { id: string };
  return loadDraft(harness.core, row.id);
}

async function photoWithLocation(): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width: 64, height: 48, channels: 3, background: "#2d6a4f" } })
      .withExif({ IFD0: { Artist: "Ada", Copyright: "private" } })
      .jpeg()
      .toBuffer()
  );
}

describe("photos", () => {
  it("keeps the original private, strips metadata and adds the sanitized photo as evidence", async () => {
    await plantingDraft();
    const replies = await send("photo-1", await photoWithLocation(), "image/jpeg");
    expect(replies[0]).toBe("Photo added to your report.");
    expect(replies[1]).toContain("Seedlings planted?");

    const [evidence] = draft()?.content.evidence ?? [];
    expect(evidence?.mime).toBe("image/jpeg");
    const asset = harness.core.db
      .query(
        "SELECT state, source_digest, sanitized_digest, sanitized_object_ciphertext FROM media_assets"
      )
      .get() as Record<string, string>;
    expect(asset.state).toBe("ready");
    expect(asset.sanitized_digest).toBe(evidence?.sanitizedDigest);
    expect(asset.sanitized_digest).not.toBe(asset.source_digest);
    const key = harness.core.keyring.open(
      asset.sanitized_object_ciphertext as string,
      `media_assets.sanitized:${evidence?.assetId}`
    );
    const sanitized = await harness.media().get(key, `sanitized:${evidence?.assetId}`);
    const metadata = await sharp(sanitized).metadata();
    expect(metadata.exif).toBeUndefined();
    expect(metadata.format).toBe("jpeg");
  });

  it("adds a photo when the garden's activities cannot be read", async () => {
    await plantingDraft();
    harness.catalog.eligibleActions = async () => {
      throw new Error("activities unreachable");
    };
    const replies = await send("photo-1", await photoWithLocation(), "image/jpeg");
    expect(replies[0]).toBe("Photo added to your report.");
    expect(draft()?.content.evidence).toHaveLength(1);
  });

  it("proposes only observed values from a photo and leaves time for the gardener", async () => {
    await plantingDraft();
    const openai = scriptedOpenAI([
      {
        observations: ["Seedlings planted in a row along a fence"],
        uncertain: ["Some seedlings are partly hidden"],
        facts: [
          {
            field: "details.seedlings",
            value: 12,
            page: null,
            cell: null,
            sumRange: null,
            original: null,
            unit: "seedlings",
          },
        ],
      },
    ]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "media test" });
    await send("photo-1", await photoWithLocation(), "image/jpeg");
    const provenance = draft()?.content.provenance["details.seedlings"];
    expect(provenance).toMatchObject({ kind: "observed", origin: "model", gardenerStated: false });
    expect(provenance?.sources[0]?.assetId).toBeDefined();
    const schema = (
      openai.requests[0]?.text as {
        format: {
          schema: {
            properties: { facts: { items: { properties: { field: { enum: string[] } } } } };
          };
        };
      }
    ).format.schema.properties.facts.items.properties.field.enum;
    expect(schema).not.toContain("timeSpentMinutes");
    expect(modelSpend(harness.core).calls).toEqual({ "openai:media:answered": 1 });
  });
});

describe("limits", () => {
  it("refuses video, oversized and macro-enabled files without losing the draft", async () => {
    await plantingDraft();
    const before = draft()?.revision;
    // The question that was open stays as it is: only the reason is sent.
    const refused = await send("clip-1", VIDEO_CLIP, "video/mp4");
    expect(refused).toHaveLength(1);
    expect(refused[0]).toContain("I can't use that kind of file.");

    harness.mediaFiles.set("big-1", new Uint8Array(1));
    const tooBig = await harness.say(ADA, "", {
      text: undefined,
      media: [
        {
          providerMediaId: "big-1",
          declaredMime: "application/pdf",
          declaredSize: 11 * 1024 * 1024,
        },
      ],
    });
    expect(tooBig[0]).toContain("larger than 10 MB");

    const macro = zip({
      "[Content_Types].xml":
        '<Types><Default ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/></Types>',
      "xl/workbook.xml": "<workbook/>",
      "xl/vbaProject.bin": "binary",
    });
    expect((await send("macro-1", macro, "application/vnd.ms-excel"))[0]).toContain(
      "I couldn't read that file."
    );
    expect(draft()?.revision).toBe(before);
  });

  it("puts the report's next question after a first file it cannot use", async () => {
    // The file opens the chat, so it waits for consent and is looked at once that is given.
    await send("clip-1", VIDEO_CLIP, "video/mp4");
    expect((await harness.press(ADA, "I agree")).slice(-2)).toEqual([
      "I can't use that kind of file. Your report is saved; send photos (JPEG, PNG or WebP), a PDF, a Word or Excel file, a CSV, or type the details.",
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden",
    ]);
  });

  it("puts the next question after a file it cannot use whose caption answered the open one", async () => {
    await plantingDraft();
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "caption" });
    harness.interpreter.responses = [
      {
        intent: "report_content",
        gardenKey: null,
        actionUID: null,
        facts: [{ field: "details.seedlings", value: 12, kind: "reported", original: "12" }],
        models: ["fixture-model"],
      },
    ];
    const replies = await send("clip-3", VIDEO_CLIP, "video/mp4", "12 seedlings");
    expect(replies).toHaveLength(2);
    expect(replies[0]).toContain("I can't use that kind of file.");
    expect(replies[1]).toContain("Main species");
    expect(draft()?.content.details.seedlings).toBe(12);
  });

  it("names a PDF that is too long instead of reading part of it", async () => {
    await plantingDraft();
    harness.documents.pages.set("long-report", { ok: false, reason: "too_many_pages", pages: 42 });
    const pdf = new TextEncoder().encode("%PDF-1.7 long-report");
    expect((await send("pdf-1", pdf, "application/pdf"))[0]).toContain("more than 20 pages");
  });

  it("keeps documents private and says reading is off when the documents switch is off", async () => {
    await plantingDraft();
    setControl(harness.core, "documents", false, { actor: "operator", reason: "documents off" });
    const pdf = new TextEncoder().encode("%PDF-1.7 site report");
    expect((await send("pdf-2", pdf, "application/pdf"))[0]).toContain(
      "reading documents is turned off"
    );
  });

  it("retries a failed download within the job budget", async () => {
    await plantingDraft();
    harness.mediaFailures.remaining = 1;
    harness.mediaFiles.set("photo-2", await photoWithLocation());
    await harness.say(ADA, "", {
      text: undefined,
      media: [{ providerMediaId: "photo-2", declaredMime: "image/jpeg" }],
    });
    expect(draft()?.content.evidence).toHaveLength(0);
    harness.clock.advance(20_000);
    await harness.drain();
    expect(draft()?.content.evidence).toHaveLength(1);
  });
});

describe("spreadsheets", () => {
  async function workbook(hidden = true): Promise<Uint8Array> {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Planting");
    sheet.addRow(["Plot", "Seedlings"]);
    sheet.addRow(["North", 5]);
    sheet.addRow(["South", 4]);
    sheet.addRow(["East", 3]);
    sheet.addRow(["Total", { formula: "SUM(B2:B4)", result: 99 }]);
    if (hidden) {
      const secret = book.addWorksheet("Budget");
      secret.state = "hidden";
      secret.addRow(["Salary", 1000]);
    }
    return new Uint8Array(await book.xlsx.writeBuffer());
  }

  it("says a file was only kept, not read, while model processing is off or its spend is capped", async () => {
    await plantingDraft();
    const replies = await send(
      "sheet-1",
      await workbook(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(replies).toContain("I saved your file privately. I'll ask you for the details instead.");
    expect(replies).not.toContain("I read your file and added what I could to your report.");
    expect(replies.at(-1)).toContain("Seedlings planted?");
    expect(draft()?.content.details.seedlings).toBeUndefined();

    // Once the day's model spend reaches its cap, a file is kept unread the same way.
    const openai = scriptedOpenAI([]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "spend cap" });
    spendDailyModelCap(harness.core);
    const capped = await send(
      "sheet-2",
      await workbook(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(capped).toContain("I saved your file privately. I'll ask you for the details instead.");
    expect(openai.requests).toHaveLength(0);
  });

  it("computes totals from visible literal cells, never from a cached formula or the model", async () => {
    await plantingDraft();
    const openai = scriptedOpenAI([
      {
        observations: [],
        uncertain: [],
        facts: [
          {
            field: "details.seedlings",
            value: 99,
            page: null,
            cell: null,
            sumRange: "Planting!B2:B5",
            original: "Seedlings",
            unit: "seedlings",
          },
        ],
      },
    ]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "media test" });
    const replies = await send(
      "sheet-1",
      await workbook(),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    expect(draft()?.content.details.seedlings).toBe(12);
    expect(draft()?.content.provenance["details.seedlings"]).toMatchObject({
      kind: "computed",
      sources: [expect.objectContaining({ location: "Planting!B2:B5" })],
    });
    expect(replies).toContain(
      "Some sheets, rows or columns in your spreadsheet were hidden, so I left them out."
    );
    const sent = JSON.stringify(openai.requests[0]);
    expect(sent).toContain("Planting!B2\\t5");
    expect(sent).not.toContain("Salary");
    expect(harness.documents.conversions).toBe(0);
    expect(sent).not.toContain('"type":"input_file"');
  });

  it("includes a bounded Excel PDF preview and still computes values from the native cells", async () => {
    await plantingDraft();
    harness.documents.converts = true;
    const openai = scriptedOpenAI([
      {
        observations: [],
        uncertain: [],
        facts: [
          {
            field: "details.seedlings",
            value: 999,
            page: null,
            cell: null,
            sumRange: "Planting!B2:B4",
            original: "Seedlings",
            unit: "seedlings",
          },
        ],
      },
    ]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "office preview" });
    const replies = await send(
      "sheet-preview",
      await workbook(false),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(harness.documents.conversions).toBe(1);
    expect(draft()?.content.details.seedlings).toBe(12);
    expect(JSON.stringify(openai.requests[0])).toContain("spreadsheet-preview.pdf");
    expect(replies).not.toContain(
      "I read the spreadsheet's visible cells, but couldn't read its pictures or charts. Please check the summary before confirming."
    );
  });

  it("keeps native Excel cells and names the limitation when the preview exceeds the page budget", async () => {
    await plantingDraft();
    harness.documents.converts = true;
    harness.documents.pages.set("converted", { ok: false, reason: "too_many_pages", pages: 21 });
    const openai = scriptedOpenAI([{ observations: [], uncertain: [], facts: [] }]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "office budget" });
    const replies = await send(
      "sheet-overlong",
      await workbook(false),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(JSON.stringify(openai.requests[0])).not.toContain("spreadsheet-preview.pdf");
    expect(replies).toContain(
      "I read the spreadsheet's visible cells, but couldn't read its pictures or charts. Please check the summary before confirming."
    );
  });
});

describe("documents", () => {
  const docx = () =>
    zip({
      "[Content_Types].xml": "<Types/>",
      "word/document.xml": "<w:document>Planting log</w:document>",
    });

  function modelOn(facts: unknown[]) {
    const openai = scriptedOpenAI([{ observations: [], uncertain: [], facts }]);
    harness.openai = openai.config;
    setControl(harness.core, "model_processing", true, { actor: "test", reason: "documents" });
    return openai;
  }

  it("keeps page provenance for values read from a PDF", async () => {
    await plantingDraft();
    harness.documents.pages.set("planting-log", { ok: true, pages: 3 });
    const openai = modelOn([
      {
        field: "details.seedlings",
        value: 12,
        page: 2,
        cell: null,
        sumRange: null,
        original: "12 seedlings",
        unit: "seedlings",
      },
    ]);
    await send("pdf-1", new TextEncoder().encode("%PDF-1.7 planting-log"), "application/pdf");
    expect(draft()?.content.provenance["details.seedlings"]).toMatchObject({
      kind: "transcribed",
      sources: [expect.objectContaining({ location: "page 2" })],
    });
    const sent = JSON.stringify(openai.requests[0]);
    expect(sent).toContain('"type":"input_file"');
    expect(sent).toContain('\\"pages\\":3');
  });

  it("reads Word text natively and says embedded pictures were not read", async () => {
    await plantingDraft();
    modelOn([
      {
        field: "feedback",
        value: "Planting log",
        page: null,
        cell: null,
        sumRange: null,
        original: null,
        unit: null,
      },
    ]);
    const replies = await send(
      "doc-1",
      docx(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(replies).toContain(
      "I read the Word document's text, but couldn't read its pictures or charts. Please check the summary before confirming."
    );
    expect(harness.documents.conversions).toBe(0);
  });

  it("converts Word to PDF when LibreOffice is available", async () => {
    await plantingDraft();
    harness.documents.converts = true;
    modelOn([]);
    const replies = await send(
      "doc-2",
      docx(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(harness.documents.conversions).toBe(1);
    expect(replies).not.toContain(
      "I could only read part of that file. Please check the summary carefully before confirming."
    );
    expect(
      harness.core.db.query("SELECT state FROM media_assets WHERE asset_kind = 'docx'").get()
    ).toEqual({ state: "ready" });
  });
});

describe("albums", () => {
  /**
   * Sends an album as Telegram does: one event per file, in the order given, nothing run yet.
   * Each file is a photo of its own unless it names other bytes, or is missing from the provider.
   */
  async function postAlbum(
    album: string,
    files: Array<{
      message: number;
      caption?: string;
      missing?: boolean;
      file?: { bytes: Uint8Array; mime: string; declaredSize?: number };
    }>
  ): Promise<void> {
    for (const { message, caption, missing, file } of files) {
      const id = `${album}-${message}`;
      if (!missing) harness.mediaFiles.set(id, file?.bytes ?? (await shadedPhoto(message)));
      const declared = file?.declaredSize ? { declaredSize: file.declaredSize } : {};
      await harness.post(
        harness.message(ADA, {
          providerMessageId: String(message),
          mediaGroupId: album,
          media: [{ providerMediaId: id, declaredMime: file?.mime ?? "image/jpeg", ...declared }],
          ...(caption ? { text: caption } : {}),
        })
      );
    }
  }

  /** Runs every queue once an album has gone quiet, after checking nothing is sent before. */
  async function whenQuiet(): Promise<string[]> {
    const before = harness.transport.sent.length;
    await harness.drain();
    expect(harness.transport.sent.length).toBe(before);
    harness.clock.advance(ALBUM_QUIET_MS);
    await harness.drain();
    return harness.transport.texts().slice(before);
  }

  const KEPT = "This activity accepts up to 3 photos, so your report keeps the first 3 you sent.";

  it("keeps the first photos an activity accepts, whether they came before it or after", async () => {
    await harness.say(ADA, "Today I planted twelve baobab seedlings by the fence");
    await harness.press(ADA, "I agree");
    await harness.say(ADA, "1");
    await postAlbum(
      "before",
      [21, 22, 23, 24].map((message) => ({ message }))
    );
    const added = await whenQuiet();
    expect(added).toHaveLength(2);
    expect(added[0]).toBe("4 photos added to your report.");
    expect(added[1]).toContain("Which activity in TAS");

    // Tree planting accepts three, so choosing it takes the photo sent last off the report.
    expect(await harness.press(ADA, "Tree planting")).toContain(KEPT);
    expect(evidenceFiles(harness.core, draft())).toEqual(["before-21", "before-22", "before-23"]);

    // An album with no room left changes nothing; it is named and the question put again.
    const revision = draft()?.revision;
    await postAlbum("after", [{ message: 31 }, { message: 32 }]);
    const full = await whenQuiet();
    expect(full).toHaveLength(2);
    expect(full[0]).toBe(KEPT);
    expect(full[1]).toContain("Seedlings planted?");
    expect(draft()?.revision).toBe(revision);
    expect(evidenceFiles(harness.core, draft())).toEqual(["before-21", "before-22", "before-23"]);
  });

  it("withdraws a summary or confirmation when photos follow it, until they are in", async () => {
    const shown = await reportUntilSummary(harness);
    await postAlbum("late", [{ message: 41 }, { message: 42 }]);
    await harness.drain();
    harness.clock.advance(ALBUM_QUIET_MS);
    // Confirm on the summary the album followed confirms nothing; the new one shows both photos.
    const pressed = await harness.press(ADA, "Confirm");
    expect(pressed.slice(0, 2)).toEqual([
      "I'm still adding your files. I'll show you the summary as soon as they're in.",
      "2 photos added to your report.",
    ]);
    expect(pressed[2]).toContain("• Photos: 2");
    expect(summaryToken(pressed)).not.toBe(summaryToken(shown));
    const id = draft()?.id as string;
    expect(currentConfirmation(harness.core, { draftId: id })).toBeNull();

    // A confirmation waiting on the account is withdrawn as the next photo arrives, before it
    // has even downloaded, so it cannot be published without that photo.
    await harness.say(ADA, `CONFIRM ${summaryToken(pressed)}`);
    expect(currentConfirmation(harness.core, { draftId: id })).not.toBeNull();
    harness.mediaFailures.remaining = 1;
    await postAlbum("later", [{ message: 43 }]);
    expect(await whenQuiet()).toEqual([]);
    expect(currentConfirmation(harness.core, { draftId: id })).toBeNull();
    expect(lifecycleState(draft() as NonNullable<ReturnType<typeof draft>>)).toBe("review");
    harness.clock.advance(20_000);
    await harness.drain();
    expect(harness.transport.texts().slice(-2)[0]).toBe("Photo added to your report.");
    expect(harness.transport.texts().at(-1)).toContain("• Photos: 3");
  });

  it("puts the summary again after an album of files it can use none of", async () => {
    const shown = await reportUntilSummary(harness);
    await postAlbum("unusable", [
      { message: 91, file: { bytes: VIDEO_CLIP, mime: "video/mp4" } },
      {
        message: 92,
        file: { bytes: new Uint8Array(1), mime: "application/pdf", declaredSize: 11 * 1024 * 1024 },
      },
    ]);
    // Each file's reason, then a summary that can be confirmed: the one shown before the album
    // was withdrawn when it arrived.
    const replies = await whenQuiet();
    expect(replies).toHaveLength(3);
    expect(replies[0]).toContain("I can't use that kind of file.");
    expect(replies[1]).toContain("larger than 10 MB");
    expect(replies[2]).toContain("• Photos: 0");
    expect(summaryToken(replies)).not.toBe(summaryToken(shown));
    await harness.say(ADA, `CONFIRM ${summaryToken(replies)}`);
    expect(currentConfirmation(harness.core, { draftId: draft()?.id as string })).not.toBeNull();
  });

  it("reads an album that keeps arriving after a bounded wait, and a late photo on its own", async () => {
    harness.catalog.actions.set(TAS.key, [
      snapshot(planting({ media: { required: false, minImageCount: 0, maxImageCount: 10 } })),
    ]);
    await plantingDraft();
    // A photo every 1.9 seconds never leaves the album quiet; it is read 10 seconds in anyway.
    const before = harness.transport.sent.length;
    for (const message of [51, 52, 53, 54, 55, 56]) {
      if (message > 51) harness.clock.advance(1_900);
      await postAlbum("slow", [{ message }]);
      await harness.drain();
    }
    expect(harness.transport.sent.length).toBe(before);
    // The album held back is in the database, so a restart while it waits loses none of it.
    harness.restart();
    harness.clock.advance(500);
    await harness.drain();
    const read = harness.transport.texts().slice(before);
    expect(read).toHaveLength(2);
    expect(read[0]).toBe("6 photos added to your report.");

    // The same album's photo arriving after that is a message of its own; nothing repeats.
    await postAlbum("slow", [{ message: 57 }]);
    const late = await whenQuiet();
    expect(late).toHaveLength(2);
    expect(late[0]).toBe("Photo added to your report.");
    expect(evidenceFiles(harness.core, draft())).toEqual(
      [51, 52, 53, 54, 55, 56, 57].map((message) => `slow-${message}`)
    );
  });

  it("takes a caption that is a command first, then reads the album's other photos together", async () => {
    await plantingDraft();
    const cancelled = draft()?.id as string;
    // The caption arrives on the album's second photo; the first must not join the report it
    // cancels, nor the third start another alone.
    await postAlbum("cancel", [
      { message: 81 },
      { message: 82, caption: "CANCEL" },
      { message: 83 },
    ]);
    expect(await whenQuiet()).toEqual([
      "Report canceled. Unpublished content will be removed.",
      "2 photos added to your report.",
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden",
    ]);
    const next = harness.core.db
      .query("SELECT id FROM work_drafts WHERE id <> $cancelled")
      .get({ cancelled }) as { id: string };
    // The photo carrying the command goes with it, as a captioned photo always has.
    expect(evidenceFiles(harness.core, loadDraft(harness.core, next.id))).toEqual([
      "cancel-81",
      "cancel-83",
    ]);
  });

  it("holds a first-contact album for consent, reads it once and names a photo it cannot fetch", async () => {
    await postAlbum("first", [{ message: 61 }, { message: 62 }, { message: 63, missing: true }]);
    const notice = await whenQuiet();
    expect(notice).toHaveLength(1);
    expect(notice[0]).toContain("Do you agree?");

    expect(await harness.press(ADA, "I agree")).toEqual([
      "Thank you! Tell me about the work you did. You can send text and photos.",
    ]);
    // The photo that cannot be fetched is retried within the job's budget, then named; the
    // photos that arrived are answered once, with the report's next question.
    const before = harness.transport.sent.length;
    for (let retry = 0; retry < 4; retry += 1) {
      harness.clock.advance(20_000);
      await harness.drain();
    }
    expect(harness.transport.texts().slice(before)).toEqual([
      "I couldn't download your file. Please send it again.",
      "2 photos added to your report.",
      "Which garden is this report for?\n1. TAS\n2. Aiyeloja Family Garden",
    ]);
    expect(evidenceFiles(harness.core, draft())).toEqual(["first-61", "first-62"]);
  });
});
