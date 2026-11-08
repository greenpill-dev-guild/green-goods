import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import type { Address } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { useIntl } from "react-intl";
import { AdminFilterChip } from "../AdminFilterChip";
import { AdminInputChip } from "../AdminInputChip";
import { AdminSearchToolbar } from "../AdminSearchToolbar";
import { AdminSelect } from "../AdminTextField";
import { getRoleLabel } from "./gardenUtils";
import type { RoleFilter } from "./manageRoles";

interface ManageRolesFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  /** The one person a directory row opened Manage Roles for, while the list shows only them. */
  scopedTo: Address | null;
  /** The name that person's row shows, once it has been read. */
  scopedName?: string;
  onShowEveryone: () => void;
  /** The roles someone in the garden holds, in role order. */
  roles: readonly GardenRole[];
  /** Something is picked, so the Selected filter is offered. */
  hasPicks: boolean;
  activeFilter: RoleFilter;
  onFilterChange: (filter: RoleFilter) => void;
  /** Shows every picked person, whatever was typed. */
  onShowPicked: () => void;
}

/**
 * How a steward narrows Manage Roles: a search, the one person a directory row opened it for,
 * and a role filter whose chips fold into one select below a 480px container (DL-141). None of
 * them changes what is picked. A chip pressed again lets go, and Selected shows every pick.
 * Render it inside an `@container`.
 */
export function ManageRolesFilters({
  search,
  onSearchChange,
  scopedTo,
  scopedName,
  onShowEveryone,
  roles,
  hasPicks,
  activeFilter,
  onFilterChange,
  onShowPicked,
}: ManageRolesFiltersProps) {
  const { formatMessage } = useIntl();
  const label = formatMessage({ id: "cockpit.community.members.filterAria" });
  const options: { value: RoleFilter; label: string }[] = [
    { value: "all", label: formatMessage({ id: "cockpit.community.members.filterAll" }) },
    ...roles.map((role) => ({ value: role, label: getRoleLabel(role, formatMessage).plural })),
  ];
  if (hasPicks) {
    options.push({
      value: "selected",
      label: formatMessage({ id: "admin.manageRoles.filterSelected" }),
    });
  }

  return (
    <>
      <AdminSearchToolbar
        search={search}
        onSearchChange={onSearchChange}
        placeholder={formatMessage({ id: "app.garden.detail.community.memberSearch" })}
      />
      {scopedTo ? (
        <AdminInputChip
          label={
            <AddressDisplay address={scopedTo} list>
              {(name) => name}
            </AddressDisplay>
          }
          text={scopedName ?? formatAddress(scopedTo, { variant: "card" })}
          onRemove={onShowEveryone}
          removeLabel={formatMessage({ id: "admin.manageRoles.showEveryone" })}
        />
      ) : null}
      <AdminSelect
        className="@[480px]:hidden"
        label={label}
        value={activeFilter}
        onChange={(event) => {
          const next = event.target.value as RoleFilter;
          // Selected shows every pick, from the select as from its chip.
          if (next === "selected") onShowPicked();
          else onFilterChange(next);
        }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </AdminSelect>
      <div className="hidden flex-wrap gap-2 @[480px]:flex" role="group" aria-label={label}>
        {options.map((option) => {
          const on = !scopedTo && activeFilter === option.value;
          return (
            <AdminFilterChip
              key={option.value}
              label={option.label}
              selected={on}
              onToggle={() => {
                if (on && option.value !== "all") onFilterChange("all");
                else if (option.value === "selected") onShowPicked();
                else onFilterChange(option.value);
              }}
            />
          );
        })}
      </div>
    </>
  );
}
