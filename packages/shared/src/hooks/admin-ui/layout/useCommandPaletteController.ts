import { adminRoutes, type Garden } from "@green-goods/shared";
import { useCallback, useEffect, useState, type KeyboardEvent } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { dispatchOpenAccountSheet } from "./accountSheet.events";
import type { SearchResult } from "./commandPalette.results";
import {
  useCommandPaletteDataFromSource,
  type CommandPaletteDataSource,
} from "./useCommandPaletteData";
import { useCommandPaletteShortcuts } from "./useCommandPaletteShortcuts";

interface CommandPaletteControllerOptions {
  data: CommandPaletteDataSource;
  selectGarden: (garden: Garden) => void;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function useCommandPaletteController({
  data,
  selectGarden,
  externalOpen,
  onOpenChange,
}: CommandPaletteControllerOptions) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const navigate = useNavigate();
  const { formatMessage } = useIntl();

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

  const { eligibleGardens, groups, results } = useCommandPaletteDataFromSource({
    query: debouncedQuery,
    formatMessage,
    selectGarden,
    data,
  });

  useCommandPaletteShortcuts({
    eligibleGardens,
    open,
    selectGarden,
    setOpen,
  });

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
