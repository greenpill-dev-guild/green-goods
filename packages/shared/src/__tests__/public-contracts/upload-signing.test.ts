import { describe, expect, it } from "vitest";
import {
  PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES,
  validatePublicUploadSignRequest,
} from "../../public-contracts";

const VALID_ADDRESS = "0x1111111111111111111111111111111111111111";

function isAddress(value: unknown): boolean {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    filename: " leaf-photo.png ",
    mimeType: " IMAGE/PNG ",
    size: 42_000,
    source: " upload-signer-test ",
    category: "file_upload",
    gardenAddress: VALID_ADDRESS,
    ...overrides,
  };
}

describe("public upload-signing contract validation", () => {
  const config = {
    allowedMimeTypes: ["image/*", "application/json"],
    maxFileSize: 1_000_000,
    isAddress,
  };

  it("normalizes a valid browser upload request", () => {
    const result = validatePublicUploadSignRequest(validBody(), config);

    expect(result).toEqual({
      ok: true,
      request: {
        filename: "leaf-photo.png",
        mimeType: "image/png",
        size: 42_000,
        source: "upload-signer-test",
        category: "file_upload",
        gardenAddress: VALID_ADDRESS,
      },
    });
  });

  it("keeps the allowed category list as the shared public contract", () => {
    expect(PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES).toEqual(["file_upload", "json_upload"]);
  });

  it("rejects invalid request body, filename, size, category, and garden address", () => {
    for (const body of [
      undefined,
      validBody({ filename: "../metadata.json" }),
      validBody({ size: 0 }),
      validBody({ size: 1_000_001 }),
      validBody({ category: "avatar_upload" }),
      validBody({ gardenAddress: "not-an-address" }),
    ]) {
      const result = validatePublicUploadSignRequest(body, config);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.errorCode).toBe("invalid_request");
      }
    }
  });

  it("drops optional source values that are empty or too long", () => {
    expect(validatePublicUploadSignRequest(validBody({ source: "   " }), config)).toMatchObject({
      ok: true,
      request: { source: undefined },
    });

    expect(
      validatePublicUploadSignRequest(validBody({ source: "x".repeat(81) }), config)
    ).toMatchObject({
      ok: true,
      request: { source: undefined },
    });
  });
});
