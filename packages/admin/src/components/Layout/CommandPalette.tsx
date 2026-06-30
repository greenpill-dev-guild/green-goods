import {
  DEFAULT_CHAIN_ID,
  cn,
  useActions,
  useAllAssessments,
  useAdminGardenContext,
  useCommandPaletteController,
  useEligibleAdminGardens,
  useRole,
  type SearchResult,
} from "@green-goods/shared";
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
} from "@remixicon/react";
import { useEffect, useMemo, useRef, type ComponentType } from "react";
import { AdminDialog } from "@/components/AdminDialog";

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CATEGORY_ICONS: Record<SearchResult["category"], ComponentType<{ className?: string }>> = {
  "quick-actions": RiFlashlightLine,
  pages: RiDashboardLine,
  gardens: RiPlantLine,
  actions: RiHammerFill,
  assessments: RiFileList3Line,
};

export function CommandPalette({ open: externalOpen, onOpenChange }: CommandPaletteProps = {}) {
  const { eligibleGardens } = useEligibleAdminGardens();
  const { data: actions } = useActions(DEFAULT_CHAIN_ID);
  const { data: assessments } = useAllAssessments(DEFAULT_CHAIN_ID);
  const { role } = useRole();
  const { selectGarden } = useAdminGardenContext();
  const commandPaletteData = useMemo(
    () => ({
      eligibleGardens,
      actions: actions ?? [],
      assessments: assessments ?? [],
      role,
    }),
    [actions, assessments, eligibleGardens, role]
  );
  const {
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
  } = useCommandPaletteController({
    data: commandPaletteData,
    externalOpen,
    onOpenChange,
    selectGarden,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const activeEl = listRef.current.querySelector(`[data-index="${activeIndex}"]`);
    activeEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  let flatIndex = 0;

  return (
    <>
      <AdminDialog
        open={open}
        onOpenChange={handleOpenChange}
        title={formatMessage({
          id: "app.admin.nav.commandPalette",
          defaultMessage: "Command palette",
        })}
        description={formatMessage({
          id: "app.admin.nav.searchPlaceholder",
          defaultMessage: "Search pages, gardens, actions...",
        })}
        variant="palette"
        hideCloseButton
        onKeyDown={handleKeyDown}
      >
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
            className="flex-1 h-10 bg-transparent rounded-sm py-3 text-body-lg text-text-strong placeholder:text-text-soft shadow-[var(--edge-rest)] focus:shadow-[var(--edge-focus)] transition-shadow duration-[var(--spring-effects-fast-duration,150ms)] outline-none"
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
            groups.map((group) => (
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
      </AdminDialog>
    </>
  );
}
