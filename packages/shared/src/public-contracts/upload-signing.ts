import type { PublicApiError, PublicUploadSignCategory, PublicUploadSignRequest } from "./index";

export const PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES = [
  "file_upload",
  "json_upload",
] as const satisfies readonly PublicUploadSignCategory[];

export interface PublicUploadSignValidationConfig {
  allowedMimeTypes: readonly string[];
  maxFileSize: number;
  isAddress: (value: unknown) => boolean;
}

export type PublicUploadSignValidationResult =
  | { ok: true; request: PublicUploadSignRequest }
  | { ok: false; error: PublicApiError };

const allowedCategorySet = new Set<string>(PUBLIC_UPLOAD_SIGN_ALLOWED_CATEGORIES);

function publicApiError(
  errorCode: PublicApiError["errorCode"],
  message: string,
  extra: Omit<PublicApiError, "ok" | "errorCode" | "message"> = {}
): PublicApiError {
  return { ok: false, errorCode, message, ...extra };
}

function isMimeAllowed(mimeType: string, allowedMimeTypes: readonly string[]): boolean {
  return allowedMimeTypes.some((allowed) => {
    const normalized = allowed.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.endsWith("/*")) {
      return mimeType.startsWith(normalized.slice(0, -1));
    }
    return mimeType === normalized;
  });
}

function isValidUploadFilename(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const filename = value.trim();
  return (
    filename.length > 0 &&
    filename.length <= 255 &&
    filename !== "." &&
    filename !== ".." &&
    !hasUnsafeFilenameCharacter(filename)
  );
}

function hasUnsafeFilenameCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (character === "/" || character === "\\" || code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

function normalizeOptionalUploadString(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return undefined;
  return trimmed;
}

export function validatePublicUploadSignRequest(
  body: unknown,
  config: PublicUploadSignValidationConfig
): PublicUploadSignValidationResult {
  const candidate = body as Partial<PublicUploadSignRequest> | undefined;
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: publicApiError("invalid_request", "Invalid request body.") };
  }

  const filename = candidate.filename;
  if (!isValidUploadFilename(filename)) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "Invalid upload filename.", {
        fieldErrors: { filename: "Invalid filename" },
      }),
    };
  }

  const mimeType =
    typeof candidate.mimeType === "string" ? candidate.mimeType.trim().toLowerCase() : "";
  if (!mimeType || !isMimeAllowed(mimeType, config.allowedMimeTypes)) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "This file type is not supported.", {
        fieldErrors: { mimeType: "Unsupported MIME type" },
      }),
    };
  }

  const size = candidate.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "Invalid upload size.", {
        fieldErrors: { size: "Size must be a positive integer" },
      }),
    };
  }

  if (size > config.maxFileSize) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "This file is too large.", {
        fieldErrors: { size: "File exceeds the upload limit" },
        params: { maxFileSize: config.maxFileSize },
      }),
    };
  }

  if (candidate.category && !allowedCategorySet.has(candidate.category)) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "Invalid upload category.", {
        fieldErrors: { category: "Invalid upload category" },
      }),
    };
  }

  if (candidate.gardenAddress !== undefined && !config.isAddress(candidate.gardenAddress)) {
    return {
      ok: false,
      error: publicApiError("invalid_request", "Invalid garden address.", {
        fieldErrors: { gardenAddress: "Invalid address" },
      }),
    };
  }

  return {
    ok: true,
    request: {
      filename: filename.trim(),
      mimeType,
      size,
      source: normalizeOptionalUploadString(candidate.source, 80),
      category: candidate.category,
      gardenAddress: candidate.gardenAddress,
    },
  };
}
