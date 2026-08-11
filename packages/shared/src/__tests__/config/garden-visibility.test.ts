/**
 * Curated Garden Visibility Tests
 *
 * Covers the two tiers and, most importantly, case-insensitive address
 * matching: garden addresses arrive checksummed from the indexer and
 * lower-cased from other joins, so a case-sensitive compare would silently
 * un-hide a garden.
 */

import { describe, expect, it } from "vitest";

import {
  GARDENS_HIDDEN_EVERYWHERE,
  GARDENS_HIDDEN_FROM_EDITORIAL,
  isGardenHiddenEverywhere,
  isGardenPubliclyVisible,
} from "../../config/garden-visibility";

const LIVE_GARDEN_COOP = "0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8";
const COMMUNITY_GARDEN = "0xf401f34378384713222d1d21f63359cc4E8a858a";
const AIYELOJA = "0xF7b892886998DAe960D64a9db488336684F137A0";
const MAMA_GARDENS = "0x35077CaF6fBef1d5677d318a198C9c47C61bb976";
const VIDA_VERDE = "0x26c32E54F23af9F9fcC757414c76E56e3fB176E2";

const garden = (id: string, name = "A Garden", location = "Somewhere") => ({
  id,
  name,
  location,
});

describe("config/garden-visibility", () => {
  describe("curated lists", () => {
    it("gives every entry a reason", () => {
      for (const entry of [...GARDENS_HIDDEN_EVERYWHERE, ...GARDENS_HIDDEN_FROM_EDITORIAL]) {
        expect(entry.reason.trim().length).toBeGreaterThan(0);
      }
    });

    it("never lists the same garden in both tiers", () => {
      const everywhere = new Set(GARDENS_HIDDEN_EVERYWHERE.map((g) => g.address.toLowerCase()));
      for (const entry of GARDENS_HIDDEN_FROM_EDITORIAL) {
        expect(everywhere.has(entry.address.toLowerCase())).toBe(false);
      }
    });
  });

  describe("isGardenHiddenEverywhere", () => {
    it("hides the coop garden from every surface", () => {
      expect(isGardenHiddenEverywhere(LIVE_GARDEN_COOP)).toBe(true);
    });

    it("matches regardless of address casing", () => {
      expect(isGardenHiddenEverywhere(LIVE_GARDEN_COOP.toLowerCase())).toBe(true);
      expect(isGardenHiddenEverywhere(LIVE_GARDEN_COOP.toUpperCase().replace("0X", "0x"))).toBe(
        true
      );
    });

    it("leaves editorial-only hidden gardens visible to the PWA and admin", () => {
      expect(isGardenHiddenEverywhere(COMMUNITY_GARDEN)).toBe(false);
      expect(isGardenHiddenEverywhere(AIYELOJA)).toBe(false);
      expect(isGardenHiddenEverywhere(MAMA_GARDENS)).toBe(false);
    });

    it("leaves uncurated gardens alone", () => {
      expect(isGardenHiddenEverywhere(VIDA_VERDE)).toBe(false);
    });
  });

  describe("isGardenPubliclyVisible", () => {
    it("keeps an ordinary garden public", () => {
      expect(isGardenPubliclyVisible(garden(VIDA_VERDE))).toBe(true);
    });

    it("hides all three editorial-hidden gardens", () => {
      expect(isGardenPubliclyVisible(garden(COMMUNITY_GARDEN))).toBe(false);
      expect(isGardenPubliclyVisible(garden(AIYELOJA))).toBe(false);
      expect(isGardenPubliclyVisible(garden(MAMA_GARDENS))).toBe(false);
    });

    it("also hides gardens curated out of every surface", () => {
      expect(isGardenPubliclyVisible(garden(LIVE_GARDEN_COOP))).toBe(false);
    });

    it("matches regardless of address casing", () => {
      expect(isGardenPubliclyVisible(garden(AIYELOJA.toLowerCase()))).toBe(false);
    });

    it("hides placeholder gardens with neither name nor location", () => {
      expect(isGardenPubliclyVisible(garden(VIDA_VERDE, "", ""))).toBe(false);
      expect(isGardenPubliclyVisible(garden(VIDA_VERDE, "   ", "  "))).toBe(false);
    });

    it("keeps a garden with only one of name or location", () => {
      expect(isGardenPubliclyVisible(garden(VIDA_VERDE, "Vida Verde", ""))).toBe(true);
      expect(isGardenPubliclyVisible(garden(VIDA_VERDE, "", "Brazil"))).toBe(true);
    });

    it("treats null and undefined metadata as absent", () => {
      expect(isGardenPubliclyVisible({ id: VIDA_VERDE, name: null, location: null })).toBe(false);
      expect(isGardenPubliclyVisible({ id: VIDA_VERDE })).toBe(false);
    });
  });
});
