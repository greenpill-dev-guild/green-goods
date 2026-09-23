/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPressHaptics, resetHapticsState, setHapticsEnabled } from "../../utils/app/haptics";

const LIGHT = [10];
const SELECTION = [5];

describe("installPressHaptics", () => {
  const vibrate = vi.fn();
  let uninstall: () => void;

  beforeEach(() => {
    localStorage.clear();
    resetHapticsState();
    vibrate.mockClear();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    uninstall = installPressHaptics();
  });

  afterEach(() => {
    uninstall();
    document.body.innerHTML = "";
  });

  /** Presses the `#target` element of the markup and returns what vibrated. */
  const press = (markup: string) => {
    document.body.innerHTML = markup;
    document.getElementById("target")?.click();
    return vibrate.mock.calls;
  };

  it.each([
    [
      "a shared button, pressed on its label",
      `<button class="gg-button"><span id="target">Save</span></button>`,
      [LIGHT],
    ],
    [
      "a raw button inside a shared component",
      `<button type="button" id="target">Play</button>`,
      [LIGHT],
    ],
    ["a link", `<a href="#garden-1" id="target">Open</a>`, [LIGHT]],
    [
      "a card that opens something",
      `<button data-pressable="card" id="target">Garden</button>`,
      [LIGHT],
    ],
    [
      "a row that opens something",
      `<button data-pressable="row" id="target">Token</button>`,
      [LIGHT],
    ],
    ["an app bar tab", `<a href="#home" data-pressable="tab" id="target">Home</a>`, [SELECTION]],
    ["a tab", `<button role="tab" id="target">Work</button>`, [SELECTION]],
    [
      "a card that toggles a choice",
      `<button data-pressable="card" aria-pressed="false" id="target">Newest</button>`,
      [SELECTION],
    ],
    ["a native radio", `<input type="radio" name="mode" id="target" />`, [SELECTION]],
    ["a native checkbox", `<input type="checkbox" id="target" />`, [SELECTION]],
  ])("answers %s", (_kind, markup, expected) => {
    expect(press(markup)).toEqual(expected);
  });

  it.each([
    ["a scrim", `<div data-pressable="scrim" id="target"></div>`],
    ["a text field", `<input type="text" id="target" />`],
    ["a dropdown trigger", `<button role="combobox" id="target">Theme</button>`],
    [
      "a control that is not available",
      `<button class="gg-button" aria-disabled="true" id="target">Saving</button>`,
    ],
    ["plain content", `<p id="target">Garden notes</p>`],
  ])("stays quiet for %s", (_kind, markup) => {
    expect(press(markup)).toEqual([]);
  });

  it("stays quiet once the person turns vibration off", () => {
    setHapticsEnabled(false);

    expect(press(`<button id="target">Save</button>`)).toEqual([]);
  });

  it("stops answering once it is removed", () => {
    uninstall();

    expect(press(`<button id="target">Save</button>`)).toEqual([]);
  });
});
