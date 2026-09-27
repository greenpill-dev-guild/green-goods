import ExcelJS from "exceljs";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setControl } from "../../services/reporting/controls";
import { loadDraft } from "../../services/reporting/drafts";
import { ADA, Harness } from "./support/harness";
import { scriptedOpenAI, zip } from "./support/media";

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
  });
});

describe("limits", () => {
  it("refuses video, oversized and macro-enabled files without losing the draft", async () => {
    await plantingDraft();
    const before = draft()?.revision;
    const video = new Uint8Array([
      0,
      0,
      0,
      24,
      ...new TextEncoder().encode("ftypisom"),
      0,
      0,
      0,
      0,
    ]);
    expect((await send("clip-1", video, "video/mp4"))[0]).toContain(
      "I can't use that kind of file."
    );

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

  it("names a PDF that is too long instead of reading part of it", async () => {
    await plantingDraft();
    harness.documents.pages.set("long-report", { ok: false, reason: "too_many_pages", pages: 42 });
    const pdf = new TextEncoder().encode("%PDF-1.7 long-report");
    expect((await send("pdf-1", pdf, "application/pdf"))[0]).toContain("more than 20 pages");
  });

  it("keeps documents private and says reading is off when the capability is disabled", async () => {
    await plantingDraft();
    harness.capabilities.documents = false;
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
  async function workbook(): Promise<Uint8Array> {
    const book = new ExcelJS.Workbook();
    const sheet = book.addWorksheet("Planting");
    sheet.addRow(["Plot", "Seedlings"]);
    sheet.addRow(["North", 5]);
    sheet.addRow(["South", 4]);
    sheet.addRow(["East", 3]);
    sheet.addRow(["Total", { formula: "SUM(B2:B4)", result: 99 }]);
    const secret = book.addWorksheet("Budget");
    secret.state = "hidden";
    secret.addRow(["Salary", 1000]);
    return new Uint8Array(await book.xlsx.writeBuffer());
  }

  it("says a file was only kept, not read, while model processing is off", async () => {
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
      "I could only read part of that file. Please check the summary carefully before confirming."
    );
    expect(harness.documents.conversions).toBe(0);
  });

  it("converts Word to PDF when conversion is enabled", async () => {
    await plantingDraft();
    harness.capabilities.conversion = true;
    modelOn([]);
    await send(
      "doc-2",
      docx(),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(harness.documents.conversions).toBe(1);
    expect(
      harness.core.db.query("SELECT state FROM media_assets WHERE asset_kind = 'docx'").get()
    ).toEqual({ state: "ready" });
  });
});
