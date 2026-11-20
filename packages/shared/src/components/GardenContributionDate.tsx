import { useIntl, type IntlShape } from "react-intl";
import type { GardenMemberContribution } from "../modules/data/garden-member-contributions";
import type { ItemRowDetail } from "./Cards/ItemRow/ItemRow";
import { FactList, FactRow } from "./Cards/FactRow";

const DATE_FORMAT = { year: "numeric", month: "short", day: "numeric" } as const;

const validDate = (at: number | undefined): at is number =>
  typeof at === "number" && Number.isSafeInteger(at) && at > 0 && at <= 8_640_000_000_000_000;

/**
 * The same recorded contribution fact in garden member rows and details. `row` renders the fact
 * alone, for a fact list that holds it with the membership dates.
 */
export function GardenContributionDate({
  contribution,
  row = false,
}: {
  contribution?: GardenMemberContribution;
  row?: boolean;
}) {
  const intl = useIntl();
  if (!contribution) return null;
  const label = intl.formatMessage({ id: "app.garden.contribution.label" });
  const at = contribution.status === "recorded" ? contribution.at : undefined;
  const value = validDate(at) ? (
    <time dateTime={new Date(at).toISOString()}>{intl.formatDate(at, DATE_FORMAT)}</time>
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
  const fact = <FactRow label={label} value={value} />;
  return row ? fact : <FactList frame="inset">{fact}</FactList>;
}

/**
 * A row's contribution detail, with its date written as the member's details write it; the
 * full recorded-contribution label shows on hover.
 */
export function gardenContributionDetail(
  contribution: GardenMemberContribution | undefined,
  intl: IntlShape
): ItemRowDetail | undefined {
  if (!contribution) return undefined;
  if (contribution.status === "recorded" && validDate(contribution.at)) {
    const date = intl.formatDate(contribution.at, DATE_FORMAT);
    return {
      text: intl.formatMessage({ id: "app.garden.contribution.lastOn" }, { date }),
      dateTime: new Date(contribution.at).toISOString(),
      title: `${intl.formatMessage({ id: "app.garden.contribution.label" })}: ${date}`,
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
