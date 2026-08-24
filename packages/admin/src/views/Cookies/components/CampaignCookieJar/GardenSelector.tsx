import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { useEnsName } from "@green-goods/shared/hooks/blockchain/useEnsName";
import type { Address, Garden } from "@green-goods/shared/types/domain";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "@/components/AdminButton";
import { AdminCheckbox } from "@/components/AdminCheckbox";
import { EnsAddressText, formatEnsAddressName } from "@/components/EnsAddressText";
import {
  filterCampaignCookieJarGardens,
  orderCampaignCookieJarGardensForSelection,
} from "../../campaignCookieJarPanel.model";

function GardenSelectorCheckbox({
  garden,
  selected,
  onToggle,
}: {
  garden: Garden;
  selected: boolean;
  onToggle: (gardenId: string) => void;
}) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(garden.id as Address);
  const addressLabel = formatEnsAddressName(garden.id as Address, ensName);

  return (
    <AdminCheckbox
      checked={selected}
      onChange={() => onToggle(garden.id)}
      label={garden.name}
      description={formatMessage(
        {
          id: "cockpit.community.cookies.operatorCount",
          defaultMessage: "{count, plural, one {# operator} other {# operators}} - {address}",
        },
        { count: garden.operators.length, address: addressLabel }
      )}
    />
  );
}

export function GardenSelector({
  gardens,
  selectedGardenIds,
  onToggle,
  onSelectMany,
  onClear,
  search,
  setSearch,
  listClassName = "max-h-80 overflow-y-auto",
}: {
  gardens: readonly Garden[];
  selectedGardenIds: readonly string[];
  onToggle: (gardenId: string) => void;
  onSelectMany?: (gardenIds: string[]) => void;
  onClear?: () => void;
  search: string;
  setSearch: (value: string) => void;
  listClassName?: string;
}) {
  const { formatMessage } = useIntl();
  const selectedSet = useMemo(
    () => new Set(selectedGardenIds.map((id) => id.toLowerCase())),
    [selectedGardenIds]
  );
  const filteredGardens = useMemo(
    () => filterCampaignCookieJarGardens(gardens, search),
    [gardens, search]
  );
  const visibleGardens = useMemo(
    () => orderCampaignCookieJarGardensForSelection(gardens, selectedGardenIds, search),
    [gardens, search, selectedGardenIds]
  );
  const allVisibleSelected =
    filteredGardens.length > 0 &&
    filteredGardens.every((garden) => selectedSet.has(garden.id.toLowerCase()));

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.searchGardens",
            defaultMessage: "Search gardens",
          })}
          htmlFor="campaign-cookie-jar-garden-search"
        >
          <TextInput
            id="campaign-cookie-jar-garden-search"
            surface="admin"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={formatMessage({
              id: "cockpit.community.cookies.searchGardensPlaceholder",
              defaultMessage: "Search by name, slug, or address",
            })}
          />
        </FormField>
        <div className="flex flex-wrap gap-2">
          <AdminButton
            type="button"
            variant="outlined"
            size="sm"
            onClick={() => onSelectMany?.(filteredGardens.map((garden) => garden.id))}
            disabled={!onSelectMany || filteredGardens.length === 0 || allVisibleSelected}
          >
            {formatMessage({
              id: "cockpit.community.cookies.selectVisibleGardens",
              defaultMessage: "Select visible",
            })}
          </AdminButton>
          <AdminButton
            type="button"
            variant="text"
            size="sm"
            onClick={onClear}
            disabled={!onClear || selectedGardenIds.length === 0}
          >
            {formatMessage({
              id: "cockpit.community.cookies.clearGardens",
              defaultMessage: "Clear",
            })}
          </AdminButton>
        </div>
      </div>
      <p className="text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
        {formatMessage(
          {
            id: "cockpit.community.cookies.gardenSelectorSummary",
            defaultMessage:
              "{selected, plural, one {# selected garden} other {# selected gardens}} - {visible, plural, one {# visible garden} other {# visible gardens}}",
          },
          { selected: selectedGardenIds.length, visible: filteredGardens.length }
        )}
      </p>
      <div
        className={`rounded-[var(--m3-shape-md)] border border-[rgb(var(--m3-outline-variant))] ${listClassName}`}
      >
        {visibleGardens.length === 0 ? (
          <p className="p-4 text-body-sm text-[rgb(var(--m3-on-surface-variant))]">
            {formatMessage({
              id: "cockpit.community.cookies.noGardenMatches",
              defaultMessage: "No gardens match that search.",
            })}
          </p>
        ) : (
          visibleGardens.map((garden) => (
            <div
              key={garden.id}
              className="flex cursor-pointer items-start gap-3 border-b border-[rgb(var(--m3-outline-variant))] px-3 py-2.5 last:border-b-0"
            >
              <GardenSelectorCheckbox
                garden={garden}
                selected={selectedSet.has(garden.id.toLowerCase())}
                onToggle={onToggle}
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export { EnsAddressText };
