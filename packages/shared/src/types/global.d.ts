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
}

// Ensures file is treated as a module
export {};
