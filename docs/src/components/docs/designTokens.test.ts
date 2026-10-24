import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {describe, test} from "node:test";

import tokens from "../../data/design-tokens.json";
import {COLOR_GROUPS, FONT_STACKS, PAIRINGS, PRODUCT_FONT_STYLESHEETS} from "./designTokens.data";

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
    assert.equal(Object.keys(tokens.typography).length, 6);
    for (const token of Object.values(tokens.typography)) assert.ok(token.fontFamily in FONT_STACKS, token.fontFamily);
  });

  test("type samples and locally hosted client faces cover every token's weight", () => {
    const clientHtml = readFileSync(new URL("../../../../packages/client/index.html", import.meta.url), "utf8");
    const installedFonts = readFileSync(new URL("../../../../packages/client/public/fonts/pwa.css", import.meta.url), "utf8");
    const localFaces = [...`${clientHtml}\n${installedFonts}`.matchAll(/@font-face\s*\{([^}]+)\}/g)].map(([, face]) => face);
    for (const [name, token] of Object.entries(tokens.typography)) {
      // A css2 request spells a family's spaces as plus signs.
      const family = token.fontFamily.replace(/ /g, "+");
      const request = PRODUCT_FONT_STYLESHEETS.find((url) => url.includes(`family=${family}:`));
      // A css2 request lists each tuple in axis order, so the upright tuple ends in the weight range;
      // an optical-size range comes before it only when the family has that axis.
      const [lightest, heaviest] = request?.match(/@0,(?:[^;,]*,)?(\d+)\.\.(\d+);/)?.slice(1).map(Number) ?? [];
      assert.ok(
        lightest <= token.fontWeight && token.fontWeight <= heaviest,
        `${name} is ${token.fontFamily} ${token.fontWeight}, outside the loaded ${lightest}..${heaviest}`,
      );
      const upright = localFaces.find((face) => face.includes(`font-family: '${token.fontFamily}'`) && /font-style:\s*normal;/.test(face));
      const [localLightest, localHeaviest] = upright?.match(/font-weight:\s*(\d+)\s+(\d+)/)?.slice(1).map(Number) ?? [];
      assert.ok(localLightest <= token.fontWeight && token.fontWeight <= localHeaviest, `${name} is outside the locally hosted range`);
    }
  });
});
