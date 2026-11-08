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
  it("keeps a document only when its first bytes match its type", () => {
    const text = (value: string) => new TextEncoder().encode(value);
    const bytes = (...values: number[]) => new Uint8Array(values);
    expect(documentMatchesType("application/pdf", text("%PDF-1.7"))).toBe(true);
    expect(documentMatchesType("application/pdf", text("<html><script>"))).toBe(false);
    expect(documentMatchesType(DOCX, bytes(0x50, 0x4b, 0x03, 0x04, 0x14))).toBe(true);
    expect(
      documentMatchesType(
        "application/msword",
        bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
      )
    ).toBe(true);
    expect(documentMatchesType("application/msword", bytes(0x50, 0x4b, 0x03, 0x04))).toBe(false);
    expect(documentMatchesType("text/markdown", text("# Site report\n\nPanels: 12, all ✓"))).toBe(
      true
    );
    expect(documentMatchesType("text/plain", bytes(0x68, 0x00, 0x69))).toBe(false);
    expect(documentMatchesType("text/plain", bytes(0xff, 0xfe, 0x41, 0x00))).toBe(false);
    // A character cut off where the sample ends is not a fault in the file.
    expect(documentMatchesType("text/plain", text("café").slice(0, 4))).toBe(true);
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
