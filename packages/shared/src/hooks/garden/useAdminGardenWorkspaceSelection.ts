import { useCallback, useEffect, useMemo } from "react";
import { useAdminStore, type Garden } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { useGardenUrlSync } from "../navigation/useGardenUrlSync";
import { useEligibleAdminGardens } from "./useEligibleAdminGardens";

export interface AdminGardenWorkspaceOption {
  id: string;
  name: string;
  location?: string;
}

export interface AdminGardenWorkspaceSelection {
  eligibleGardens: Garden[];
  selectedGarden: Garden | null;
  setSelectedGarden: (garden: Garden | null) => void;
  gardenOptions: AdminGardenWorkspaceOption[];
  handleSelectGarden: (garden: Pick<AdminGardenWorkspaceOption, "id">) => void;
}

interface AdminGardenWorkspaceSelectionOptions {
  autoSelectFirstGarden?: boolean;
  onAutoSelectGarden?: (garden: Garden) => void;
}

export function useAdminGardenWorkspaceSelection({
  autoSelectFirstGarden = false,
  onAutoSelectGarden,
}: AdminGardenWorkspaceSelectionOptions = {}): AdminGardenWorkspaceSelection {
  const { eligibleGardens, resolvedDefaultGarden, isLoaded } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);
  const { gardenId: syncedGardenId, setGarden } = useGardenUrlSync();

  const gardenOptions = useMemo<AdminGardenWorkspaceOption[]>(
    () =>
      eligibleGardens.map((garden) => ({
        id: garden.id,
        name: garden.name,
        location: garden.location,
      })),
    [eligibleGardens]
  );

  const handleSelectGarden = useCallback(
    (garden: Pick<AdminGardenWorkspaceOption, "id">) => {
      const fullGarden = eligibleGardens.find((entry) => compareAddresses(entry.id, garden.id));
      setGarden(fullGarden ?? null);
    },
    [eligibleGardens, setGarden]
  );

  useEffect(() => {
    if (
      !autoSelectFirstGarden ||
      !isLoaded ||
      selectedGarden ||
      syncedGardenId ||
      eligibleGardens.length === 0
    ) {
      return;
    }

    const nextGarden = resolvedDefaultGarden ?? eligibleGardens[0];
    if (!nextGarden) return;

    setGarden(nextGarden);
    onAutoSelectGarden?.(nextGarden);
  }, [
    autoSelectFirstGarden,
    eligibleGardens,
    isLoaded,
    onAutoSelectGarden,
    resolvedDefaultGarden,
    selectedGarden,
    setGarden,
    syncedGardenId,
  ]);

  return {
    eligibleGardens,
    selectedGarden,
    setSelectedGarden,
    gardenOptions,
    handleSelectGarden,
  };
}
