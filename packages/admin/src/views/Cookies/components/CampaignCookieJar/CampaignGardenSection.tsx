import { AdminCardTitle } from "@/components/AdminCard";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";
import { GardenSelector } from "./GardenSelector";

export function CampaignGardenSection(props: CampaignCookieJarCreateFormProps) {
  const {
    formatMessage,
    gardens,
    selectedGardenIds,
    toggleGarden,
    selectGardens,
    clearGardens,
    gardenSearch,
    setGardenSearch,
    aggregation,
  } = props;
  return (
    <section className="surface-section overflow-visible">
      <div className="mb-4">
        <p className="text-label-sm text-text-sub">03</p>
        <AdminCardTitle as="h2">
          {formatMessage({
            id: "cockpit.community.cookies.createGardensSection",
            defaultMessage: "Eligible gardens",
          })}
        </AdminCardTitle>
      </div>
      <GardenSelector
        gardens={gardens}
        selectedGardenIds={selectedGardenIds}
        onToggle={toggleGarden}
        onSelectMany={selectGardens}
        onClear={clearGardens}
        search={gardenSearch}
        setSearch={setGardenSearch}
        listClassName="overflow-visible"
      />
      {aggregation.missingStewardGardens.length > 0 ? (
        <p className="mt-3 text-body-sm text-error-dark">
          {formatMessage(
            {
              id: "cockpit.community.cookies.missingStewardsSummary",
              defaultMessage:
                "{count, plural, one {# selected garden has no steward} other {# selected gardens have no steward}}.",
            },
            { count: aggregation.missingStewardGardens.length }
          )}
        </p>
      ) : null}
    </section>
  );
}
