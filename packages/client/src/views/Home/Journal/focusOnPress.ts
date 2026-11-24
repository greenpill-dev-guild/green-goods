import type { PointerEvent } from "react";

/**
 * Props for a control on Home that opens a sheet: it takes focus as it is pressed. Safari does
 * not focus a button on a click or a tap, and a sheet hands focus back to whatever held it as it
 * opened (`useOpenerFocus`), so without this the sheet would hand focus to the page (DL-128).
 */
export const focusOnPress = {
  onPointerDown: (event: PointerEvent<HTMLElement>) =>
    event.currentTarget.focus({ preventScroll: true }),
};
