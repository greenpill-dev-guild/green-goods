import assert from "node:assert/strict";
import {describe, test} from "node:test";

import tokens from "../../data/design-tokens.json";
import {COLOR_GROUPS, FONT_STACKS, PAIRINGS} from "./designTokens.data";

const HEX = /^#[0-9A-Fa-f]{6}$/;

describe("design token page data", () => {
  test("every projected color sits in exactly one group", () => {
    const grouped = COLOR_GROUPS.flatMap((group) => [...group.keys]);
    assert.deepEqual([...grouped].sort(), Object.keys(tokens.colors).sort());
    assert.equal(new Set(grouped).size, grouped.length);
  });

  test("every pairing names projected colors and every color is a six-digit hex", () => {
    for (const pairing of PAIRINGS) {
      assert.ok(pairing.fg in tokens.colors, pairing.fg);
      assert.ok(pairing.bg in tokens.colors, pairing.bg);
    }
    for (const [key, value] of Object.entries(tokens.colors)) assert.match(value, HEX, key);
  });

  test("every pairing puts text on a different color than its fill", () => {
    for (const pairing of PAIRINGS) assert.notEqual(pairing.fg, pairing.bg, pairing.label);
    assert.equal(new Set(PAIRINGS.map((pairing) => pairing.label)).size, PAIRINGS.length);
  });

  test("the projection carries the type, radius, and spacing scales with brand fonts mapped", () => {
    assert.equal(Object.keys(tokens.rounded).length, 7);
    assert.equal(Object.keys(tokens.spacing).length, 3);
    assert.equal(Object.keys(tokens.typography).length, 4);
    for (const token of Object.values(tokens.typography)) assert.ok(token.fontFamily in FONT_STACKS, token.fontFamily);
  });
});
