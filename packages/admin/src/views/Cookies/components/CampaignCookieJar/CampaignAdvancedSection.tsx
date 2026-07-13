import { FormField, Textarea, TextInput } from "@green-goods/shared";
import { AdminButton } from "@/components/AdminButton";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";

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
        <summary className="cursor-pointer text-title-sm font-semibold text-[rgb(var(--m3-on-surface))]">
          {formatMessage({
            id: "cockpit.community.cookies.advanced",
            defaultMessage: "Advanced",
          })}
        </summary>
        {advancedOpen ? (
          <div className="mt-4 grid gap-4">
            <div className="flex flex-wrap gap-2">
              <AdminButton
                type="button"
                variant={selectedAssetId === "custom" ? "tonal" : "outlined"}
                size="sm"
                onClick={() => setSelectedAssetId("custom")}
              >
                {formatMessage({
                  id: "cockpit.community.cookies.useCustomToken",
                  defaultMessage: "Use custom token",
                })}
              </AdminButton>
              {selectedAssetId === "custom" && defaultPayoutAsset ? (
                <AdminButton
                  type="button"
                  variant="text"
                  size="sm"
                  onClick={() => setSelectedAssetId(defaultPayoutAsset.id)}
                >
                  {formatMessage({
                    id: "cockpit.community.cookies.useDefaultAssets",
                    defaultMessage: "Use default assets",
                  })}
                </AdminButton>
              ) : null}
            </div>
            {selectedAssetId === "custom" ? (
              <FormField
                label={formatMessage({
                  id: "cockpit.community.cookies.tokenAddress",
                  defaultMessage: "ERC20 token address",
                })}
                htmlFor="campaign-cookie-jar-custom-token"
                hint={
                  tokenSymbol
                    ? formatMessage(
                        {
                          id: "cockpit.community.cookies.tokenInfo",
                          defaultMessage: "{symbol}, {decimals} decimals",
                        },
                        { symbol: tokenSymbol, decimals: tokenDecimals }
                      )
                    : customTokenLoading
                      ? formatMessage({
                          id: "cockpit.community.cookies.tokenInfoLoading",
                          defaultMessage: "Reading token decimals...",
                        })
                      : undefined
                }
                error={
                  customTokenAddress && !normalizedCustomTokenAddress
                    ? formatMessage({
                        id: "cockpit.community.cookies.invalidAddress",
                        defaultMessage: "Enter a valid Ethereum address.",
                      })
                    : customTokenError
                      ? formatMessage({
                          id: "cockpit.community.cookies.tokenDecimalsRequired",
                          defaultMessage:
                            "Token decimals could not be read. Check the ERC20 address and try again.",
                        })
                      : undefined
                }
              >
                <TextInput
                  id="campaign-cookie-jar-custom-token"
                  surface="admin"
                  value={customTokenAddress}
                  onChange={(event) => setCustomTokenAddress(event.target.value)}
                />
              </FormField>
            ) : null}
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.owner",
                defaultMessage: "Jar owner",
              })}
              htmlFor="campaign-cookie-jar-owner"
              error={
                jarOwner && !normalizedJarOwner
                  ? formatMessage({
                      id: "cockpit.community.cookies.invalidAddress",
                      defaultMessage: "Enter a valid Ethereum address.",
                    })
                  : undefined
              }
            >
              <TextInput
                id="campaign-cookie-jar-owner"
                surface="admin"
                value={jarOwner}
                onChange={(event) => setJarOwner(event.target.value)}
              />
            </FormField>
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.cooldownDays",
                defaultMessage: "Cooldown days",
              })}
              htmlFor="campaign-cookie-jar-cooldown"
            >
              <TextInput
                id="campaign-cookie-jar-cooldown"
                surface="admin"
                inputMode="numeric"
                value={withdrawalIntervalDays}
                onChange={(event) => setWithdrawalIntervalDays(event.target.value)}
              />
            </FormField>
            <FormField
              label={formatMessage({
                id: "cockpit.community.cookies.extraAddresses",
                defaultMessage: "Extra allowlist addresses",
              })}
              htmlFor="campaign-cookie-jar-extra-addresses"
              error={
                aggregation.invalidAddresses.length > 0
                  ? formatMessage(
                      {
                        id: "cockpit.community.cookies.invalidExtras",
                        defaultMessage: "Invalid addresses: {addresses}",
                      },
                      { addresses: aggregation.invalidAddresses.join(", ") }
                    )
                  : undefined
              }
            >
              <Textarea
                id="campaign-cookie-jar-extra-addresses"
                surface="admin"
                value={extraAddresses}
                onChange={(event) => setExtraAddresses(event.target.value)}
                placeholder={formatMessage({
                  id: "cockpit.community.cookies.extraPlaceholder",
                  defaultMessage: "Paste addresses separated by commas, spaces, or new lines",
                })}
              />
            </FormField>
          </div>
        ) : null}
      </details>
    </section>
  );
}
