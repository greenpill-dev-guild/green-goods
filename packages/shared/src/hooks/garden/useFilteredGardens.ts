import type { Domain, Garden } from "../../types/domain";
import { gardenHasMember } from "../../utils/app/garden";
import { expandDomainMask } from "../../utils/domain";

export type GardenFilterScope = "all" | "mine";
export type GardenSortOrder = "name" | "recent";

export interface GardenFiltersState {
  scope: GardenFilterScope;
  sort: GardenSortOrder;
  /** Keep gardens tagged with any of these domains; empty or unset keeps all. */
  domains?: Domain[];
}

export interface UseFilteredGardensResult {
  /** The filtered and sorted gardens */
  filteredGardens: Garden[];
  /** Count of gardens where the user is a member */
  myGardensCount: number;
  /** Whether any filter is active (not default) */
  isFilterActive: boolean;
  /** Count of active filters (0-3) */
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
 * const [filters, setFilters] = useState<GardenFiltersState>({ scope: "all", sort: "recent" });
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
  const { scope, sort, domains = [] } = filters;

  // Count user's gardens
  const myGardensCount = userAddress
    ? gardens.reduce(
        (count, garden) =>
          count + (gardenHasMember(userAddress, garden.gardeners, garden.stewards) ? 1 : 0),
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
        gardenHasMember(userAddress, garden.gardeners, garden.stewards)
      );
    }
  }

  // Filter by domain: a garden stays when it carries any of the chosen domains
  if (domains.length > 0) {
    const wanted = new Set(domains);
    working = working.filter((garden) =>
      expandDomainMask(garden.domainMask ?? 0).some((domain) => wanted.has(domain))
    );
  }

  // Sort
  let filteredGardens: Garden[];
  if (sort === "recent") {
    filteredGardens = [...working].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } else {
    filteredGardens = [...working].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" })
    );
  }

  // Compute filter state
  const isScopeFiltered = scope !== "all";
  const isSortFiltered = sort !== "recent";
  const isDomainFiltered = domains.length > 0;
  const isFilterActive = isScopeFiltered || isSortFiltered || isDomainFiltered;
  const activeFilterCount =
    (isScopeFiltered ? 1 : 0) + (isSortFiltered ? 1 : 0) + (isDomainFiltered ? 1 : 0);

  return {
    filteredGardens,
    myGardensCount,
    isFilterActive,
    activeFilterCount,
  };
}
