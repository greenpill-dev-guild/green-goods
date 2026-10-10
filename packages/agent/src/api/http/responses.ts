import type { PublicApiError } from "@green-goods/shared/public-contracts";
import type { Context } from "hono";

export function safeError(
  errorCode: PublicApiError["errorCode"],
  message: string,
  extra: Omit<PublicApiError, "ok" | "errorCode" | "message"> = {}
): PublicApiError {
  return { ok: false, errorCode, message, ...extra };
}

export function isPublicApiError(value: PublicApiError | unknown): value is PublicApiError {
  return typeof value === "object" && value !== null && "ok" in value && value.ok === false;
}

export function jsonNoStore(c: Context, body: unknown, status = 200) {
  return c.json(body, status as never, {
    "Cache-Control": "no-store",
    Pragma: "no-cache",
  });
}
