import { AdminTextField } from "@/components/AdminTextField";
import { CampaignCookieJarAssetPicker } from "./CampaignCookieJarAssetPicker";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";

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
    <section>
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
          <span className="inline-flex min-h-11 items-center rounded-[var(--m3-shape-full)] border border-stroke-soft px-3 text-label-md text-text-sub">
            {tokenSymbol || "TOKEN"}
          </span>
        </div>
      </div>
    </section>
  );
}
