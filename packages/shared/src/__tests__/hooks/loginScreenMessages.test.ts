import type { IntlShape } from "react-intl";
import { describe, expect, it, vi } from "vitest";
import type { InstallGuidance } from "../../hooks/app/useInstallGuidance";
import {
  getBrowserGuidanceLabel,
  getFriendlyLoginErrorMessage,
} from "../../hooks/client-ui/auth/login-screen-messages";
import { passkeyServerRefusal } from "../test-utils/passkey-server-refusal";

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

  it.each([
    ["address mismatch", "That passkey is for a different account."],
    ["Failed to fetch", "Passkey recovery is temporarily unavailable."],
    [
      "RPC Request failed. Details: Passkey sign-up is unavailable right now.",
      "Passkey recovery is temporarily unavailable.",
    ],
    ["Unexpected failure", "Something went wrong. Please try again."],
  ])("gives useful guidance for %s", (message, expected) => {
    expect(getFriendlyLoginErrorMessage(new Error(message), intl)).toBe(expected);
  });

  // A refusal from a passkey server quotes the address that was called and the request that was
  // sent, and the request carries the name the person typed. Neither may pick the message.
  it.each([
    ["cancel-ana", "That name is already registered.", "That name is already registered."],
    ["network-ana", "Passkey verification failed.", "We couldn't verify your passkey."],
    [
      "ana",
      "Too many requests. Please try again later.",
      "Something went wrong. Please try again.",
    ],
  ])("reads a refused sign-up for %s by what the server said", async (userName, refusal, expected) => {
    const error = await passkeyServerRefusal({ userName, message: refusal });

    expect(error.message).toContain(`"userName":"${userName}"`);
    expect(getFriendlyLoginErrorMessage(error, intl)).toBe(expected);
  });
});

describe("getBrowserGuidanceLabel", () => {
  it("points an Android in-app browser with a handoff URL to Chrome", () => {
    const guidance = {
      scenario: "in-app-browser",
      openInBrowserUrl: "https://example.com/open",
    } as InstallGuidance;

    expect(getBrowserGuidanceLabel(guidance, "android", intl)).toBe(
      "Open in Chrome for the best experience"
    );
  });

  it("asks an iOS in-app browser to copy the link into Safari", () => {
    const guidance = {
      scenario: "in-app-browser",
      openInBrowserUrl: null,
    } as InstallGuidance;

    expect(getBrowserGuidanceLabel(guidance, "ios", intl)).toBe(
      "Copy this link and open it in Safari"
    );
  });
});
