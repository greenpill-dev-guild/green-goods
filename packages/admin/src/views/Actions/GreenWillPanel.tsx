import {
  DEFAULT_CHAIN_ID,
  FormInput,
  formatAddress,
  formatDate,
  Surface,
} from "@green-goods/shared";
import {
  useGreenWillBadgeDefinitions,
  useGreenWillBadges,
  useGreenWillRecentGrants,
} from "@green-goods/shared/hooks";
import { RiAwardLine } from "@remixicon/react";
import { useMemo, useState } from "react";
import { useIntl } from "react-intl";

function badgeTitle(intl: ReturnType<typeof useIntl>, slug: string) {
  switch (slug) {
    case "genesis":
      return intl.formatMessage({
        id: "app.profile.badges.genesis.title",
        defaultMessage: "Genesis",
      });
    case "first-work":
      return intl.formatMessage({
        id: "app.profile.badges.firstWork.title",
        defaultMessage: "First Work",
      });
    case "first-support":
      return intl.formatMessage({
        id: "app.profile.badges.firstSupport.title",
        defaultMessage: "First Support",
      });
    default:
      return slug;
  }
}

export function GreenWillPanel() {
  const intl = useIntl();
  const [lookupValue, setLookupValue] = useState("");
  const lookupAddress = lookupValue.trim();
  const lookupEnabled = lookupAddress.length > 0;

  const {
    badgeDefinitions,
    isLoading: isDefinitionsLoading,
    isError: isDefinitionsError,
  } = useGreenWillBadgeDefinitions({ chainId: DEFAULT_CHAIN_ID });
  const {
    grants,
    isLoading: isGrantsLoading,
    isError: isGrantsError,
  } = useGreenWillRecentGrants({
    chainId: DEFAULT_CHAIN_ID,
    limit: 5,
  });
  const { earnedBadges, isLoading: isLookupLoading } = useGreenWillBadges(
    lookupAddress || undefined,
    { enabled: lookupEnabled }
  );

  const badgeLookupSummary = useMemo(() => {
    if (!lookupEnabled) {
      return intl.formatMessage({
        id: "admin.greenWill.lookupPrompt",
        defaultMessage: "Enter an address to inspect badge ownership.",
      });
    }

    if (isLookupLoading) {
      return intl.formatMessage({
        id: "admin.greenWill.lookupLoading",
        defaultMessage: "Loading badge ownership...",
      });
    }

    return intl.formatMessage(
      {
        id: "admin.greenWill.lookupResult",
        defaultMessage: "{count} badge {count, plural, one {found} other {found}} for {address}",
      },
      { count: earnedBadges.length, address: lookupAddress }
    );
  }, [earnedBadges.length, intl, isLookupLoading, lookupAddress, lookupEnabled]);

  return (
    <Surface elevation="ground" padding="compact" className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <RiAwardLine className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-text-strong-950">
            {intl.formatMessage({
              id: "admin.greenWill.title",
              defaultMessage: "GreenWill",
            })}
          </h2>
          <p className="text-sm text-text-sub-600">
            {intl.formatMessage({
              id: "admin.greenWill.description",
              defaultMessage:
                "Read-only badge registry state for Arbitrum definitions, grants, and address ownership.",
            })}
          </p>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Surface elevation="solid-ground" padding="compact" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-text-strong-950">
              {intl.formatMessage({
                id: "admin.greenWill.registry",
                defaultMessage: "Registry",
              })}
            </h3>
            <span className="text-xs text-text-sub-600">
              {intl.formatMessage(
                {
                  id: "admin.greenWill.definitionCount",
                  defaultMessage: "{count} badge {count, plural, one {class} other {classes}}",
                },
                { count: badgeDefinitions.length }
              )}
            </span>
          </div>

          {isDefinitionsLoading ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "admin.greenWill.loadingDefinitions",
                defaultMessage: "Loading badge definitions...",
              })}
            </p>
          ) : isDefinitionsError ? (
            <p className="text-sm text-error-base">
              {intl.formatMessage({
                id: "admin.greenWill.definitionsError",
                defaultMessage: "Could not load GreenWill badge definitions.",
              })}
            </p>
          ) : (
            <div className="space-y-3">
              {badgeDefinitions.map((definition) => (
                <div
                  key={definition.badgeId}
                  className="flex items-center justify-between gap-3 rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-text-strong-950">
                      {badgeTitle(intl, definition.slug)}
                    </p>
                    <p className="text-xs text-text-sub-600">{definition.slug}</p>
                  </div>
                  <div className="text-right text-xs text-text-sub-600">
                    <p>
                      {intl.formatMessage(
                        {
                          id: "admin.greenWill.holders",
                          defaultMessage: "{count} {count, plural, one {holder} other {holders}}",
                        },
                        { count: definition.holderCount }
                      )}
                    </p>
                    <p>
                      {intl.formatMessage(
                        {
                          id: "admin.greenWill.grants",
                          defaultMessage: "{count} {count, plural, one {grant} other {grants}}",
                        },
                        { count: definition.grantCount }
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Surface>

        <Surface elevation="solid-ground" padding="compact" className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-text-strong-950">
            {intl.formatMessage({
              id: "admin.greenWill.recentGrants",
              defaultMessage: "Recent grants",
            })}
          </h3>

          {isGrantsLoading ? (
            <p className="text-sm text-text-sub-600">
              {intl.formatMessage({
                id: "admin.greenWill.loadingGrants",
                defaultMessage: "Loading recent grants...",
              })}
            </p>
          ) : isGrantsError ? (
            <p className="text-sm text-error-base">
              {intl.formatMessage({
                id: "admin.greenWill.grantsError",
                defaultMessage: "Could not load GreenWill grant history.",
              })}
            </p>
          ) : (
            <div className="space-y-3">
              {grants.map((grant) => (
                <div
                  key={grant.id}
                  className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2"
                >
                  <p className="text-sm font-medium text-text-strong-950">
                    {formatAddress(grant.owner, { variant: "card" })}
                  </p>
                  <p className="text-xs text-text-sub-600">
                    {badgeTitle(
                      intl,
                      badgeDefinitions.find((definition) => definition.badgeId === grant.badgeId)
                        ?.slug ?? "unknown"
                    )}
                    {" · "}
                    {formatDate(grant.timestamp)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Surface>
      </div>

      <Surface elevation="solid-ground" padding="compact" className="flex flex-col gap-3">
        <h3 className="text-sm font-medium text-text-strong-950">
          {intl.formatMessage({
            id: "admin.greenWill.lookup",
            defaultMessage: "Address lookup",
          })}
        </h3>

        <FormInput
          id="greenwill-lookup-address"
          label={intl.formatMessage({
            id: "admin.greenWill.lookupLabel",
            defaultMessage: "Lookup address",
          })}
          value={lookupValue}
          onChange={(event) => setLookupValue(event.target.value)}
          placeholder={intl.formatMessage({
            id: "admin.greenWill.lookupPlaceholder",
            defaultMessage: "0x...",
          })}
        />

        <p className="text-sm text-text-sub-600">{badgeLookupSummary}</p>

        {lookupEnabled && earnedBadges.length > 0 ? (
          <div className="space-y-3">
            {earnedBadges.map((badge) => (
              <div
                key={badge.badgeId}
                className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2"
              >
                <p className="text-sm font-medium text-text-strong-950">
                  {badgeTitle(intl, badge.slug)}
                </p>
                <p className="text-xs text-text-sub-600">
                  {intl.formatMessage(
                    {
                      id: "admin.greenWill.lookupIssuedAt",
                      defaultMessage: "Issued {date}",
                    },
                    {
                      date: badge.ownership ? formatDate(badge.ownership.issuedAt) : "—",
                    }
                  )}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Surface>
    </Surface>
  );
}
