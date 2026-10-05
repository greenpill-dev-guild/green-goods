import { describe, expect, it } from "vitest";
import { redactSentryString, sanitizeSentryValue } from "../../../modules/app/sentry-redaction";
import { passkeyServerRefusal } from "../../test-utils/passkey-server-refusal";

describe("Sentry redaction", () => {
  it("removes quoted passkey requests from error messages and stacks", async () => {
    const userName = "private-name-marker";
    const error = await passkeyServerRefusal({
      userName,
      message: "That name is already registered.",
    });
    const redacted = JSON.stringify(sanitizeSentryValue(error));

    expect(error.message).toContain(userName);
    expect(redacted).not.toContain(userName);
    expect(redacted).not.toContain("Request body:");
    expect(redacted).toContain("That name is already registered.");
  });

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

  it("keeps reporting routes but drops their chat link locators", () => {
    const redacted = redactSentryString(
      "navigation to /agent/reporting/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFi from https://www.greengoods.app/agent/reporting/recover/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFi"
    );

    expect(redacted).toBe(
      "navigation to /agent/reporting/:requestId from https://www.greengoods.app/agent/reporting/recover/:requestId"
    );
  });

  it("redacts sensitive object keys recursively", () => {
    const redacted = sanitizeSentryValue({
      route: "/api/messages",
      senderPlatformId: "123456789",
      metadata: {
        userName: "private-name-marker",
        email: "alice@example.com",
        safeCount: 2,
        walletAddress: "0x1111111111111111111111111111111111111111",
      },
    });

    expect(redacted).toEqual({
      route: "/api/messages",
      senderPlatformId: "[REDACTED]",
      metadata: {
        userName: "[REDACTED]",
        email: "[REDACTED]",
        safeCount: 2,
        walletAddress: "[REDACTED]",
      },
    });
  });
});
