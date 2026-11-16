import { useIntl } from "react-intl";

/** The ownership issue block's time, which can follow the first qualifying action. */
export function BadgeIssuedDate({ issuedAt }: { issuedAt?: number }) {
  const intl = useIntl();
  const issuedOn = new Date((issuedAt ?? 0) * 1000);
  if (!issuedAt || issuedAt <= 0 || !Number.isFinite(issuedOn.getTime())) return null;

  return (
    <time dateTime={issuedOn.toISOString()} className="type-meta text-text-sub-600">
      {intl.formatMessage(
        { id: "app.profile.badges.issuedOn", defaultMessage: "Issued on {date}" },
        { date: intl.formatDate(issuedOn, { year: "numeric", month: "long", day: "numeric" }) }
      )}
    </time>
  );
}
