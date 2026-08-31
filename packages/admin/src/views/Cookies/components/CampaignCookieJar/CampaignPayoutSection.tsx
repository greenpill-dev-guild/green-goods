import { AdminTextField } from "@/components/AdminTextField";
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
        <div className="flex items-center gap-2">
          <AdminTextField
            id="campaign-cookie-jar-claim-amount"
            className="min-w-0 flex-1"
            label={formatMessage({
              id: "cockpit.community.cookies.claimAmountPerSteward",
              defaultMessage: "Claim amount per steward",
            })}
            value={claimAmount}
            onChange={(event) => setClaimAmount(event.target.value)}
            placeholder="0.00"
            inputProps={{ inputMode: "decimal" }}
          />
          <span className="inline-flex min-h-11 items-center rounded-[var(--m3-shape-full)] border border-[rgb(var(--m3-outline-variant))] px-3 text-label-md text-[rgb(var(--m3-on-surface-variant))]">
            {tokenSymbol || "TOKEN"}
          </span>
        </div>
      </div>
    </section>
  );
}
