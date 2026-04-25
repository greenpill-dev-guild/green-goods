import {
  adminRoutes,
  DEFAULT_CHAIN_ID,
  useActions,
  useAdminStore,
  useAllAssessments,
  useEligibleAdminGardens,
  useRole,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { ADMIN_COMMAND_ROUTES } from "@/routes/views";
import { dispatchOpenAccountSheet } from "./accountSheet.events";
import { buildCommandPaletteResults, type SearchResult } from "./commandPalette.results";

interface CommandPaletteControllerOptions {
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

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

export function useCommandPaletteController({
  externalOpen,
  onOpenChange,
}: CommandPaletteControllerOptions = {}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { eligibleGardens } = useEligibleAdminGardens();
  const { data: actions } = useActions(DEFAULT_CHAIN_ID);
  const { data: assessments } = useAllAssessments(DEFAULT_CHAIN_ID);
  const { role } = useRole();
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);

  const open = externalOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      setInternalOpen(next);
    },
    [onOpenChange]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  useEffect(() => {
    function handleDocumentKeyDown(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setOpen(!open);
        return;
      }

      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      const digit = Number.parseInt(event.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;

      const activeElement = document.activeElement as HTMLElement | null;
      if (activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(activeElement.tagName)) return;
      if (activeElement?.isContentEditable) return;

      const targetGarden = eligibleGardens[digit - 1];
      if (!targetGarden) return;
      event.preventDefault();
      setSelectedGarden(targetGarden);
    }

    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => document.removeEventListener("keydown", handleDocumentKeyDown);
  }, [eligibleGardens, open, setOpen, setSelectedGarden]);

  const results = useMemo(
    () =>
      buildCommandPaletteResults({
        query: debouncedQuery,
        role,
        formatMessage,
        staticRoutes: ADMIN_COMMAND_ROUTES,
        eligibleGardens,
        actions: actions ?? [],
        assessments: assessments ?? [],
        selectGarden: setSelectedGarden,
      }),
    [actions, assessments, debouncedQuery, eligibleGardens, formatMessage, role, setSelectedGarden]
  );

  const groups = useMemo<CommandPaletteGroup[]>(
    () =>
      RESULT_CATEGORY_ORDER.flatMap((category) => {
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
      }),
    [formatMessage, results]
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        setInputValue("");
        setDebouncedQuery("");
        setActiveIndex(0);
      }
    },
    [setOpen]
  );

  const selectResult = useCallback(
    (result: SearchResult) => {
      setOpen(false);

      if (result.actionId) {
        const isDesktop =
          typeof window !== "undefined"
            ? (window.matchMedia?.("(min-width: 600px)").matches ?? false)
            : false;

        if (isDesktop) {
          const nextTab = result.actionId === "open-settings-sheet" ? "settings" : "profile";
          dispatchOpenAccountSheet(nextTab);
          return;
        }

        navigate(
          result.actionId === "open-settings-sheet"
            ? adminRoutes.profile({ tab: "settings" })
            : adminRoutes.profile()
        );
        return;
      }

      result.onSelect?.();

      if (result.href) {
        navigate(result.href);
      }
    },
    [navigate, setOpen]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (event.key === "Enter" && results[activeIndex]) {
        event.preventDefault();
        selectResult(results[activeIndex]);
      }
    },
    [activeIndex, results, selectResult]
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  return {
    activeIndex,
    formatMessage,
    groups,
    handleKeyDown,
    handleOpenChange,
    inputValue,
    open,
    results,
    selectResult,
    setActiveIndex,
    setInputValue,
  };
}
