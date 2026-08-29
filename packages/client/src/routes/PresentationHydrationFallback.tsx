import { getClientRoutePresentationMode } from "./presentationMode";

const DEFAULT_PWA_LOADING_MESSAGE = "Green Goods is loading.";

function getPwaLoadingMessage() {
  if (typeof document === "undefined") return DEFAULT_PWA_LOADING_MESSAGE;
  return document.documentElement.dataset.bootLoadingMessage || DEFAULT_PWA_LOADING_MESSAGE;
}

/**
 * The pre-React fallback and the React hydration boundary deliberately share
 * the boot classes from index.html so mounting React does not create a second
 * visual loading scene.
 */
export function PwaHydrationFallback() {
  return (
    <div className="boot-pwa-shell" role="status" aria-live="polite" aria-busy="true">
      <div className="boot-pwa-content">
        <div className="boot-pwa-logo-slot" data-boot-slot="logo">
          <img alt="" src="/icon.png" width="112" height="64" />
        </div>
        <div className="boot-pwa-message-slot" data-boot-slot="message">
          <p>{getPwaLoadingMessage()}</p>
        </div>
        <div className="boot-pwa-action-slot" data-boot-slot="action" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The static HTML owns website startup so React does not replace the
 * editorial skeleton with an app-style fallback while lazy routes resolve.
 */
export function PresentationHydrationFallback() {
  if (getClientRoutePresentationMode() === "website") return null;

  return <PwaHydrationFallback />;
}
