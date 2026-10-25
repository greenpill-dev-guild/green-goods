import type { ArrivalState } from "@green-goods/shared/hooks/app/useArrivalState";

/** Where the arrival toast points: Your Work, or the switcher for another garden's uploads. */
type UploadOrientation = Extract<ArrivalState, { kind: "queue" }>["orientation"];

/**
 * What the arrival toast's single action does. Resolved to a concrete side effect in Home
 * (the handlers depend on client routes + the UI store, so they can't live in shared).
 */
export type ArrivalActionKind = "openWorkDashboardPending" | "openGardenSwitcher";

export interface ArrivalToastSpec {
  titleId: string;
  messageId: string;
  /** Values the message names, such as the garden the uploads wait in. */
  values?: Record<string, string>;
  actionLabelId: string;
  action: ArrivalActionKind;
}

/**
 * The arrival toast's copy and one action for uploads still on this phone (PWA Home step 12).
 * Your Work lists the active garden only, so uploads that all wait in another of the member's
 * gardens name it and open the switcher, where the member picks. The `*Id` values are literal
 * strings so the shared locale-coverage gate's source-usage scan can see them.
 */
export function arrivalToastSpec(orientation: UploadOrientation): ArrivalToastSpec {
  if (orientation.target === "switcher") {
    return {
      titleId: "app.home.arrival.queue.title",
      messageId: "app.home.arrival.queue.messageInGarden",
      values: { garden: orientation.gardenName },
      actionLabelId: "app.home.chooser.action",
      action: "openGardenSwitcher",
    };
  }
  return {
    titleId: "app.home.arrival.queue.title",
    messageId: "app.home.arrival.queue.message",
    actionLabelId: "app.home.arrival.queue.action",
    action: "openWorkDashboardPending",
  };
}

/**
 * The arrival toast belongs to a session that opens on Home. The arrival has passed once the
 * toast was shown, or once the session was anywhere else first: an app restored into the
 * garden flow already met its drafts there, so a later Home visit must not repeat the
 * orientation. Kept per browser session and per address, so another account signing in on the
 * same tab still arrives fresh.
 */
const arrivalPassedKey = (address: string) => `greengoods:arrival-shown:${address.toLowerCase()}`;

/** Arrivals marked on this page load while session storage refused the write. */
const passedWithoutStorage = new Set<string>();

export function hasArrivalPassed(address: string): boolean {
  const key = arrivalPassedKey(address);
  if (passedWithoutStorage.has(key)) return true;
  try {
    return sessionStorage.getItem(key) === "true";
  } catch {
    // Storage can be unavailable; the arrival toast is a courtesy, not state.
    return false;
  }
}

export function markArrivalPassed(address: string): void {
  const key = arrivalPassedKey(address);
  try {
    sessionStorage.setItem(key, "true");
  } catch {
    // Storage can be unavailable; remember the arrival for this page load instead.
    passedWithoutStorage.add(key);
  }
}
