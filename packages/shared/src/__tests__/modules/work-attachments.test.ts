import { describe, expect, it, vi } from "vitest";
import {
  captureWorkFile,
  documentMatchesType,
  isHeicFile,
  isWorkPhoto,
  readPublishedWorkDocuments,
  validateWorkAttachments,
  roundWorkLocation,
  validateWorkVideo,
  workDocumentType,
} from "../../modules/work/work-attachments";

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * A zip whose central directory lists `names`, each stored empty, with `comment` after its end.
 * Its local records carry `localNames`, which a well-formed zip keeps the same as `names`.
 */
function zipArchive(names: string[], comment = "", localNames = names): Uint8Array {
  const encoder = new TextEncoder();
  const out: number[] = [];
  const le16 = (value: number) => [value & 0xff, (value >> 8) & 0xff];
  const le32 = (value: number) => [...le16(value & 0xffff), ...le16(value >>> 16)];
  const offsets = localNames.map((name) => {
    const offset = out.length;
    const bytes = [...encoder.encode(name)];
    out.push(...le32(0x04034b50), ...le16(20), ...le16(0), ...le16(0), ...le16(0), ...le16(0));
    out.push(...le32(0), ...le32(0), ...le32(0), ...le16(bytes.length), ...le16(0), ...bytes);
    return offset;
  });
  const start = out.length;
  names.forEach((name, index) => {
    const bytes = [...encoder.encode(name)];
    out.push(...le32(0x02014b50), ...le16(20), ...le16(20), ...le16(0), ...le16(0), ...le16(0));
    out.push(...le16(0), ...le32(0), ...le32(0), ...le32(0), ...le16(bytes.length), ...le16(0));
    out.push(...le16(0), ...le16(0), ...le16(0), ...le32(0), ...le32(offsets[index]), ...bytes);
  });
  const size = out.length - start;
  const note = [...encoder.encode(comment)];
  out.push(...le32(0x06054b50), ...le16(0), ...le16(0), ...le16(names.length));
  out.push(...le16(names.length), ...le32(size), ...le32(start), ...le16(note.length), ...note);
  return new Uint8Array(out);
}

/** A compound file of 512-byte sectors: its header, one allocation sector, one directory sector. */
function compoundFile(entries: Array<{ name: string; type: number }>): Uint8Array {
  const file = new Uint8Array(512 * 3);
  const view = new DataView(file.buffer);
  file.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  view.setUint16(0x18, 0x3e, true);
  view.setUint16(0x1a, 3, true);
  view.setUint16(0x1c, 0xfffe, true);
  view.setUint16(0x1e, 9, true);
  view.setUint16(0x20, 6, true);
  view.setUint32(0x2c, 1, true);
  view.setUint32(0x30, 1, true);
  view.setUint32(0x38, 4096, true);
  view.setUint32(0x3c, 0xfffffffe, true);
  view.setUint32(0x44, 0xfffffffe, true);
  for (let index = 0; index < 109; index++)
    view.setUint32(0x4c + index * 4, index === 0 ? 0 : 0xffffffff, true);
  for (let index = 0; index < 128; index++) view.setUint32(512 + index * 4, 0xffffffff, true);
  view.setUint32(512, 0xfffffffd, true);
  view.setUint32(516, 0xfffffffe, true);
  [{ name: "Root Entry", type: 5 }, ...entries].slice(0, 4).forEach(({ name, type }, index) => {
    const entry = 1024 + index * 128;
    Array.from(name).forEach((c, at) => view.setUint16(entry + at * 2, c.charCodeAt(0), true));
    view.setUint16(entry + 0x40, (name.length + 1) * 2, true);
    file[entry + 0x42] = type;
  });
  return file;
}

describe("work attachment boundaries", () => {
  it("copies bytes before the original picker file becomes unreadable", async () => {
    const original = new File(["photo"], "photo.jpg", { type: "image/jpeg" });
    const captured = await captureWorkFile(original);
    original.arrayBuffer = async () => {
      throw new DOMException("revoked", "NotReadableError");
    };
    expect(await captured.text()).toBe("photo");
  });
  it("accepts videos but does not count them as required photos", () => {
    const video = new File(["clip"], "clip.mp4", { type: "video/mp4" });
    expect(validateWorkAttachments([video], [], 0)).toEqual([]);
    expect(validateWorkAttachments([video], [], 1)).toContain("photos-required");
  });
  it("counts a JPEG, PNG or WebP as a photo, and a waiting HEIC only where one is kept", () => {
    const file = (name: string, type: string) => new File(["x"], name, { type });
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      expect(isWorkPhoto(file("garden", type))).toBe(true);
    }
    expect(isWorkPhoto(file("clip.mp4", "video/mp4"))).toBe(false);
    expect(isWorkPhoto(file("garden.heic", "image/heic"))).toBe(false);
    expect(isWorkPhoto(file("garden.heic", "image/heic"), { pendingHeic: "accept" })).toBe(true);
  });
  it("recognises a HEIC photo by type or by name, since Android often reports no type", () => {
    expect(isHeicFile(new File(["h"], "garden.heic", { type: "image/heic" }))).toBe(true);
    expect(isHeicFile(new File(["h"], "garden.HEIF", { type: "" }))).toBe(true);
    expect(isHeicFile(new File(["h"], "burst", { type: "image/heif-sequence" }))).toBe(true);
    expect(isHeicFile(new File(["j"], "garden.jpg", { type: "image/jpeg" }))).toBe(false);
  });
  it("trusts a known type over the name, so a JPEG named .heic stays a JPEG", () => {
    expect(isHeicFile(new File(["j"], "renamed.heic", { type: "image/jpeg" }))).toBe(false);
    expect(isHeicFile(new File(["h"], "download.heic", { type: "application/octet-stream" }))).toBe(
      true
    );
  });
  it("refuses a HEIC photo by default, so nothing uploads an unconverted original", () => {
    const heic = new File(["h"], "garden.heic", { type: "image/heic" });
    expect(validateWorkAttachments([heic], [], 1)).toEqual(["photos-required", "media-type"]);
  });
  it("lets a composer keep a HEIC photo that is waiting for the decoder", () => {
    const heic = new File(["h"], "garden.heic", { type: "" });
    const jpeg = new File(["j"], "garden.jpg", { type: "image/jpeg" });
    const policy = { pendingHeic: "accept" } as const;
    // A pending photo still counts toward the action's minimum: it will be a JPEG before it sends.
    expect(validateWorkAttachments([heic, jpeg], [], 2, policy)).toEqual([]);
    const oversized = new File(["h"], "big.heic", { type: "image/heic" });
    Object.defineProperty(oversized, "size", { value: 10 * 1024 * 1024 + 1 });
    expect(validateWorkAttachments([oversized], [], 0, policy)).toEqual(["media-size"]);
  });
  it("rounds location and drops precise accuracy", () => {
    expect(roundWorkLocation({ lat: 10.123456, lng: -20.987654, accuracy: 2 })).toEqual({
      lat: 10.123,
      lng: -20.988,
    });
  });
  it("enforces binary byte, count, and format boundaries", () => {
    const sized = (type: string, size: number) => {
      const file = new File(["x"], "attachment", { type });
      Object.defineProperty(file, "size", { value: size });
      return file;
    };
    const mib = 1024 * 1024;
    expect(validateWorkAttachments([sized("image/jpeg", 10 * mib)])).toEqual([]);
    expect(validateWorkAttachments([sized("image/jpeg", 10 * mib + 1)])).toContain("media-size");
    expect(validateWorkAttachments([sized("video/mp4", 20 * mib)])).toEqual([]);
    expect(validateWorkAttachments([sized("video/mp4", 20 * mib + 1)])).toContain("media-size");
    expect(validateWorkAttachments([sized("video/quicktime", 1)])).toContain("media-type");
    expect(
      validateWorkAttachments(Array.from({ length: 11 }, () => sized("image/png", 1)))
    ).toContain("media-count");
    expect(
      validateWorkAttachments(
        [sized("video/mp4", 20 * mib), sized("video/webm", 20 * mib)],
        [sized("audio/webm", 10 * mib)]
      )
    ).toEqual([]);
    expect(
      validateWorkAttachments(
        [sized("video/mp4", 20 * mib), sized("video/webm", 20 * mib)],
        [sized("audio/webm", 10 * mib + 1)]
      )
    ).toContain("total-size");
  });
  it("names a document by its type, or by its extension when the picker reports none", () => {
    const file = (name: string, type: string) => new File(["x"], name, { type });
    expect(workDocumentType(file("certificate.pdf", "application/pdf"))).toBe("application/pdf");
    expect(workDocumentType(file("report.md", ""))).toBe("text/markdown");
    expect(workDocumentType(file("report.MD", "text/x-markdown"))).toBe("text/markdown");
    expect(workDocumentType(file("notes.txt", "text/plain"))).toBe("text/plain");
    expect(workDocumentType(file("permit.doc", "application/msword"))).toBe("application/msword");
    expect(workDocumentType(file("permit.docx", "application/octet-stream"))).toBe(DOCX);
    // A photo named .pdf stays a photo, a web page named .txt is not text, and a sheet is no document.
    expect(workDocumentType(file("garden.pdf", "image/jpeg"))).toBeNull();
    expect(workDocumentType(file("page.txt", "text/html"))).toBeNull();
    expect(workDocumentType(file("sheet.xlsx", ""))).toBeNull();
  });
  it("keeps a document only when its bytes are what its type says", () => {
    const text = (value: string) => new TextEncoder().encode(value);
    const bytes = (...values: number[]) => new Uint8Array(values);
    const WORD = "application/msword";
    expect(documentMatchesType("application/pdf", text("%PDF-1.7"))).toBe(true);
    expect(documentMatchesType("application/pdf", text("<html><script>"))).toBe(false);
    expect(
      documentMatchesType(
        DOCX,
        zipArchive(["[Content_Types].xml", "_rels/.rels", "word/document.xml"])
      )
    ).toBe(true);
    expect(documentMatchesType(DOCX, zipArchive(["[Content_Types].xml", "data/yields.csv"]))).toBe(
      false
    );
    // Names count only where the container's directory lists them, never inside other content.
    expect(
      documentMatchesType(DOCX, zipArchive(["notes.txt"], "[Content_Types].xml word/document.xml"))
    ).toBe(false);
    // A comment may hold bytes that look like the end record; the real one is still found.
    const wordParts = ["[Content_Types].xml", "word/document.xml"];
    expect(documentMatchesType(DOCX, zipArchive(wordParts, `PK\x05\x06${"x".repeat(40)}`))).toBe(
      true
    );
    // A directory that lists the parts without their local records holds no Word document.
    expect(documentMatchesType(DOCX, zipArchive(wordParts, "", ["a.txt", "b.txt"]))).toBe(false);
    expect(documentMatchesType(WORD, compoundFile([{ name: "WordDocument", type: 2 }]))).toBe(true);
    expect(documentMatchesType(WORD, compoundFile([{ name: "Workbook", type: 2 }]))).toBe(false);
    expect(documentMatchesType(WORD, compoundFile([{ name: "WordDocument", type: 1 }]))).toBe(
      false
    );
    expect(documentMatchesType(WORD, zipArchive(["word/document.xml"]))).toBe(false);
    expect(documentMatchesType("text/markdown", text("# Site report\n\nPanels: 12, all ✓"))).toBe(
      true
    );
    expect(documentMatchesType("text/plain", bytes(0x68, 0x00, 0x69))).toBe(false);
    expect(documentMatchesType("text/plain", bytes(0xff, 0xfe, 0x41, 0x00))).toBe(false);
    // The whole file is read, so a character cut off at its end is a fault.
    expect(documentMatchesType("text/plain", text("café").slice(0, 4))).toBe(false);
  });
  it("counts documents apart from photos and videos: five at most, 10 MB each", () => {
    const sized = (name: string, type: string, size: number) => {
      const file = new File(["x"], name, { type });
      Object.defineProperty(file, "size", { value: size });
      return file;
    };
    const mib = 1024 * 1024;
    const pdf = (size = 1) => sized("certificate.pdf", "application/pdf", size);
    const photos = Array.from({ length: 10 }, () => sized("panels.png", "image/png", 1));
    expect(validateWorkAttachments([...photos, ...Array.from({ length: 5 }, () => pdf())])).toEqual(
      []
    );
    expect(validateWorkAttachments(Array.from({ length: 6 }, () => pdf()))).toContain(
      "document-count"
    );
    expect(validateWorkAttachments([pdf(10 * mib)])).toEqual([]);
    expect(validateWorkAttachments([pdf(10 * mib + 1)])).toContain("media-size");
    // A certificate never stands in for the photos an action asks for.
    expect(validateWorkAttachments([pdf()], [], 1)).toContain("photos-required");
  });
  it("reads only documents with a content identifier from published metadata", () => {
    const cid = "bafkreigh2akiscaildcqabsyg3dfr6chu3fgpregiymsck7e7aqa4s52zy";
    expect(
      readPublishedWorkDocuments([
        {
          cid,
          type: "application/pdf",
          name: "uploads/Install\u0000 certificate.pdf",
          size: 1200.4,
        },
        { cid: "javascript:alert(1)", type: "application/pdf", name: "x.pdf", size: 1 },
        { cid, name: 42 },
        "not a document",
      ])
    ).toEqual([
      { cid, type: "application/pdf", name: "Install certificate.pdf", size: 1200 },
      { cid, type: "", name: "document", size: 0 },
    ]);
    expect(readPublishedWorkDocuments(undefined)).toEqual([]);
  });
  it.each([
    0,
    30,
    30.001,
    Infinity,
  ])("checks video duration %s and releases its URL", async (duration) => {
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const video = {
      duration,
      onloadedmetadata: null as null | (() => void),
      onerror: null,
      preload: "",
      removeAttribute: vi.fn(),
      set src(_value: string) {
        queueMicrotask(() => this.onloadedmetadata?.());
      },
    };
    vi.stubGlobal("document", { createElement: () => video });
    try {
      expect(await validateWorkVideo(new File(["v"], "v.mp4", { type: "video/mp4" }))).toBe(
        duration > 0 && duration <= 30
      );
      expect(revoke).toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      revoke.mockRestore();
    }
  });
});
