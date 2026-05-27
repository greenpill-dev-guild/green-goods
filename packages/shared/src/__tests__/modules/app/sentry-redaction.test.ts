import { describe, expect, it } from "vitest";
import { redactSentryString, sanitizeSentryValue } from "../../../modules/app/sentry-redaction";

describe("Sentry redaction", () => {
  it("redacts wallet addresses, emails, tokens, and URL query strings", () => {
    const redacted = redactSentryString(
      "alice@example.com hit https://greengoods.app/home?wallet=0x1111111111111111111111111111111111111111#private with eyJabc.def.ghi"
    );

    expect(redacted).toContain("[REDACTED_EMAIL]");
    expect(redacted).toContain("[REDACTED_TOKEN]");
    expect(redacted).toContain("https://greengoods.app/home");
    expect(redacted).not.toContain("alice@example.com");
    expect(redacted).not.toContain("wallet=");
    expect(redacted).not.toContain("#private");
    expect(redacted).not.toContain("0x1111111111111111111111111111111111111111");
  });

  it("redacts sensitive object keys recursively", () => {
    const redacted = sanitizeSentryValue({
      route: "/api/messages",
      senderPlatformId: "123456789",
      metadata: {
        email: "alice@example.com",
        safeCount: 2,
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
    });

    expect(redacted).toEqual({
      route: "/api/messages",
      senderPlatformId: "[REDACTED]",
      metadata: {
        email: "[REDACTED]",
        safeCount: 2,
        walletAddress: "[REDACTED]",
      },
    });
  });
});
