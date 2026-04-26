/**
 * Query keys for public read-side hooks (Living Archive journal).
 *
 * Public reads compose Envio (gardens, actions, hypercert linkage) and EAS
 * (works = field notes, garden assessments). Pages: `/sites`, `/field-notes`,
 * `/impact`, etc. consume these without auth.
 *
 * Per react-patterns Rule 7: serialize objects in keys for stable references.
 */

export interface PublicFieldNotesOptions {
  gardenAddress?: string;
  volume?: number;
  limit?: number;
  cursor?: number;
}

export interface PublicVolumeOptions {
  /** Volume identifier (Vol. I = Season One). */
  volumeId: number;
}

const stringifyOptions = (opts: object): string =>
  JSON.stringify(
    Object.entries(opts)
      .filter(([, value]) => value !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .reduce<Record<string, unknown>>((acc, [key, value]) => {
        acc[key] = value;
        return acc;
      }, {})
  );

export const publicKeys = {
  all: ["greengoods", "public"] as const,

  /** Public gardens list (sites). */
  gardens: (chainId: number) => ["greengoods", "public", "gardens", chainId] as const,

  /** Single public garden detail by slug or address. */
  gardenDetail: (slugOrAddress: string, chainId: number) =>
    ["greengoods", "public", "gardenDetail", slugOrAddress.toLowerCase(), chainId] as const,

  /** Field notes feed (paginated). */
  fieldNotes: (chainId: number, opts: PublicFieldNotesOptions = {}) =>
    ["greengoods", "public", "fieldNotes", chainId, stringifyOptions(opts)] as const,

  /** Single volume aggregate (Season-scoped). */
  volume: (chainId: number, volumeId: number) =>
    ["greengoods", "public", "volume", chainId, volumeId] as const,

  /** Network-wide aggregate stats. */
  stats: (chainId: number) => ["greengoods", "public", "stats", chainId] as const,
} as const;
