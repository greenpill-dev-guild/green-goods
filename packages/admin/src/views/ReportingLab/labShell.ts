/**
 * Garden reporting lab: what the cockpit's chrome shows around a prototype screen. A
 * steward's NavigationBar holds Hub, Garden and Community (Actions needs the operator's
 * `showActions` permission), and the GardenChip lists the lab's three sample gardens.
 */
import type { ToolbarSlot } from "@green-goods/shared/components/Canvas/NavigationBar";
import { RiAppsLine, RiSeedlingLine, RiTeamLine } from "@remixicon/react";
import type { MediaKey, MediaSet } from "./model";
import type { ScenarioId } from "./scenarios";

export const LAB_NAV_SLOTS: ToolbarSlot[] = [
  {
    id: "hub",
    label: "Hub",
    labelId: "cockpit.nav.hub",
    icon: RiAppsLine,
    path: "/hub",
    visible: true,
  },
  {
    id: "garden",
    label: "Garden",
    labelId: "cockpit.nav.garden",
    icon: RiSeedlingLine,
    path: "/garden",
    visible: true,
  },
  {
    id: "community",
    label: "Community",
    labelId: "cockpit.nav.community",
    icon: RiTeamLine,
    path: "/community",
    visible: true,
  },
];

const GARDENS: { id: string; name: string; media: MediaKey | null; scenario: ScenarioId }[] = [
  {
    id: "garden-riverbend",
    name: "Riverbend Compost Collective",
    media: "waste",
    scenario: "compost",
  },
  { id: "garden-hilltop", name: "Hilltop Learning Garden", media: "edu", scenario: "learning" },
  { id: "garden-northfield", name: "Northfield Garden", media: null, scenario: "new-garden" },
];

export interface LabGarden {
  id: string;
  name: string;
  bannerImage: string;
}

/** The GardenChip's gardens, with the open garden's name as its scenario spells it. */
export function labGardens(media: MediaSet, current?: { id: string; name: string }): LabGarden[] {
  return GARDENS.map((garden) => ({
    id: garden.id,
    name: garden.id === current?.id ? current.name : garden.name,
    bannerImage: garden.media ? media[garden.media] : "",
  }));
}

/** The scenario a garden opens on when the GardenChip picks it. */
export function scenarioForGarden(gardenId: string): ScenarioId | undefined {
  return GARDENS.find((garden) => garden.id === gardenId)?.scenario;
}
