import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { CampaignCookieJarAssetPicker } from "./CampaignCookieJarAssetPicker";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";

export function CampaignPayoutSection(props: CampaignCookieJarCreateFormProps) {
  const {
    formatMessage,
    payoutAssets,
    selectedAssetId,
    setSelectedAssetId,
    claimAmount,
    setClaimAmount,
    tokenSymbol,
  } = props;
  return (
    <section className="surface-section overflow-visible">
      <div className="mb-4">
        <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">02</p>
        <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
          {formatMessage({
            id: "cockpit.community.cookies.createPayoutSection",
            defaultMessage: "Payout",
          })}
        </h2>
      </div>
      <div className="space-y-4">
        <CampaignCookieJarAssetPicker
          assets={payoutAssets}
          selectedAssetId={selectedAssetId}
          onSelect={setSelectedAssetId}
        />
        <FormField
          label={formatMessage({
            id: "cockpit.community.cookies.claimAmountPerOperator",
            defaultMessage: "Claim amount per operator",
          })}
          htmlFor="campaign-cookie-jar-claim-amount"
        >
          <div className="flex items-center gap-2">
            <TextInput
              id="campaign-cookie-jar-claim-amount"
              surface="admin"
              inputMode="decimal"
              value={claimAmount}
              onChange={(event) => setClaimAmount(event.target.value)}
              placeholder="0.00"
            />
            <span className="inline-flex min-h-11 items-center rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] px-3 text-label-md text-[rgb(var(--m3-on-surface-variant))]">
              {tokenSymbol || "TOKEN"}
            </span>
          </div>
        </FormField>
      </div>
    </section>
  );
}
