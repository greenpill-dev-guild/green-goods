import type { ServiceVoucherSetup } from "@green-goods/shared/commitment-pooling";
import { useIntl } from "react-intl";
import { formatServiceAccessAmount } from "./serviceAccessPresentation";

/** Frozen authorization facts, including prior claims whose current offer may have changed. */
export function VoucherSetupFacts({ setup }: { setup: ServiceVoucherSetup }) {
  const { formatMessage, locale } = useIntl();
  const text = (key: string) => formatMessage({ id: `app.serviceAccess.${key}` });
  const a = setup.authorization;
  const facts = [
    ["setupId", setup.setupId],
    ["authorizationHash", setup.authorizationHash],
    ["sourceChain", a.sourceChainId],
    ["sourceModule", a.sourceModule],
    ["coreModule", a.coreModule],
    ["commitment", a.commitmentId],
    ["revision", a.termsRevision],
    ["termsHash", a.termsHash],
    ["claimHash", a.claimHash],
    ["requestNonce", a.requestNonce],
    ["buyer", a.buyer],
    ["authorizedHolder", a.holder],
    ["buyerGarden", a.buyerGarden],
    ["providerGarden", a.providerGarden],
    ["destinationChain", a.destinationChainId],
    ["escrow", a.destinationEscrow],
    ["issuer", a.issuer],
    ["token", a.token],
    ["serviceUnitHash", a.unitLabelHash],
    ["terms", a.serviceTermsRef],
    ["remedy", a.remedyTermsRef],
    ["acceptanceDeadline", a.acceptanceDeadline],
  ] as const;
  return (
    <div className="space-y-2">
      <p className="text-sm">
        {text("authorizedVouchers")}:{" "}
        {formatServiceAccessAmount(a.voucherUnits, setup.asset, locale, text("baseUnits"))}
      </p>
      <p className="text-sm">
        {text("service")}: {a.serviceUnits.toString()} {text("serviceUnits")}
      </p>
      <details className="text-xs text-text-sub-600">
        <summary>{text("authorizationDetails")}</summary>
        <dl className="mt-2 space-y-2 break-all">
          {facts.map(([label, value]) => (
            <div key={label}>
              <dt className="font-medium">{text(label)}</dt>
              <dd>{value.toString()}</dd>
            </div>
          ))}
        </dl>
      </details>
    </div>
  );
}
