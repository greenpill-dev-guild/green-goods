import { Button } from "@green-goods/shared/components/Button";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminTextArea, AdminTextField } from "@/components/AdminTextField";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm.types";

export function CampaignAdvancedSection(props: CampaignCookieJarCreateFormProps) {
  const {
    formatMessage,
    advancedOpen,
    setAdvancedOpen,
    selectedAssetId,
    setSelectedAssetId,
    defaultPayoutAsset,
    customTokenAddress,
    setCustomTokenAddress,
    normalizedCustomTokenAddress,
    tokenSymbol,
    tokenDecimals,
    customTokenLoading,
    customTokenError,
    jarOwner,
    setJarOwner,
    normalizedJarOwner,
    withdrawalIntervalDays,
    setWithdrawalIntervalDays,
    extraAddresses,
    setExtraAddresses,
    aggregation,
  } = props;
  return (
    <section className="surface-section overflow-visible">
      <details open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
        <summary className="cursor-pointer type-title-sm font-semibold text-text-strong">
          {formatMessage({
            id: "hub.community.cookies.advanced",
            defaultMessage: "Advanced",
          })}
        </summary>
        {advancedOpen ? (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap gap-2">
              <AdminFilterChip
                label={formatMessage({
                  id: "hub.community.cookies.useCustomToken",
                  defaultMessage: "Use custom token",
                })}
                selected={selectedAssetId === "custom"}
                onToggle={() => setSelectedAssetId("custom")}
              />
              {selectedAssetId === "custom" && defaultPayoutAsset ? (
                <Button
                  type="button"
                  emphasis="tertiary"
                  size="compact"
                  onClick={() => setSelectedAssetId(defaultPayoutAsset.id)}
                >
                  {formatMessage({
                    id: "hub.community.cookies.useDefaultAssets",
                    defaultMessage: "Use default assets",
                  })}
                </Button>
              ) : null}
            </div>
            {selectedAssetId === "custom" ? (
              <AdminTextField
                id="campaign-cookie-jar-custom-token"
                label={formatMessage({
                  id: "hub.community.cookies.tokenAddress",
                  defaultMessage: "ERC20 token address",
                })}
                value={customTokenAddress}
                onChange={(event) => setCustomTokenAddress(event.target.value)}
                helperText={
                  tokenSymbol
                    ? formatMessage(
                        {
                          id: "hub.community.cookies.tokenInfo",
                          defaultMessage: "{symbol}, {decimals} decimals",
                        },
                        { symbol: tokenSymbol, decimals: tokenDecimals }
                      )
                    : customTokenLoading
                      ? formatMessage({
                          id: "hub.community.cookies.tokenInfoLoading",
                          defaultMessage: "Reading token decimals...",
                        })
                      : undefined
                }
                error={
                  customTokenAddress && !normalizedCustomTokenAddress
                    ? formatMessage({
                        id: "hub.community.cookies.invalidAddress",
                        defaultMessage: "Enter a valid Ethereum address.",
                      })
                    : customTokenError
                      ? formatMessage({
                          id: "hub.community.cookies.tokenDecimalsRequired",
                          defaultMessage:
                            "Token decimals could not be read. Check the ERC20 address and try again.",
                        })
                      : undefined
                }
              />
            ) : null}
            <AdminTextField
              id="campaign-cookie-jar-owner"
              label={formatMessage({
                id: "hub.community.cookies.owner",
                defaultMessage: "Jar owner",
              })}
              value={jarOwner}
              onChange={(event) => setJarOwner(event.target.value)}
              error={
                jarOwner && !normalizedJarOwner
                  ? formatMessage({
                      id: "hub.community.cookies.invalidAddress",
                      defaultMessage: "Enter a valid Ethereum address.",
                    })
                  : undefined
              }
            />
            <AdminTextField
              id="campaign-cookie-jar-cooldown"
              label={formatMessage({
                id: "hub.community.cookies.cooldownDays",
                defaultMessage: "Cooldown days",
              })}
              value={withdrawalIntervalDays}
              onChange={(event) => setWithdrawalIntervalDays(event.target.value)}
              inputProps={{ inputMode: "numeric" }}
            />
            <AdminTextArea
              id="campaign-cookie-jar-extra-addresses"
              label={formatMessage({
                id: "hub.community.cookies.extraAddresses",
                defaultMessage: "Extra allowlist addresses",
              })}
              value={extraAddresses}
              onChange={(event) => setExtraAddresses(event.target.value)}
              placeholder={formatMessage({
                id: "hub.community.cookies.extraPlaceholder",
                defaultMessage: "Paste addresses separated by commas, spaces, or new lines",
              })}
              error={
                aggregation.invalidAddresses.length > 0
                  ? formatMessage(
                      {
                        id: "hub.community.cookies.invalidExtras",
                        defaultMessage: "Invalid addresses: {addresses}",
                      },
                      { addresses: aggregation.invalidAddresses.join(", ") }
                    )
                  : undefined
              }
            />
          </div>
        ) : null}
      </details>
    </section>
  );
}
