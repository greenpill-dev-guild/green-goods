import { GardenSelector } from "./GardenSelector";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";

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
        <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">03</p>
        <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
          {formatMessage({
            id: "cockpit.community.cookies.createGardensSection",
            defaultMessage: "Eligible gardens",
          })}
        </h2>
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
      {aggregation.missingOperatorGardens.length > 0 ? (
        <p className="mt-3 text-body-sm text-[rgb(var(--m3-error))]">
          {formatMessage(
            {
              id: "cockpit.community.cookies.missingOperatorsSummary",
              defaultMessage:
                "{count, plural, one {# selected garden has no operator} other {# selected gardens have no operator}}.",
            },
            { count: aggregation.missingOperatorGardens.length }
          )}
        </p>
      ) : null}
    </section>
  );
}
