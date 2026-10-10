import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";
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
    <section>
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
