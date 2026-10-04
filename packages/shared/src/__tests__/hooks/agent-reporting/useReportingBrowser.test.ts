import { afterEach, describe, expect, it, vi } from "vitest";
import { readReportingBrowserContext } from "../../../hooks/agent-reporting/useReportingBrowser";

afterEach(() => vi.unstubAllGlobals());

describe("reporting browser context", () => {
  it("recognizes an iOS WebKit chat view without Safari and its missing passkey API", () => {
    vi.stubGlobal("window", { PublicKeyCredential: undefined });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148",
    });
    expect(readReportingBrowserContext()).toMatchObject({
      platform: "ios",
      inApp: true,
      passkeyUnavailable: true,
    });
  });

  it("recognizes the Telegram bridge even when the user agent hides it", () => {
    vi.stubGlobal("window", {
      PublicKeyCredential: function PublicKeyCredential() {},
      TelegramWebviewProxy: { postEvent: vi.fn() },
    });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (Linux; Android 14) Chrome/120 Safari/537.36",
    });
    expect(readReportingBrowserContext()).toMatchObject({
      platform: "android",
      inApp: true,
      passkeyUnavailable: false,
    });
  });
});
