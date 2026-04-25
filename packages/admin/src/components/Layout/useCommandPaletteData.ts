import {
  DEFAULT_CHAIN_ID,
  type Garden,
  useActions,
  useAllAssessments,
  useEligibleAdminGardens,
  useRole,
} from "@green-goods/shared";
import { useMemo } from "react";
import type { IntlShape } from "react-intl";
import { ADMIN_COMMAND_ROUTES } from "@/routes/views";
import { buildCommandPaletteResults, type SearchResult } from "./commandPalette.results";

export interface CommandPaletteGroup {
  category: SearchResult["category"];
  label: string;
  items: SearchResult[];
}

const CATEGORY_LABELS: Record<SearchResult["category"], { id: string; defaultMessage: string }> = {
  "quick-actions": {
    id: "app.admin.nav.searchQuickActions",
    defaultMessage: "Quick Actions",
  },
  pages: { id: "app.admin.nav.searchPages", defaultMessage: "Pages" },
  gardens: { id: "app.admin.nav.searchGardens", defaultMessage: "Gardens" },
  actions: { id: "app.admin.nav.searchActions", defaultMessage: "Actions" },
  assessments: { id: "app.admin.nav.searchAssessments", defaultMessage: "Assessments" },
};

const RESULT_CATEGORY_ORDER: SearchResult["category"][] = [
  "quick-actions",
  "pages",
  "gardens",
  "actions",
  "assessments",
];

interface CommandPaletteDataOptions {
  query: string;
  formatMessage: IntlShape["formatMessage"];
  selectGarden: (garden: Garden) => void;
}

export function groupCommandPaletteResults(
  results: SearchResult[],
  formatMessage: IntlShape["formatMessage"]
): CommandPaletteGroup[] {
  return RESULT_CATEGORY_ORDER.flatMap((category) => {
    const items = results.filter((result) => result.category === category);
    return items.length > 0
      ? [
          {
            category,
            label: formatMessage(CATEGORY_LABELS[category]),
            items,
          },
        ]
      : [];
  });
}

export function useCommandPaletteData({
  query,
  formatMessage,
  selectGarden,
}: CommandPaletteDataOptions) {
  const { eligibleGardens } = useEligibleAdminGardens();
  const { data: actions } = useActions(DEFAULT_CHAIN_ID);
  const { data: assessments } = useAllAssessments(DEFAULT_CHAIN_ID);
  const { role } = useRole();

  const results = useMemo(
    () =>
      buildCommandPaletteResults({
        query,
        role,
        formatMessage,
        staticRoutes: ADMIN_COMMAND_ROUTES,
        eligibleGardens,
        actions: actions ?? [],
        assessments: assessments ?? [],
        selectGarden,
      }),
    [actions, assessments, eligibleGardens, formatMessage, query, role, selectGarden]
  );

  const groups = useMemo(
    () => groupCommandPaletteResults(results, formatMessage),
    [formatMessage, results]
  );

  return {
    eligibleGardens,
    groups,
    results,
  };
}
