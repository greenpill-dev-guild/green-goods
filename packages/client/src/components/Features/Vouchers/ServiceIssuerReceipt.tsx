import type {
  ServiceIssuerAsset,
  ServiceIssuerOutcome,
} from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import { issuerAmount } from "./serviceIssuerPresentation";
/** Keep the actual delivery and selected exchange with its confirmed receipt. */
export function ServiceIssuerReceipt({
  outcome,
  deliveredAsset,
  pool,
}: {
  outcome: ServiceIssuerOutcome | null;
  deliveredAsset?: ServiceIssuerAsset;
  pool: { name: string; address: string } | null;
}) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const text = (key: string) => formatMessage({ id: `app.profile.issuer.${key}` });
  return outcome?.status === "confirmed" ? (
    <p role="status" className="text-sm">
      {pool ? (
        <span className="block">
          {formatMessage({ id: "app.voucher.exchange.pool" })}: {pool.name}
          <span className="block break-all text-xs text-text-sub-600">{pool.address}</span>
        </span>
      ) : null}
      {outcome.currentStateMatchesReceipt === false ? (
        <span className="block">{text("stateChangedAfterReceipt")}</span>
      ) : null}
      {outcome.deliveredOutput !== undefined ? (
        <span className="block">
          {text("actualOutput")}:{" "}
          {deliveredAsset
            ? issuerAmount(outcome.deliveredOutput, deliveredAsset, intl)
            : `${outcome.deliveredOutput} ${text("baseUnits")}`}
        </span>
      ) : null}
      <a
        className="underline underline-offset-4"
        href={`https://gnosisscan.io/tx/${outcome.transactionHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {text("confirmed")}
      </a>
    </p>
  ) : outcome?.status === "reverted" ? (
    <p role="status" className="text-sm">
      {text("reverted")}
    </p>
  ) : null;
}
