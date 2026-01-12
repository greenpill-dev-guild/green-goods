import type {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
} from "@green-goods/shared/hooks";
import { cn } from "@green-goods/shared/utils";
import { useIntl } from "react-intl";
import { Button } from "@/components/Actions";
import { ModalDrawer } from "@/components/Dialogs/ModalDrawer";

// Re-export types from shared for convenience
export type { GardenFilterScope, GardenFiltersState, GardenSortOrder };

export type FilterOptionButtonProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  description?: string;
};

const FilterOptionButton = ({
  label,
  selected,
  onClick,
  disabled = false,
  description,
}: FilterOptionButtonProps) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "w-full rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-3 text-left text-sm transition-all duration-200 min-h-[56px] flex flex-col justify-center tap-feedback",
      selected ? "border-primary bg-primary/10 text-primary shadow-sm" : "",
      disabled && "cursor-not-allowed opacity-60"
    )}
    aria-pressed={selected}
  >
    <span className="font-medium leading-tight">{label}</span>
    {description ? (
      <span className="mt-1 block text-xs text-text-sub-600">{description}</span>
    ) : null}
  </button>
);

type GardensFilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: GardenFiltersState;
  onScopeChange: (scope: GardenFilterScope) => void;
  onSortChange: (sort: GardenSortOrder) => void;
  onReset: () => void;
  canFilterMine: boolean;
  myGardensCount: number;
  isFilterActive: boolean;
};

export const GardensFilterDrawer = ({
  isOpen,
  onClose,
  filters,
  onScopeChange,
  onSortChange,
  onReset,
  canFilterMine,
  myGardensCount,
  isFilterActive,
}: GardensFilterDrawerProps) => {
  const intl = useIntl();

  const scopeOptions: Array<{
    id: GardenFilterScope;
    label: string;
    description?: string;
    disabled?: boolean;
  }> = [
    {
      id: "all",
      label: intl.formatMessage({
        id: "app.home.filters.scope.all",
        defaultMessage: "All gardens",
      }),
    },
    {
      id: "mine",
      label: intl.formatMessage(
        {
          id: "app.home.filters.scope.mine",
          defaultMessage: "My gardens ({count})",
        },
        { count: myGardensCount }
      ),
      description: !canFilterMine
        ? intl.formatMessage({
            id: "app.home.filters.scope.mineDisabled",
            defaultMessage: "Sign in or connect a wallet to filter by your gardens.",
          })
        : myGardensCount === 0
          ? intl.formatMessage({
              id: "app.home.filters.scope.mineEmpty",
              defaultMessage: "No gardens assigned yet.",
            })
          : undefined,
      disabled: !canFilterMine,
    },
  ];

  const sortOptions: Array<{ id: GardenSortOrder; label: string }> = [
    {
      id: "default",
      label: intl.formatMessage({
        id: "app.home.filters.sort.default",
        defaultMessage: "Default order",
      }),
    },
    {
      id: "recent",
      label: intl.formatMessage({
        id: "app.home.filters.sort.recent",
        defaultMessage: "Newest first",
      }),
    },
    {
      id: "name",
      label: intl.formatMessage({
        id: "app.home.filters.sort.name",
        defaultMessage: "Name (A-Z)",
      }),
    },
  ];

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: intl.formatMessage({
          id: "app.home.filters.title",
          defaultMessage: "Filter Gardens",
        }),
        description: intl.formatMessage({
          id: "app.home.filters.description",
          defaultMessage: "Filter by membership or sort order.",
        }),
      }}
    >
      <div className="flex flex-col gap-6">
        <section>
          <h6 className="mb-3 text-sm font-semibold text-text-sub-600">
            {intl.formatMessage({
              id: "app.home.filters.scopeTitle",
              defaultMessage: "Show",
            })}
          </h6>
          <div className="grid grid-cols-1 gap-2">
            {scopeOptions.map(({ id, ...option }) => (
              <FilterOptionButton
                key={id}
                {...option}
                selected={filters.scope === id}
                onClick={() => onScopeChange(id)}
              />
            ))}
          </div>
        </section>

        <section>
          <h6 className="mb-3 text-sm font-semibold text-text-sub-600">
            {intl.formatMessage({
              id: "app.home.filters.sortTitle",
              defaultMessage: "Sort by",
            })}
          </h6>
          <div className="grid grid-cols-1 gap-2">
            {sortOptions.map(({ id, ...option }) => (
              <FilterOptionButton
                key={id}
                {...option}
                selected={filters.sort === id}
                onClick={() => onSortChange(id)}
              />
            ))}
          </div>
        </section>

        <Button
          label={intl.formatMessage({
            id: "app.home.filters.reset",
            defaultMessage: "Reset filters",
          })}
          variant="neutral"
          mode="stroke"
          size="xsmall"
          onClick={onReset}
          disabled={!isFilterActive}
          type="button"
        />
      </div>
    </ModalDrawer>
  );
};
