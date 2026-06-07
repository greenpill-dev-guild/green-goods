import type * as React from "react";

type AppKitButtonElement = React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>;

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * The AppKit button web component. Registered globally by AppKit.
       */
      "appkit-button": AppKitButtonElement;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * The AppKit button web component. Registered globally by AppKit.
       */
      "appkit-button": AppKitButtonElement;
    }
  }

  /**
   * Chromium PWA install prompt (not in standard DOM lib types).
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeinstallprompt_event
   */
  interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
      outcome: "accepted" | "dismissed";
      platform: string;
    }>;
    prompt(): Promise<void>;
  }
}

// Ensures file is treated as a module
export {};
