import { useCallback, useEffect, useMemo } from "react";
import { useAdminStore, type Garden } from "../../stores/useAdminStore";
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
  const { eligibleGardens, isLoaded } = useEligibleAdminGardens();
  const selectedGarden = useAdminStore((state) => state.selectedGarden);
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);

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
      const fullGarden = eligibleGardens.find((entry) => entry.id === garden.id);
      setSelectedGarden(fullGarden ?? null);
    },
    [eligibleGardens, setSelectedGarden]
  );

  useEffect(() => {
    if (!autoSelectFirstGarden || !isLoaded || selectedGarden || eligibleGardens.length === 0) {
      return;
    }

    const firstGarden = eligibleGardens[0];
    if (!firstGarden) return;

    setSelectedGarden(firstGarden);
    onAutoSelectGarden?.(firstGarden);
  }, [
    autoSelectFirstGarden,
    eligibleGardens,
    isLoaded,
    onAutoSelectGarden,
    selectedGarden,
    setSelectedGarden,
  ]);

  return {
    eligibleGardens,
    selectedGarden,
    setSelectedGarden,
    gardenOptions,
    handleSelectGarden,
  };
}
