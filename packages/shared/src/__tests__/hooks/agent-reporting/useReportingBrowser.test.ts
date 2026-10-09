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

  it("leaves ordinary iOS Safari outside the in-app flow", () => {
    vi.stubGlobal("window", { PublicKeyCredential: function PublicKeyCredential() {} });
    vi.stubGlobal("navigator", {
      userAgent: "Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
    });
    expect(readReportingBrowserContext()).toMatchObject({
      platform: "ios",
      inApp: false,
      passkeyUnavailable: false,
    });
  });

  it("returns a neutral context during server rendering", () => {
    vi.stubGlobal("window", undefined);
    vi.stubGlobal("navigator", undefined);
    expect(readReportingBrowserContext()).toEqual({
      platform: "unknown",
      inApp: false,
      passkeyUnavailable: false,
    });
  });
});
