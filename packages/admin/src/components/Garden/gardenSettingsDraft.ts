import { Domain } from "@green-goods/shared/types/domain";
import { expandDomainMask } from "@green-goods/shared/utils/domain";

/**
 * The garden settings a save writes, in the order it sends them. Each is its
 * own transaction, so each asks the wallet once.
 */
const GARDEN_SETTINGS_FIELDS = [
  "name",
  "description",
  "location",
  "openJoining",
  "maxGardeners",
  "domains",
  "banner",
] as const;

export type GardenSettingsField = (typeof GARDEN_SETTINGS_FIELDS)[number];

/** The saved garden values the settings form edits. */
export interface GardenSettingsValues {
  name: string;
  description: string;
  location: string;
  bannerImage: string;
  domainMask?: number;
  openJoining?: boolean;
  maxGardeners?: number;
}

/** The four action domains a garden can document. Selected inline in the
 * settings draft and written on Save via `useSetGardenDomains`. */
export const DOMAIN_OPTIONS = [
  {
    value: Domain.SOLAR,
    labelId: "app.garden.create.domain.solar",
    defaultLabel: "Solar",
    descriptionId: "app.garden.create.domain.solar.description",
    defaultDescription: "Track solar panel installations, kWh generated, and maintenance",
  },
  {
    value: Domain.AGRO,
    labelId: "app.garden.create.domain.agro",
    defaultLabel: "Agroforestry",
    descriptionId: "app.garden.create.domain.agro.description",
    defaultDescription: "Document tree planting, harvests, and land stewardship",
  },
  {
    value: Domain.EDU,
    labelId: "app.garden.create.domain.edu",
    defaultLabel: "Education",
    descriptionId: "app.garden.create.domain.edu.description",
    defaultDescription: "Record workshops, trainings, and knowledge sharing",
  },
  {
    value: Domain.WASTE,
    labelId: "app.garden.create.domain.waste",
    defaultLabel: "Waste",
    descriptionId: "app.garden.create.domain.waste.description",
    defaultDescription: "Log waste collection, recycling, and composting activities",
  },
] as const;

export interface SettingsDraft {
  name: string;
  description: string;
  location: string;
  openJoining: boolean;
  /** Whether a gardener cap applies — off means unlimited (saves 0). */
  limitGardeners: boolean;
  /** The cap as a string while editing (only meaningful when limited). */
  maxGardeners: string;
  domains: Domain[];
  /** Locally selected banner file — uploads to IPFS only on Save. */
  bannerFile: File | null;
  /** Marks the saved banner for removal on Save. */
  bannerRemoved: boolean;
}

export function draftFromGarden(garden: GardenSettingsValues): SettingsDraft {
  const max = garden.maxGardeners ?? 0;
  return {
    name: garden.name,
    description: garden.description,
    location: garden.location,
    openJoining: !!garden.openJoining,
    limitGardeners: max > 0,
    maxGardeners: max > 0 ? String(max) : "",
    domains: expandDomainMask(garden.domainMask ?? 0),
    bannerFile: null,
    bannerRemoved: false,
  };
}

/** The cap the draft saves: with the limit off, 0 (unlimited). */
export function effectiveMaxGardeners(draft: SettingsDraft): number {
  return draft.limitGardeners ? Number(draft.maxGardeners) : 0;
}

function sameDomains(a: Domain[], b: Domain[]): boolean {
  return a.length === b.length && a.every((domain) => b.includes(domain));
}

/** The fields whose draft differs from the saved garden, in save order. */
export function dirtyFieldsOf(
  draft: SettingsDraft,
  garden: GardenSettingsValues
): GardenSettingsField[] {
  const saved = draftFromGarden(garden);
  const differs: Record<GardenSettingsField, boolean> = {
    name: draft.name.trim() !== saved.name,
    description: draft.description.trim() !== saved.description,
    location: draft.location.trim() !== saved.location,
    openJoining: draft.openJoining !== saved.openJoining,
    maxGardeners: effectiveMaxGardeners(draft) !== Number(garden.maxGardeners ?? 0),
    domains: !sameDomains(draft.domains, saved.domains),
    banner: Boolean(draft.bannerFile || draft.bannerRemoved),
  };
  return GARDEN_SETTINGS_FIELDS.filter((field) => differs[field]);
}

/**
 * What a field writes, as text. A save remembers the value each field landed
 * with, so Try Again skips a field whose draft still holds it, even before the
 * refreshed garden reports it. The banner needs no memory: its draft clears
 * once it saves.
 */
export function fieldValueKey(
  draft: SettingsDraft,
  field: Exclude<GardenSettingsField, "banner">
): string {
  switch (field) {
    case "name":
      return draft.name.trim();
    case "description":
      return draft.description.trim();
    case "location":
      return draft.location.trim();
    case "openJoining":
      return String(draft.openJoining);
    case "maxGardeners":
      return String(effectiveMaxGardeners(draft));
    case "domains":
      return [...draft.domains].sort().join(",");
  }
}
