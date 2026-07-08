import { useCallback, useEffect, useMemo } from "react";
import type { Garden } from "../../stores/useAdminStore";
import { compareAddresses } from "../../utils/blockchain/address";
import { useAdminGardenContext } from "./useAdminGardenContext";

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
  const { activeGarden, eligibleGardens, isLoaded, selectGarden, clearGarden } =
    useAdminGardenContext();

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
      if (fullGarden) {
        selectGarden(fullGarden);
      }
    },
    [eligibleGardens, selectGarden]
  );

  useEffect(() => {
    if (!autoSelectFirstGarden || !isLoaded || !activeGarden) {
      return;
    }

    onAutoSelectGarden?.(activeGarden);
  }, [activeGarden, autoSelectFirstGarden, isLoaded, onAutoSelectGarden]);

  return {
    eligibleGardens,
    selectedGarden: activeGarden,
    setSelectedGarden: (garden) => {
      if (garden) {
        selectGarden(garden);
      } else {
        clearGarden();
      }
    },
    gardenOptions,
    handleSelectGarden,
  };
}
