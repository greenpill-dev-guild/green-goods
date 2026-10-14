import assert from "node:assert/strict";
import {describe, test} from "node:test";

import {
  DARK_THEME_VARIABLES,
  LIGHT_THEME_VARIABLES,
  SHARED_THEME_VARIABLES,
  themeVariablesFor,
} from "./palettes";

const HEX = /^#[0-9a-f]{6}$/;

describe("mermaid palettes", () => {
  test("both color modes define the same variables", () => {
    assert.deepEqual(Object.keys(DARK_THEME_VARIABLES).sort(), Object.keys(LIGHT_THEME_VARIABLES).sort());
  });

  test("every color is a six-digit hex so mermaid can derive its shades", () => {
    for (const palette of [LIGHT_THEME_VARIABLES, DARK_THEME_VARIABLES]) {
      for (const [key, value] of Object.entries(palette)) {
        if (typeof value === "boolean") continue;
        assert.match(value, HEX, `${key} is ${value}`);
      }
    }
  });

  test("the dark palette declares itself dark on the page canvas", () => {
    assert.equal(DARK_THEME_VARIABLES.darkMode, true);
    assert.equal(DARK_THEME_VARIABLES.background, "#171717");
    assert.equal(LIGHT_THEME_VARIABLES.darkMode, false);
  });

  test("a color mode resolves to its palette plus the shared typography", () => {
    const dark = themeVariablesFor("dark");
    assert.equal(dark.fontFamily, SHARED_THEME_VARIABLES.fontFamily);
    assert.equal(dark.primaryColor, DARK_THEME_VARIABLES.primaryColor);
    assert.equal(themeVariablesFor("light").primaryColor, LIGHT_THEME_VARIABLES.primaryColor);
  });
});
