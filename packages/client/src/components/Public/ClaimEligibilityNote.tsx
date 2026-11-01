import { Alert } from "@green-goods/shared/components/Alert";
import type { useCampaignCookieJar } from "@green-goods/shared/hooks/cookie-jar/useCampaignCookieJar";
import { useIntl } from "react-intl";

export function ClaimEligibilityNote({
  jar,
  nextClaimLabel,
}: {
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]>;
  nextClaimLabel: string | null;
}) {
  const { formatMessage } = useIntl();

  const restriction = !jar.isEligible
    ? formatMessage({
        id: "public.cookies.notEligible",
        defaultMessage:
          "This jar is for garden stewards on the campaign allowlist. Your wallet is not on the list yet.",
      })
    : jar.balance === 0n
      ? formatMessage({
          id: "public.cookies.needsFunding",
          defaultMessage: "This jar needs funds before claims can go out.",
        })
      : jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n
        ? formatMessage({
            id: "public.cookies.alreadyClaimed",
            defaultMessage: "This wallet has already claimed from this jar.",
          })
        : nextClaimLabel
          ? formatMessage(
              {
                id: "public.cookies.nextClaim",
                defaultMessage: "Next claim window opens at {time}.",
              },
              { time: nextClaimLabel }
            )
          : null;
  if (jar.isPaused || !restriction) {
    return (
      <Alert variant={jar.isPaused ? "warning" : "success"} className="p-3">
        {formatMessage({
          id: jar.isPaused ? "public.cookies.paused" : "public.cookies.ready",
          defaultMessage: jar.isPaused
            ? "Claims are paused for this jar."
            : "You are on the list. Claim when you are ready.",
        })}
      </Alert>
    );
  }
  return (
    <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
      {restriction}
    </p>
  );
}
