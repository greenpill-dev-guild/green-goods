import { useCallback, useState } from "react";
import { detectMobileBrowser, getOpenInBrowserUrl } from "../../utils/app/browser";

type Platform = "ios" | "android" | "unknown";
type TelegramBridge = { postEvent: (event: string, data: string) => void };

export function readReportingBrowserContext(): {
  platform: Platform;
  inApp: boolean;
  passkeyUnavailable: boolean;
} {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { platform: "unknown", inApp: false, passkeyUnavailable: false };
  }
  const ua = navigator.userAgent;
  const platform: Platform = /iPad|iPhone|iPod/i.test(ua)
    ? "ios"
    : /Android/i.test(ua)
      ? "android"
      : "unknown";
  const bridge = (window as Window & { TelegramWebviewProxy?: TelegramBridge })
    .TelegramWebviewProxy;
  const iosWebKitWithoutSafari =
    platform === "ios" && /AppleWebKit/i.test(ua) && !/Safari\//i.test(ua);
  return {
    platform,
    inApp: detectMobileBrowser(platform).isInAppBrowser || iosWebKitWithoutSafari || !!bridge,
    passkeyUnavailable: !window.PublicKeyCredential,
  };
}

/** Only browser affordances; the chat link stays in the address and is never sent to analytics. */
export function useReportingBrowser() {
  const [context] = useState(readReportingBrowserContext);
  const [linkCopied, setLinkCopied] = useState(false);
  const openInBrowser = useCallback(async () => {
    if (typeof window === "undefined") return;
    // The chat link is this page's origin and path. A query or fragment someone added to it is
    // never copied or handed to another app, where it could be read as that app's own options.
    const url = `${window.location.origin}${window.location.pathname}`;
    let copied = false;
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
    } catch {
      // Older in-app browsers may only allow a selection copied from the page.
      const field = document.createElement("textarea");
      field.value = url;
      field.style.position = "fixed";
      field.style.opacity = "0";
      try {
        document.body.append(field);
        field.select();
        copied = document.execCommand?.("copy") ?? false;
      } catch {
        copied = false;
      } finally {
        field.remove();
      }
    }
    if (copied) setLinkCopied(true);
    const bridge = (window as Window & { TelegramWebviewProxy?: TelegramBridge })
      .TelegramWebviewProxy;
    if (bridge) {
      try {
        bridge.postEvent("web_app_open_link", JSON.stringify({ url }));
        return;
      } catch {
        /* Use the platform route below. */
      }
    }
    const next =
      context.platform === "android"
        ? getOpenInBrowserUrl("android", "chrome", url)
        : context.platform === "ios" && url.startsWith("https://")
          ? `x-safari-https://${url.slice("https://".length)}`
          : null;
    if (next) window.location.assign(next);
  }, [context.platform]);
  return {
    inAppBrowser: context.inApp,
    passkeyUnavailable: context.passkeyUnavailable,
    linkCopied,
    openInBrowser,
  };
}
