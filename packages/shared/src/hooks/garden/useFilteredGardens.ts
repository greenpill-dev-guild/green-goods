import type { Garden } from "../../types";
import { gardenHasMember } from "../../utils";

export type GardenFilterScope = "all" | "mine";
export type GardenSortOrder = "default" | "name" | "recent";

export interface GardenFiltersState {
  scope: GardenFilterScope;
  sort: GardenSortOrder;
}

export interface UseFilteredGardensResult {
  /** The filtered and sorted gardens */
  filteredGardens: Garden[];
  /** Count of gardens where the user is a member */
  myGardensCount: number;
  /** Whether any filter is active (not default) */
  isFilterActive: boolean;
  /** Count of active filters (0-2) */
  activeFilterCount: number;
}

/**
 * Filters and sorts a list of gardens based on user preferences.
 *
 * @param gardens - The full list of gardens
 * @param filters - Current filter/sort settings
 * @param userAddress - The user's primary address (lowercase) or null if not authenticated
 *
 * @example
 * ```tsx
 * const { data: gardens = [] } = useGardens();
 * const primaryAddress = usePrimaryAddress();
 * const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "default" });
 *
 * const { filteredGardens, myGardensCount, isFilterActive } = useFilteredGardens(
 *   gardens,
 *   filters,
 *   primaryAddress?.toLowerCase() ?? null
 * );
 * ```
 */
export function useFilteredGardens(
  gardens: Garden[],
  filters: GardenFiltersState,
  userAddress: string | null
): UseFilteredGardensResult {
  const { scope, sort } = filters;

  // Count user's gardens
  const myGardensCount = userAddress
    ? gardens.reduce(
        (count, garden) =>
          count + (gardenHasMember(userAddress, garden.gardeners, garden.operators) ? 1 : 0),
        0
      )
    : 0;

  // Filter by scope
  let working = gardens;
  if (scope === "mine") {
    if (!userAddress) {
      working = [];
    } else {
      working = gardens.filter((garden) =>
        gardenHasMember(userAddress, garden.gardeners, garden.operators)
      );
    }
  }

  // Sort
  let filteredGardens: Garden[];
  if (sort === "name") {
    filteredGardens = [...working].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  } else if (sort === "recent") {
    filteredGardens = [...working].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } else {
    filteredGardens = [...working];
  }

  // Compute filter state
  const isScopeFiltered = scope !== "all";
  const isSortFiltered = sort !== "default";
  const isFilterActive = isScopeFiltered || isSortFiltered;
  const activeFilterCount = (isScopeFiltered ? 1 : 0) + (isSortFiltered ? 1 : 0);

  return {
    filteredGardens,
    myGardensCount,
    isFilterActive,
    activeFilterCount,
  };
}
