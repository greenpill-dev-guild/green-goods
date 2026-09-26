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
  /** The account's gardener cap, 0 for none; undefined until it is read from the chain. */
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
  /** Whether the cap above was read from the chain. Until it is, the cap cannot be edited. */
  capRead: boolean;
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
    capRead: garden.maxGardeners !== undefined,
    domains: expandDomainMask(garden.domainMask ?? 0),
    bannerFile: null,
    bannerRemoved: false,
  };
}

/**
 * The draft with the garden's cap once it is read, whatever else is edited: the cap could not be
 * edited before, so there is nothing of the steward's to keep.
 */
export function withReadCap(draft: SettingsDraft, garden: GardenSettingsValues): SettingsDraft {
  if (draft.capRead || garden.maxGardeners === undefined) return draft;
  const { limitGardeners, maxGardeners, capRead } = draftFromGarden(garden);
  return { ...draft, limitGardeners, maxGardeners, capRead };
}

/** The cap the draft saves: with the limit off, 0 (unlimited). */
export function effectiveMaxGardeners(draft: SettingsDraft): number {
  return draft.limitGardeners ? Number(draft.maxGardeners) : 0;
}

/**
 * What each field landed with this session and the refreshed garden has yet to
 * report, as `fieldValueKey` text. The banner needs no memory: its draft
 * clears once it saves.
 */
export type LandedValues = Partial<Record<Exclude<GardenSettingsField, "banner">, string>>;

/**
 * The fields whose draft differs from what the chain holds, in save order. A
 * value that landed this session stands in for the garden until the garden
 * reports it, so a landed field is not sent twice, and putting back the value
 * it replaced is still a change to send.
 */
export function dirtyFieldsOf(
  draft: SettingsDraft,
  garden: GardenSettingsValues,
  landed: LandedValues = {}
): GardenSettingsField[] {
  const saved = draftFromGarden(garden);
  return GARDEN_SETTINGS_FIELDS.filter((field) => {
    if (field === "banner") return Boolean(draft.bannerFile || draft.bannerRemoved);
    // A cap the draft has not read yet was never shown, so it cannot have changed.
    if (field === "maxGardeners" && !draft.capRead) return false;
    return fieldValueKey(draft, field) !== (landed[field] ?? fieldValueKey(saved, field));
  });
}

/** Forgets each landed value the refreshed garden now reports. */
export function withoutReportedValues(
  landed: LandedValues,
  garden: GardenSettingsValues
): LandedValues {
  const saved = draftFromGarden(garden);
  const entries = Object.entries(landed) as Array<[keyof LandedValues, string]>;
  const pending = entries.filter(([field, value]) => fieldValueKey(saved, field) !== value);
  return pending.length === entries.length ? landed : Object.fromEntries(pending);
}

/**
 * The refreshed garden as a clean draft, except where a value landed this
 * session and the garden has yet to report it: there the current draft,
 * which holds that value, stays.
 */
export function adoptRefreshedGarden(
  current: SettingsDraft,
  garden: GardenSettingsValues,
  landed: LandedValues
): SettingsDraft {
  const next = draftFromGarden(garden);
  for (const field of Object.keys(withoutReportedValues(landed, garden))) {
    switch (field as keyof LandedValues) {
      case "name":
        next.name = current.name;
        break;
      case "description":
        next.description = current.description;
        break;
      case "location":
        next.location = current.location;
        break;
      case "openJoining":
        next.openJoining = current.openJoining;
        break;
      case "maxGardeners":
        next.limitGardeners = current.limitGardeners;
        next.maxGardeners = current.maxGardeners;
        break;
      case "domains":
        next.domains = current.domains;
        break;
    }
  }
  return next;
}

/** What a field writes, as text: the form `LandedValues` remembers it in. */
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
