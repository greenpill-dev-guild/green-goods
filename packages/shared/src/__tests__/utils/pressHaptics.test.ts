/**
 * @vitest-environment jsdom
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installPressHaptics, resetHapticsState, setHapticsEnabled } from "../../utils/app/haptics";

const LIGHT = [10];
const SELECTION = [5];

type ClickListener = (event: Pick<Event, "isTrusted" | "target">) => void;

describe("installPressHaptics", () => {
  const vibrate = vi.fn();
  // jsdom cannot make the trusted click a finger makes, and the listener ignores
  // untrusted ones on purpose, so a stub root hands the test the listener itself.
  const root = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
  let uninstall: () => void;
  let onClick: ClickListener;

  beforeEach(() => {
    localStorage.clear();
    resetHapticsState();
    vibrate.mockClear();
    root.addEventListener.mockClear();
    root.removeEventListener.mockClear();
    Object.defineProperty(navigator, "vibrate", { value: vibrate, configurable: true });
    uninstall = installPressHaptics(root as unknown as Document);
    onClick = root.addEventListener.mock.calls[0][1] as ClickListener;
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  /** Clicks the `#target` element of the markup and returns what vibrated. */
  const press = (markup: string, isTrusted = true) => {
    document.body.innerHTML = markup;
    onClick({ isTrusted, target: document.getElementById("target") });
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
    ["a scrim drawn as a button", `<button data-pressable="scrim" id="target"></button>`],
    ["a text field", `<input type="text" id="target" />`],
    ["a dropdown trigger", `<button role="combobox" id="target">Theme</button>`],
    [
      "a dropdown trigger declared as a pressable trigger",
      `<button role="combobox" data-pressable="trigger" id="target">Theme</button>`,
    ],
    [
      "a control that is not available",
      `<button class="gg-button" aria-disabled="true" id="target">Saving</button>`,
    ],
    ["plain content", `<p id="target">Garden notes</p>`],
  ])("stays quiet for %s", (_kind, markup) => {
    expect(press(markup)).toEqual([]);
  });

  it("stays quiet for a click the app makes itself, such as a download link's", () => {
    expect(press(`<a href="#file" download id="target">photo.jpg</a>`, false)).toEqual([]);
  });

  it("stays quiet once the person turns vibration off", () => {
    setHapticsEnabled(false);

    expect(press(`<button id="target">Save</button>`)).toEqual([]);
  });

  it("listens in the capture phase, so a control that stops propagation still answers, until removed", () => {
    expect(root.addEventListener).toHaveBeenCalledWith("click", onClick, true);

    uninstall();

    expect(root.removeEventListener).toHaveBeenCalledWith("click", onClick, true);
  });
});
