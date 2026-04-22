import {
  adminRoutes,
  cn,
  DEFAULT_CHAIN_ID,
  useActions,
  useAdminStore,
  useAllAssessments,
  useGardens,
  useRole,
  type UserRole,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiCornerDownLeftLine,
  RiDashboardLine,
  RiFileList3Line,
  RiFlashlightLine,
  RiHammerFill,
  RiPlantLine,
  RiSearchLine,
  RiSettings3Line,
  RiUserLine,
} from "@remixicon/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { ADMIN_COMMAND_ROUTES } from "@/routes/views";
import { dispatchOpenAccountSheet } from "./accountSheet.events";

interface SearchResult {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  actionId?: "open-profile-sheet" | "open-settings-sheet";
  icon?: React.ComponentType<{ className?: string }>;
  category: "quick-actions" | "pages" | "gardens" | "actions" | "assessments";
  subtitle?: string;
  /** Match score — higher is a better fuzzy match. Used for ranking. */
  score?: number;
}

/**
 * Lightweight subsequence-based fuzzy match.
 * Returns a positive score when all query chars appear in order in text,
 * biased toward consecutive matches and matches near the start.
 * Returns 0 when the query doesn't match.
 */
function fuzzyScore(query: string, text: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let score = 0;
  let qi = 0;
  let lastMatchIdx = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      // Consecutive match bonus; proximity-to-start bonus
      const consecutive = lastMatchIdx === ti - 1 ? 5 : 0;
      const head = ti < 4 ? 3 - ti : 0;
      score += 1 + consecutive + head;
      lastMatchIdx = ti;
      qi++;
    }
  }
  return qi === q.length ? score : 0;
}

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CATEGORY_ICONS: Record<
  SearchResult["category"],
  React.ComponentType<{ className?: string }>
> = {
  "quick-actions": RiFlashlightLine,
  pages: RiDashboardLine,
  gardens: RiPlantLine,
  actions: RiHammerFill,
  assessments: RiFileList3Line,
};

const STATIC_ROUTES = ADMIN_COMMAND_ROUTES;

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps = {}) {
  const [internalOpen, setInternalOpen] = useState(false);

  // Support both controlled and uncontrolled modes
  const open = externalOpen ?? internalOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      onOpenChange?.(next);
      setInternalOpen(next);
    },
    [onOpenChange]
  );

  const [inputValue, setInputValue] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounce the search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputValue);
    }, 300);
    return () => clearTimeout(timer);
  }, [inputValue]);

  const navigate = useNavigate();
  const { formatMessage } = useIntl();
  const { data: gardens } = useGardens();
  const { data: actions } = useActions(DEFAULT_CHAIN_ID);
  const { data: assessments } = useAllAssessments(DEFAULT_CHAIN_ID);
  const { role } = useRole();
  const setSelectedGarden = useAdminStore((state) => state.setSelectedGarden);

  // Global keyboard shortcuts:
  // - Cmd/Ctrl+K: toggle palette
  // - Cmd/Ctrl+1..9: jump to nth garden (skipped when typing in an input)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(!open);
        return;
      }

      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey) return;
      const digit = Number.parseInt(e.key, 10);
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return;

      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && /^(INPUT|TEXTAREA|SELECT)$/.test(activeEl.tagName)) return;
      if (activeEl?.isContentEditable) return;

      const target = gardens?.[digit - 1];
      if (!target) return;
      e.preventDefault();
      setSelectedGarden(target);
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [gardens, open, setOpen, setSelectedGarden]);

  // Build filtered results using debounced query (fuzzy subsequence match)
  const results = useMemo(() => {
    const rawQuery = debouncedQuery.trim();
    const hasQuery = rawQuery.length > 0;
    const items: SearchResult[] = [];

    const pushIfMatches = (item: Omit<SearchResult, "score">, haystacks: string[]) => {
      if (!hasQuery) {
        items.push(item);
        return;
      }
      const score = haystacks.reduce((max, hay) => Math.max(max, fuzzyScore(rawQuery, hay)), 0);
      if (score > 0) items.push({ ...item, score });
    };

    // Quick actions (role-gated)
    const quickActions: Array<{
      id: string;
      label: string;
      href?: string;
      actionId?: SearchResult["actionId"];
      icon?: React.ComponentType<{ className?: string }>;
      roles: UserRole[];
    }> = [
      {
        id: "quick-pending-reviews",
        label: formatMessage({
          id: "app.admin.nav.quickAction.pendingReviews",
          defaultMessage: "Go to Pending Reviews",
        }),
        href: adminRoutes.hubWork(),
        roles: ["deployer", "operator"],
      },
      {
        id: "quick-create-garden",
        label: formatMessage({
          id: "app.admin.nav.quickAction.createGarden",
          defaultMessage: "Create Garden",
        }),
        href: adminRoutes.gardenCreate(),
        roles: ["deployer"],
      },
      {
        id: "open-profile-sheet",
        label: formatMessage({
          id: "cockpit.nav.profile",
          defaultMessage: "Profile",
        }),
        actionId: "open-profile-sheet",
        icon: RiUserLine,
        roles: ["deployer", "operator", "user"],
      },
      {
        id: "open-settings-sheet",
        label: formatMessage({
          id: "cockpit.settings.title",
          defaultMessage: "Settings",
        }),
        actionId: "open-settings-sheet",
        icon: RiSettings3Line,
        roles: ["deployer", "operator", "user"],
      },
    ];

    for (const qa of quickActions) {
      if (!qa.roles.includes(role)) continue;
      pushIfMatches(
        {
          id: qa.id,
          label: qa.label,
          href: qa.href,
          actionId: qa.actionId,
          icon: qa.icon,
          category: "quick-actions",
        },
        [qa.label]
      );
    }

    // Static pages
    for (const route of STATIC_ROUTES) {
      const label = formatMessage({ id: route.labelId, defaultMessage: route.defaultLabel });
      pushIfMatches({ id: route.id, label, href: route.href, category: "pages" }, [label]);
    }

    // Gardens
    if (gardens) {
      for (const garden of gardens) {
        pushIfMatches(
          {
            id: `garden-${garden.id}`,
            label: garden.name,
            href: adminRoutes.garden(),
            onSelect: () => setSelectedGarden(garden),
            category: "gardens",
            subtitle: garden.location || undefined,
          },
          [garden.name, garden.location ?? ""]
        );
      }
    }

    // Actions
    if (actions) {
      for (const action of actions) {
        pushIfMatches(
          {
            id: `action-${action.id}`,
            label: action.title,
            href: adminRoutes.actionDetail(action.id),
            category: "actions",
            subtitle: action.startTime
              ? new Date(action.startTime * 1000).toLocaleDateString()
              : undefined,
          },
          [action.title]
        );
      }
    }

    // Assessments
    if (assessments) {
      for (const assessment of assessments) {
        const title = assessment.title || `Assessment ${assessment.id.slice(0, 8)}`;
        const matchedGarden = gardens?.find(
          (g) => g.tokenAddress.toLowerCase() === assessment.gardenAddress.toLowerCase()
        );
        const gardenName = matchedGarden?.name;
        pushIfMatches(
          {
            id: `assessment-${assessment.id}`,
            label: title,
            href: matchedGarden
              ? adminRoutes.share(adminRoutes.gardenImpact(), matchedGarden.tokenAddress, {
                  section: "assessments",
                  item: assessment.id,
                })
              : adminRoutes.gardenImpact({
                  section: "assessments",
                  item: assessment.id,
                }),
            onSelect: matchedGarden ? () => setSelectedGarden(matchedGarden) : undefined,
            category: "assessments",
            subtitle: gardenName ? gardenName : `Garden ${assessment.gardenAddress.slice(0, 8)}...`,
          },
          [title, gardenName ?? ""]
        );
      }
    }

    // Rank by score when a query is active; preserve insertion order otherwise
    if (hasQuery) {
      items.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    }

    return items;
  }, [actions, assessments, debouncedQuery, formatMessage, gardens, role, setSelectedGarden]);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: { category: string; label: string; items: SearchResult[] }[] = [];

    const categoryLabels: Record<SearchResult["category"], { id: string; defaultMessage: string }> =
      {
        "quick-actions": {
          id: "app.admin.nav.searchQuickActions",
          defaultMessage: "Quick Actions",
        },
        pages: { id: "app.admin.nav.searchPages", defaultMessage: "Pages" },
        gardens: { id: "app.admin.nav.searchGardens", defaultMessage: "Gardens" },
        actions: { id: "app.admin.nav.searchActions", defaultMessage: "Actions" },
        assessments: { id: "app.admin.nav.searchAssessments", defaultMessage: "Assessments" },
      };

    for (const cat of ["quick-actions", "pages", "gardens", "actions", "assessments"] as const) {
      const items = results.filter((r) => r.category === cat);
      if (items.length > 0) {
        groups.push({
          category: cat,
          label: formatMessage(categoryLabels[cat]),
          items,
        });
      }
    }

    return groups;
  }, [results, formatMessage]);

  // Reset state when dialog opens/closes
  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      setOpen(isOpen);
      if (isOpen) {
        setInputValue("");
        setDebouncedQuery("");
        setActiveIndex(0);
      }
    },
    [setOpen]
  );

  // Navigate to a result or dispatch a sheet-opening action
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

  // Keyboard navigation within results
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % Math.max(results.length, 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + results.length) % Math.max(results.length, 1));
      } else if (e.key === "Enter" && results[activeIndex]) {
        e.preventDefault();
        selectResult(results[activeIndex]);
      }
    },
    [results, activeIndex, selectResult]
  );

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Reset active index on debounced query change
  useEffect(() => {
    setActiveIndex(0);
  }, [debouncedQuery]);

  let flatIndex = 0;

  return (
    <>
      <Dialog.Root open={open} onOpenChange={handleOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-overlay bg-overlay" />
          <Dialog.Content
            className="bg-bg-white fixed left-1/2 top-[20%] z-modal w-full max-w-lg -translate-x-1/2 rounded-xl border border-stroke-sub shadow-xl animate-fade-in-up"
            onKeyDown={handleKeyDown}
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
          >
            <Dialog.Title className="sr-only">
              {formatMessage({
                id: "app.admin.nav.commandPalette",
                defaultMessage: "Command palette",
              })}
            </Dialog.Title>
            <Dialog.Description className="sr-only">
              {formatMessage({
                id: "app.admin.nav.searchPlaceholder",
                defaultMessage: "Search pages, gardens, actions...",
              })}
            </Dialog.Description>

            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-stroke-soft px-4">
              <RiSearchLine className="h-5 w-5 shrink-0 text-text-soft" aria-hidden="true" />
              <input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={formatMessage({
                  id: "app.admin.nav.searchPlaceholder",
                  defaultMessage: "Search pages, gardens, actions...",
                })}
                className="flex-1 h-10 bg-transparent rounded-sm py-3 text-body-lg text-text-strong placeholder:text-text-soft shadow-[var(--edge-rest)] focus:shadow-[var(--edge-focus)] transition-shadow duration-[var(--spring-micro-duration,150ms)] outline-none"
              />
            </div>

            {/* Results */}
            <div ref={listRef} className="max-h-72 overflow-y-auto p-2" role="listbox">
              {results.length === 0 ? (
                <p className="py-6 text-center text-sm text-text-soft">
                  {formatMessage({
                    id: "app.admin.nav.searchNoResults",
                    defaultMessage: "No results found",
                  })}
                </p>
              ) : (
                grouped.map((group) => (
                  <div key={group.category} role="group" aria-label={group.label}>
                    <div className="px-2 py-1.5 text-label-sm text-text-soft">{group.label}</div>
                    {group.items.map((result) => {
                      const index = flatIndex++;
                      const isActive = index === activeIndex;
                      const Icon =
                        result.icon ??
                        (result.category === "pages"
                          ? CATEGORY_ICONS.pages
                          : CATEGORY_ICONS[result.category]);
                      return (
                        <button
                          key={result.id}
                          role="option"
                          aria-selected={isActive}
                          data-index={index}
                          onClick={() => selectResult(result)}
                          onMouseMove={() => setActiveIndex(index)}
                          className={cn(
                            "flex w-full items-center rounded-sm px-3 py-2 text-body-md text-left transition-colors",
                            isActive
                              ? "bg-primary-alpha-16 text-primary-darker"
                              : "text-text-sub hover:bg-bg-soft"
                          )}
                        >
                          {Icon && <Icon className="h-4 w-4 mr-2 flex-shrink-0 text-text-soft" />}
                          <div className="min-w-0 flex-1">
                            <span className="truncate">{result.label}</span>
                            {result.subtitle && (
                              <span className="block truncate text-xs text-text-soft">
                                {result.subtitle}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer hints */}
            <div className="flex items-center gap-4 border-t border-stroke-soft px-4 py-2 text-xs text-text-soft">
              <span className="flex items-center gap-1">
                <RiArrowUpLine className="h-3 w-3" aria-hidden="true" />
                <RiArrowDownLine className="h-3 w-3" aria-hidden="true" />
                <span>
                  {formatMessage({
                    id: "app.admin.nav.searchNavigate",
                    defaultMessage: "Navigate",
                  })}
                </span>
              </span>
              <span className="flex items-center gap-1">
                <RiCornerDownLeftLine className="h-3 w-3" aria-hidden="true" />
                <span>
                  {formatMessage({ id: "app.admin.nav.searchSelect", defaultMessage: "Select" })}
                </span>
              </span>
              <span className="ml-auto">
                Esc {formatMessage({ id: "app.admin.nav.searchClose", defaultMessage: "to close" })}
              </span>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
