import {
  type CampaignCookieJarPayoutAsset,
  type CampaignCookieJarPayoutAssetId,
} from "@green-goods/shared";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "@/components/AdminChoiceGroup";
import { EnsAddressText } from "@/components/EnsAddressText";

export function CampaignCookieJarAssetPicker({
  assets,
  selectedAssetId,
  onSelect,
}: {
  assets: readonly CampaignCookieJarPayoutAsset[];
  selectedAssetId: CampaignCookieJarPayoutAssetId | "custom";
  onSelect: (assetId: CampaignCookieJarPayoutAssetId) => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <AdminChoiceGroup
      ariaLabel={formatMessage({
        id: "cockpit.community.cookies.assetPicker",
        defaultMessage: "Payout asset",
      })}
      value={selectedAssetId}
      onChange={(assetId) => onSelect(assetId as CampaignCookieJarPayoutAssetId)}
      columns={4}
      optionClassName="min-h-24 items-start px-4 py-3"
      descriptionClassName="line-clamp-none"
      options={assets.map((asset) => ({
        value: asset.id,
        label: asset.label,
        disabled: !asset.supported,
        description: (
          <>
            <span className="block">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.assetDecimals",
                  defaultMessage: "{symbol} - {decimals} decimals",
                },
                { symbol: asset.symbol, decimals: asset.decimals }
              )}
            </span>
            <span className="mt-2 block break-all text-label-sm">
              {asset.supported ? (
                <EnsAddressText address={asset.address} />
              ) : (
                formatMessage(
                  {
                    id: "cockpit.community.cookies.assetUnavailable",
                    defaultMessage: "{asset} is not available on this network yet.",
                  },
                  { asset: asset.label }
                )
              )}
            </span>
          </>
        ),
      }))}
    />
  );
}
