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
    assert.equal(Object.keys(tokens.typography).length, 5);
    for (const token of Object.values(tokens.typography)) assert.ok(token.fontFamily in FONT_STACKS, token.fontFamily);
  });

  test("type samples load the client's faces at the weights it ships, which carry every token's weight", () => {
    const clientHtml = readFileSync(new URL("../../../../packages/client/index.html", import.meta.url), "utf8");
    const clientFaces = readFileSync(new URL("../../../../packages/client/src/styles/fonts.css", import.meta.url), "utf8");
    // The weight ranges of the faces the client serves itself, by family.
    const servedWeights = new Map<string, Set<string>>();
    for (const [, face] of clientFaces.matchAll(/@font-face\s*\{([^}]*)\}/g)) {
      const family = face.match(/font-family:\s*"?([^";]+?)"?;/)?.[1];
      const weights = face.match(/font-weight:\s*(\d+)\s+(\d+);/)?.slice(1).join("..");
      if (family && weights) servedWeights.set(family, (servedWeights.get(family) ?? new Set()).add(weights));
    }
    // A css2 request lists each tuple in axis order, so the upright tuple ends in the weight range;
    // an optical-size range comes before it only when the family has that axis.
    const requestedWeights = (url: string | undefined) => url?.match(/@0,(?:[^;,]*,)?(\d+)\.\.(\d+);/)?.slice(1).map(Number) ?? [];
    for (const stylesheet of PRODUCT_FONT_STYLESHEETS) {
      // A css2 request spells a family's spaces as plus signs.
      const family = stylesheet.match(/family=([^:&]+)/)?.[1].replace(/\+/g, " ") ?? stylesheet;
      const served = servedWeights.get(family);
      // The client serves Plus Jakarta Sans and Inter itself and still requests Fraunces from Google Fonts.
      if (served) assert.deepEqual([...served], [requestedWeights(stylesheet).join("..")], family);
      else assert.ok(clientHtml.includes(`href="${stylesheet}"`), stylesheet);
    }
    assert.deepEqual([...servedWeights.keys()].sort(), ["Inter", "Plus Jakarta Sans"]);
    for (const [name, token] of Object.entries(tokens.typography)) {
      const family = token.fontFamily.replace(/ /g, "+");
      const request = PRODUCT_FONT_STYLESHEETS.find((url) => url.includes(`family=${family}:`));
      const [lightest, heaviest] = requestedWeights(request);
      assert.ok(
        lightest <= token.fontWeight && token.fontWeight <= heaviest,
        `${name} is ${token.fontFamily} ${token.fontWeight}, outside the loaded ${lightest}..${heaviest}`,
      );
    }
  });
});
