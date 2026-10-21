import { useEffect, useMemo } from "react";
import { useAdminStore } from "../../stores/useAdminStore";
import { useGardens } from "../blockchain/useBaseLists";
import { useRole } from "../gardener/useRole";

/**
 * Resets selectedGarden when it no longer exists in either the base-list
 * gardens query OR the role-confirmed steward gardens. The steward-gardens
 * cross-check matches what `useEligibleAdminGardens` does — without it, a
 * garden recovered from a stale or errored base list (a stub injected by the
 * cross-check) would land on the canvas and then be cleared a render later
 * because the raw gardens list doesn't yet expose it. No-op while either
 * query is still loading.
 */
export function useStaleGardenGuard(): void {
  const selectedGarden = useAdminStore((s) => s.selectedGarden);
  const setSelectedGarden = useAdminStore((s) => s.setSelectedGarden);
  const { data: gardens } = useGardens();
  const { stewardGardens, loading: roleLoading } = useRole();

  const stewardGardenIdSet = useMemo(
    () => new Set(stewardGardens.map((og) => og.id.toLowerCase())),
    [stewardGardens]
  );

  useEffect(() => {
    if (gardens === undefined || roleLoading) return;
    if (selectedGarden === null) return;

    const idLower = selectedGarden.id.toLowerCase();
    const stillExists =
      gardens.some((g) => g.id.toLowerCase() === idLower) || stewardGardenIdSet.has(idLower);
    if (!stillExists) {
      setSelectedGarden(null);
    }
  }, [gardens, stewardGardenIdSet, roleLoading, selectedGarden, setSelectedGarden]);
}
