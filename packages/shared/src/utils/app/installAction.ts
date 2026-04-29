/**
 * Install action dispatcher for public install CTAs.
 *
 * Public install CTAs render `data-install-action` from `useInstallGuidance`
 * and previously navigated to `#install`, which scrolled to a section that
 * carried the same anchor — a dead-end loop. This helper turns the action
 * type into a real handler so each CTA actually does something.
 *
 * The handler is a plain function, not a hook, so callers can pass deps
 * once at the top of the component and reuse the result without extra
 * provider plumbing.
 */

import type { InstallGuidance } from "../../hooks/app/useInstallGuidance";
import { copyToClipboard } from "./clipboard";
import { hapticLight } from "./haptics";

export interface InstallActionContext {
  /** From `useApp().promptInstall` — fires the deferred install event when present. */
  promptInstall: () => void;
  /**
   * Optional toast hook for "copied link" / "open in <browser>" feedback.
   * Receives a localized message id + default copy. The toast service from
   * shared is intentionally not imported directly so the helper stays
   * tree-shakeable from server-safe code paths.
   */
  toast?: (input: {
    titleId: string;
    defaultTitle: string;
    messageId?: string;
    defaultMessage?: string;
  }) => void;
  /**
   * DOM id of the section that hosts manual install instructions
   * (defaults to `install`). Used as the fallback target when no other
   * action is appropriate.
   */
  installSectionId?: string;
}

const DEFAULT_SECTION_ID = "install";

function scrollToSection(id: string): void {
  if (typeof document === "undefined") return;
  const target = document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Dispatch the public install action for a given guidance result.
 *
 * Returns true when the action consumed the click (caller should
 * preventDefault); returns false when the caller should fall back to
 * default browser behavior (e.g. follow the link).
 */
export async function dispatchInstallAction(
  guidance: InstallGuidance,
  context: InstallActionContext
): Promise<boolean> {
  const { promptInstall, toast, installSectionId = DEFAULT_SECTION_ID } = context;
  const action = guidance.primaryAction;

  switch (action.type) {
    case "native-install": {
      hapticLight();
      promptInstall();
      return true;
    }

    case "open-app": {
      if (typeof window !== "undefined") {
        window.location.href = "/home";
      }
      return true;
    }

    case "open-in-browser": {
      const target = guidance.openInBrowserUrl;
      if (target && typeof window !== "undefined") {
        window.location.href = target;
        return true;
      }
      scrollToSection(installSectionId);
      return true;
    }

    case "copy-url": {
      if (typeof window === "undefined") return true;
      const ok = await copyToClipboard(window.location.href);
      if (ok && toast) {
        toast({
          titleId: "public.install.copyToast.title",
          defaultTitle: "Link copied",
          messageId: "public.install.copyToast.message",
          defaultMessage: "Open the link in your recommended browser to install.",
        });
      }
      return true;
    }

    case "show-manual-steps":
    case "continue-in-browser":
    default: {
      scrollToSection(installSectionId);
      return true;
    }
  }
}
