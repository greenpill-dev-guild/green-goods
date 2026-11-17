import { useIntl, type IntlShape } from "react-intl";
import type { GardenMemberContribution } from "../modules/data/garden-member-contributions";
import type { ItemRowDetail } from "./Cards/ItemRow/ItemRow";
import { FactList, FactRow } from "./Cards/FactRow";

const validDate = (at: number | undefined): at is number =>
  typeof at === "number" && Number.isSafeInteger(at) && at > 0 && at <= 8_640_000_000_000_000;

/** The same recorded contribution fact in garden member rows and details. */
export function GardenContributionDate({
  contribution,
}: {
  contribution?: GardenMemberContribution;
}) {
  const intl = useIntl();
  if (!contribution) return null;
  const label = intl.formatMessage({ id: "app.garden.contribution.label" });
  const at = contribution.status === "recorded" ? contribution.at : undefined;
  const value = validDate(at) ? (
    <time dateTime={new Date(at).toISOString()}>
      {intl.formatDate(at, { year: "numeric", month: "short", day: "numeric" })}
    </time>
  ) : (
    intl.formatMessage({
      id:
        contribution.status === "loading"
          ? "app.garden.contribution.loading"
          : contribution.status === "none"
            ? "app.garden.contribution.none"
            : "app.garden.contribution.unavailable",
    })
  );
  return (
    <FactList frame="inset">
      <FactRow label={label} value={value} />
    </FactList>
  );
}

/** Compact rows keep the complete date; details carry the full recorded-contribution label. */
export function gardenContributionDetail(
  contribution: GardenMemberContribution | undefined,
  intl: IntlShape
): ItemRowDetail | undefined {
  if (!contribution) return undefined;
  if (contribution.status === "recorded" && validDate(contribution.at)) {
    return {
      text: intl.formatMessage(
        { id: "app.garden.contribution.lastOn" },
        {
          date: intl.formatDate(contribution.at, {
            year: "numeric",
            month: "numeric",
            day: "numeric",
          }),
        }
      ),
      dateTime: new Date(contribution.at).toISOString(),
      title:
        intl.formatMessage({ id: "app.garden.contribution.label" }) +
        ": " +
        intl.formatDate(contribution.at, { year: "numeric", month: "short", day: "numeric" }),
    };
  }
  return {
    text: intl.formatMessage({
      id:
        contribution.status === "loading"
          ? "app.garden.contribution.loading"
          : contribution.status === "none"
            ? "app.garden.contribution.rowNone"
            : "app.garden.contribution.rowUnavailable",
    }),
  };
}
