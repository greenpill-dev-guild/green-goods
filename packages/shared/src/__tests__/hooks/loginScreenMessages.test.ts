import type { IntlShape } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import { getFriendlyLoginErrorMessage } from "../../hooks/client-ui/auth/login-screen-messages";

const intl = {
  formatMessage: vi.fn(
    (descriptor: { id: string; defaultMessage?: string }) =>
      descriptor.defaultMessage ?? descriptor.id
  ),
} as unknown as IntlShape;

describe("getFriendlyLoginErrorMessage", () => {
  it("reports a missing passkey instead of treating NotAllowedError as cancellation", () => {
    const unavailable = new Error("No passkey is available for this request.");
    unavailable.name = "NotAllowedError";
    const wrapped = new Error("Failed to request credential.");
    (wrapped as Error & { cause?: unknown }).cause = unavailable;

    expect(getFriendlyLoginErrorMessage(wrapped, intl)).toBe("No passkey found for that username.");
  });

  it("still reports a generic NotAllowedError dismissal as cancellation", () => {
    const cancelled = new Error("The operation was not allowed.");
    cancelled.name = "NotAllowedError";

    expect(getFriendlyLoginErrorMessage(cancelled, intl)).toBe("Sign in was cancelled.");
  });
});
