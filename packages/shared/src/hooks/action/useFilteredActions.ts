import type { Action } from "../../types";
import { Domain } from "../../types";

export type ActionSortOrder = "default" | "title" | "recent";

export interface ActionFiltersState {
  search?: string;
  sort: ActionSortOrder;
  domain?: Domain;
}

export interface UseFilteredActionsResult {
  /** The filtered and sorted actions */
  filteredActions: Action[];
  /** Whether any filter is active (not default) */
  isFilterActive: boolean;
  /** Count of active filters (0-3) */
  activeFilterCount: number;
}

/**
 * Filters and sorts a list of actions based on user preferences.
 *
 * @param actions - The full list of actions
 * @param filters - Current filter/sort settings
 *
 * @example
 * ```tsx
 * const { data: actions = [] } = useActions(chainId);
 * const [filters, setFilters] = useState<ActionFiltersState>({ sort: "default" });
 *
 * const { filteredActions, isFilterActive } = useFilteredActions(actions, filters);
 * ```
 */
export function useFilteredActions(
  actions: Action[],
  filters: ActionFiltersState
): UseFilteredActionsResult {
  const { search, sort, domain } = filters;

  // Filter by domain
  let working = actions;
  if (domain !== undefined) {
    working = working.filter((action) => action.domain === domain);
  }

  // Filter by search text
  if (search) {
    const term = search.toLowerCase();
    working = working.filter(
      (action) =>
        (action.title || "").toLowerCase().includes(term) ||
        (action.description || "").toLowerCase().includes(term)
    );
  }

  // Sort
  let filteredActions: Action[];
  if (sort === "title") {
    filteredActions = [...working].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "", undefined, { sensitivity: "base" })
    );
  } else if (sort === "recent") {
    filteredActions = [...working].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
  } else {
    filteredActions = [...working];
  }

  // Compute filter state
  const isDomainFiltered = domain !== undefined;
  const isSortFiltered = sort !== "default";
  const isSearchActive = !!search;
  const isFilterActive = isDomainFiltered || isSortFiltered || isSearchActive;
  const activeFilterCount =
    (isDomainFiltered ? 1 : 0) + (isSortFiltered ? 1 : 0) + (isSearchActive ? 1 : 0);

  return {
    filteredActions,
    isFilterActive,
    activeFilterCount,
  };
}
