import { Chip } from "@green-goods/shared/components/Chip";
import { SheetHeading } from "@green-goods/shared/components/Dialog/SheetHeading";
import { DOMAIN_CONFIG } from "@green-goods/shared/config/domain";
import type {
  GardenFilterScope,
  GardenFiltersState,
  GardenSortOrder,
} from "@green-goods/shared/hooks/garden/useFilteredGardens";
import { Domain } from "@green-goods/shared/types/domain";
import { cn } from "@green-goods/shared/utils/styles/cn";
import { useIntl } from "react-intl";
import { AppSheet } from "@/components/Sheets/AppSheet";
import { pwaStatusStyles } from "@/components/Pwa/statusStyles";

// Re-export types from shared for convenience
export type { GardenFilterScope, GardenFiltersState, GardenSortOrder };

/** The four action domains, in the order the app lists them. */
const DOMAIN_ORDER: Domain[] = [Domain.SOLAR, Domain.AGRO, Domain.EDU, Domain.WASTE];

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
    data-pressable="card"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "flex min-h-[56px] min-w-0 w-full flex-col justify-center rounded-[var(--radius-2xl)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-left text-sm transition-[background-color,border-color,box-shadow,transform,scale] duration-[var(--spring-effects-fast-duration)] ease-[var(--spring-effects-fast-easing)]",
      selected
        ? `${pwaStatusStyles.primary.border} ${pwaStatusStyles.primary.surface} ${pwaStatusStyles.primary.text} shadow-sm`
        : "",
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

const SectionTitle = ({ children }: { children: string }) => (
  <SheetHeading className="mb-3">{children}</SheetHeading>
);

type GardensFilterSheetProps = {
  isOpen: boolean;
  onClose: () => void;
  filters: GardenFiltersState;
  onScopeChange: (scope: GardenFilterScope) => void;
  onSortChange: (sort: GardenSortOrder) => void;
  onDomainsChange: (domains: Domain[]) => void;
  onReset: () => void;
  canFilterMine: boolean;
  myGardensCount: number;
  openGardensCount: number;
  isFilterActive: boolean;
};

/**
 * The Home garden filters at the full tier: which gardens to show (all, mine,
 * or open to anyone), the four action domains as chips, and the sort order,
 * with Reset Filters pinned in the shared bar.
 */
export const GardensFilterSheet = ({
  isOpen,
  onClose,
  filters,
  onScopeChange,
  onSortChange,
  onDomainsChange,
  onReset,
  canFilterMine,
  myGardensCount,
  openGardensCount,
  isFilterActive,
}: GardensFilterSheetProps) => {
  const intl = useIntl();
  const selectedDomains = filters.domains ?? [];

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
            defaultMessage: "Sign in to filter by your gardens.",
          })
        : myGardensCount === 0
          ? intl.formatMessage({
              id: "app.home.filters.scope.mineEmpty",
              defaultMessage: "No gardens assigned yet.",
            })
          : undefined,
      disabled: !canFilterMine,
    },
    {
      id: "open",
      label: intl.formatMessage(
        {
          id: "app.home.filters.scope.open",
          defaultMessage: "Open gardens ({count})",
        },
        { count: openGardensCount }
      ),
      description: intl.formatMessage({
        id: "app.home.filters.scope.openDescription",
        defaultMessage: "Anyone can join without an invitation.",
      }),
    },
  ];

  const sortOptions: Array<{ id: GardenSortOrder; label: string }> = [
    {
      id: "name",
      label: intl.formatMessage({
        id: "app.home.filters.sort.name",
        defaultMessage: "Name (A-Z)",
      }),
    },
    {
      id: "recent",
      label: intl.formatMessage({
        id: "app.home.filters.sort.recent",
        defaultMessage: "Newest first",
      }),
    },
  ];

  const toggleDomain = (domain: Domain) => {
    onDomainsChange(
      selectedDomains.includes(domain)
        ? selectedDomains.filter((value) => value !== domain)
        : [...selectedDomains, domain]
    );
  };

  return (
    <AppSheet
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: intl.formatMessage({
          id: "app.home.filters.title",
          defaultMessage: "Filter Gardens",
        }),
        description: intl.formatMessage({
          id: "app.home.filters.description",
          defaultMessage: "Narrow and sort the garden list.",
        }),
      }}
      size="full"
      actions={{
        secondary: {
          label: intl.formatMessage({
            id: "app.home.filters.reset",
            defaultMessage: "Reset Filters",
          }),
          onClick: onReset,
          disabled: !isFilterActive,
        },
      }}
    >
      <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-start gap-6 py-4">
        <section>
          <SectionTitle>
            {intl.formatMessage({
              id: "app.home.filters.scopeTitle",
              defaultMessage: "Show",
            })}
          </SectionTitle>
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
          <SectionTitle>
            {intl.formatMessage({
              id: "app.home.filters.domainsTitle",
              defaultMessage: "Domains",
            })}
          </SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {DOMAIN_ORDER.map((domain) => {
              const config = DOMAIN_CONFIG[domain];
              const Icon = config.icon;
              return (
                <Chip
                  key={domain}
                  className="min-w-0 w-full whitespace-normal text-center last:odd:col-span-2"
                  size="sm"
                  selected={selectedDomains.includes(domain)}
                  onClick={() => toggleDomain(domain)}
                  leadingIcon={<Icon className="h-4 w-4" aria-hidden="true" />}
                  data-testid={`filter-domain-${domain}`}
                >
                  {intl.formatMessage({ id: config.labelId })}
                </Chip>
              );
            })}
          </div>
        </section>

        <section>
          <SectionTitle>
            {intl.formatMessage({
              id: "app.home.filters.sortTitle",
              defaultMessage: "Sort by",
            })}
          </SectionTitle>
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
      </div>
    </AppSheet>
  );
};
