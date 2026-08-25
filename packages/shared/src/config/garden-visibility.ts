/**
 * Curated garden visibility.
 *
 * Not every garden minted on-chain belongs on every Green Goods surface. One
 * was created for a different project. Others are real gardens whose recorded
 * work is people practicing rather than impact, so counting it as evidence on
 * the public website would overstate what we can show.
 *
 * There is no visibility flag on `Garden` in the contract or the indexer, so
 * the list is curated here. Entries are keyed by garden address, never by
 * name: names are steward-editable, and a name-matching shortcut has already
 * caused one bug in this codebase.
 *
 * Two tiers:
 *   - `GARDENS_HIDDEN_EVERYWHERE` is filtered inside `getGardens()`, so the
 *     garden is absent from the client PWA and admin dashboard as well.
 *   - `GARDENS_HIDDEN_FROM_EDITORIAL` is filtered only by the public hooks, so
 *     the garden keeps working normally for the people using it while staying
 *     off the public archive, impact ledger, funding list, and proof counters.
 *
 * To change a garden's visibility, edit the relevant list. Every entry carries
 * the reason it is there.
 */

import type { Address } from "../types/domain";

interface CuratedGarden {
  address: Address;
  /** Garden name when curated. Documentation only — never used to match. */
  name: string;
  reason: string;
}

/** Absent from every surface: public website, client PWA, and admin. */
export const GARDENS_HIDDEN_EVERYWHERE: readonly CuratedGarden[] = [
  {
    address: "0x3F22568aE0deAA24dA7b8c669AfDcBD72A6A7fd8",
    name: "Live Garden Coop",
    reason: "Created during Coop project work; never a Green Goods garden.",
  },
] as const;

/** Absent from the public website, but fully functional in the PWA and admin. */
export const GARDENS_HIDDEN_FROM_EDITORIAL: readonly CuratedGarden[] = [
  {
    address: "0xf401f34378384713222d1d21f63359cc4E8a858a",
    name: "Green Goods Community Garden",
    reason: "Open-joining onramp; its work is people practicing, not impact.",
  },
  {
    address: "0xF7b892886998DAe960D64a9db488336684F137A0",
    name: "Aiyeloja Family Garden",
    reason: "Carries test work; a small family garden, not a representative example.",
  },
  {
    address: "0x35077CaF6fBef1d5677d318a198C9c47C61bb976",
    name: "Mama Gardens",
    reason: "Carries test work; a small family garden, not a representative example.",
  },
] as const;

const hiddenEverywhere = new Set(GARDENS_HIDDEN_EVERYWHERE.map((g) => g.address.toLowerCase()));
const hiddenFromEditorial = new Set(
  GARDENS_HIDDEN_FROM_EDITORIAL.map((g) => g.address.toLowerCase())
);

/**
 * True when a garden is curated out of every surface.
 *
 * Garden addresses arrive checksummed from the indexer and lower-cased from
 * other joins, so both sides are normalized before comparing.
 */
export function isGardenHiddenEverywhere(address: string): boolean {
  return hiddenEverywhere.has(address.toLowerCase());
}

/**
 * True when a garden should appear on the public website.
 *
 * Also carries the placeholder check that was previously copy-pasted across
 * the three public hooks: a garden with neither name nor location has never
 * been filled in. The indexer does track this properly as
 * `Garden.initialized`, but `getGardens()` does not select that field, so the
 * heuristic stands in until it does.
 */
export function isGardenPubliclyVisible(garden: {
  id: string;
  name?: string | null;
  location?: string | null;
}): boolean {
  const address = garden.id.toLowerCase();
  if (hiddenEverywhere.has(address) || hiddenFromEditorial.has(address)) return false;

  const hasName = (garden.name ?? "").trim().length > 0;
  const hasLocation = (garden.location ?? "").trim().length > 0;
  return hasName || hasLocation;
}
