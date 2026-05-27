import {
  Alert,
  type Address,
  type CampaignCookieJarCampaign,
  truncateAddress,
  useAppKit,
  useCampaignCookieJar,
  useCampaignCookieJarCampaigns,
  useInViewReveal,
  usePublicGardens,
  useUser,
} from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { getAddress, isAddress } from "viem";
import { EditorialHeading, EditorialKicker, EditorialTitleAccent } from "@/components/Public/atoms";
import {
  classifyCookieJarStatus,
  type CookieJarStatus,
  PublicCookieJarCard,
} from "@/components/Public/PublicCookieJarCard";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";

function normalizeCampaignSlug(value: string): string {
  return value.trim().toLowerCase();
}

function resolveCampaignJar(
  searchParams: URLSearchParams,
  campaigns: readonly CampaignCookieJarCampaign[]
): {
  jarAddress?: Address;
  campaignSlug?: string;
  invalidJar?: string;
  campaign?: CampaignCookieJarCampaign;
} {
  const jar = searchParams.get("jar")?.trim();
  if (jar) {
    if (!isAddress(jar)) return { invalidJar: jar };
    const jarAddress = getAddress(jar) as Address;
    return {
      jarAddress,
      campaign: campaigns.find(
        (campaign) => campaign.address.toLowerCase() === jarAddress.toLowerCase()
      ),
    };
  }

  const campaignSlug = normalizeCampaignSlug(searchParams.get("campaign") ?? "");
  if (!campaignSlug) return {};
  const campaign = campaigns.find((item) => item.slug === campaignSlug);
  return { jarAddress: campaign?.address, campaignSlug, campaign };
}

function buildDirectCampaign(jarAddress: Address): CampaignCookieJarCampaign {
  return {
    address: jarAddress,
    jarAddress,
    slug: `jar-${jarAddress.toLowerCase()}`,
    label: "Direct jar",
    title: "Direct jar",
    metadata: null,
    rawMetadata: "",
    source: "direct",
  };
}

interface JarStateRead {
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]> | null;
  isLoading: boolean;
  hasError: boolean;
}

function JarStateProbe({
  address,
  onState,
}: {
  address: Address;
  onState: (address: Address, state: JarStateRead) => void;
}) {
  const { jar, isLoading, error } = useCampaignCookieJar(address);
  useEffect(() => {
    onState(address, { jar: jar ?? null, isLoading, hasError: Boolean(error) });
  }, [address, jar, isLoading, error, onState]);
  return null;
}

function statusPriority(status: CookieJarStatus): number {
  switch (status.kind) {
    case "for-you-claimable":
      return 0;
    case "for-you-cooldown":
      return 1;
    case "for-you-claimed":
      return 2;
    case "active-open":
      return 3;
    case "needs-funding":
      return 4;
    case "claims-paused":
      return 5;
    case "active-not-eligible":
      return 6;
    case "loading":
      return 7;
    case "error":
      return 8;
  }
}

function CookiesSectionSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-4 border-t border-stroke-soft-200 pt-5">
          <div className="h-4 w-20 animate-pulse rounded-full bg-bg-weak-50" />
          <div className="aspect-[4/3] w-full animate-pulse bg-bg-weak-50" />
          <div className="h-6 w-3/4 animate-pulse bg-stroke-soft-200/60" />
          <div className="h-4 w-1/2 animate-pulse bg-stroke-soft-200/60" />
          <div className="mt-2 h-24 w-full animate-pulse bg-stroke-soft-200/60" />
        </div>
      ))}
    </div>
  );
}

function ConnectionStatusLine({
  primaryAddress,
  onAction,
}: {
  primaryAddress: Address;
  onAction: () => void;
}) {
  const { formatMessage } = useIntl();
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
      <span>
        {formatMessage(
          { id: "public.cookies.connectedAs", defaultMessage: "Connected as {address}" },
          { address: truncateAddress(primaryAddress) }
        )}
      </span>
      <span aria-hidden="true">·</span>
      <button
        type="button"
        onClick={onAction}
        className="cursor-pointer border-b border-current pb-px text-text-sub-600 transition-colors hover:text-text-strong-950"
      >
        {formatMessage({ id: "public.cookies.disconnect", defaultMessage: "Disconnect" })}
      </button>
    </p>
  );
}

function CookiesCampaignSurface() {
  const { formatMessage } = useIntl();
  const [searchParams] = useSearchParams();
  const { ref: ledgerRef, revealed: ledgerRevealed } = useInViewReveal<HTMLElement>();
  const { primaryAddress } = useUser();
  const { open: openWalletModal } = useAppKit();
  const isConnected = Boolean(primaryAddress);

  const {
    campaigns,
    isLoading: isCampaignListLoading,
    error: campaignListError,
  } = useCampaignCookieJarCampaigns();
  const { data: gardens = [] } = usePublicGardens();

  const gardensByAddress = useMemo(() => {
    const map = new Map<Address, (typeof gardens)[number]>();
    for (const garden of gardens) {
      map.set(garden.id.toLowerCase() as Address, garden);
    }
    return map;
  }, [gardens]);

  const { jarAddress, campaignSlug, invalidJar, campaign } = useMemo(
    () => resolveCampaignJar(searchParams, campaigns),
    [campaigns, searchParams]
  );

  const visibleCampaigns = useMemo(() => {
    if (!jarAddress || invalidJar) return campaigns;
    const hasKnownCampaign = campaigns.some(
      (entry) => entry.address.toLowerCase() === jarAddress.toLowerCase()
    );
    if (hasKnownCampaign) return campaigns;
    return [buildDirectCampaign(jarAddress), ...campaigns];
  }, [campaigns, invalidJar, jarAddress]);

  const [statesByAddress, setStatesByAddress] = useState<Map<Address, JarStateRead>>(new Map());
  const reportJarState = useCallback((address: Address, state: JarStateRead) => {
    setStatesByAddress((prev) => {
      const existing = prev.get(address);
      if (
        existing &&
        existing.jar === state.jar &&
        existing.isLoading === state.isLoading &&
        existing.hasError === state.hasError
      ) {
        return prev;
      }
      const next = new Map(prev);
      next.set(address, state);
      return next;
    });
  }, []);

  const { sortedCampaigns, claimableCount, unresolvedCount } = useMemo(() => {
    let claimable = 0;
    let unresolved = 0;
    const rows = visibleCampaigns.map((entry, index) => {
      const state = statesByAddress.get(entry.address);
      const status = classifyCookieJarStatus(state?.jar ?? null, {
        hasError: Boolean(state?.hasError),
        isConnected,
      });
      if (status.kind === "for-you-claimable") claimable += 1;
      if (status.bucket === "unresolved") unresolved += 1;
      return { entry, index, status };
    });

    rows.sort((a, b) => {
      const priorityDelta = statusPriority(a.status) - statusPriority(b.status);
      if (priorityDelta !== 0) return priorityDelta;
      return (b.entry.createdAt ?? 0) - (a.entry.createdAt ?? 0) || a.index - b.index;
    });

    return {
      sortedCampaigns: rows.map((row) => row.entry),
      claimableCount: claimable,
      unresolvedCount: unresolved,
    };
  }, [visibleCampaigns, statesByAddress, isConnected]);

  const summaryLine = useMemo(() => {
    if (isCampaignListLoading) return null;
    return formatMessage(
      {
        id: "public.cookies.summary",
        defaultMessage:
          "{count, plural, one {# jar listed} other {# jars listed}} · {claimable, plural, =0 {no claimable jars} one {# claimable} other {# claimable}}",
      },
      { count: visibleCampaigns.length, claimable: claimableCount }
    );
  }, [claimableCount, formatMessage, isCampaignListLoading, visibleCampaigns.length]);

  const gridLede = isConnected
    ? claimableCount > 0
      ? formatMessage({
          id: "public.cookies.gridLedeConnectedSome",
          defaultMessage:
            "Claimable jars are shown first. You can also add funds to any seasonal campaign jar below.",
        })
      : formatMessage({
          id: "public.cookies.gridLedeConnectedNone",
          defaultMessage:
            "No claimable jars for this wallet yet. You can still add funds to a seasonal campaign jar below.",
        })
    : formatMessage({
        id: "public.cookies.gridLedeDisconnected",
        defaultMessage:
          "Connect a wallet to see which jars you can claim from, or add funds to support a seasonal campaign.",
      });

  return (
    <main
      ref={ledgerRef}
      data-revealed={ledgerRevealed}
      className="editorial-section-reveal mx-auto max-w-7xl px-6 sm:px-10"
    >
      {visibleCampaigns.map((entry) => (
        <JarStateProbe key={entry.address} address={entry.address} onState={reportJarState} />
      ))}

      {invalidJar ? (
        <Alert variant="error" className="mb-8 max-w-2xl p-5">
          {formatMessage(
            {
              id: "public.cookies.invalidJar",
              defaultMessage: '"{jar}" is not a valid jar address.',
            },
            { jar: invalidJar }
          )}
        </Alert>
      ) : campaignSlug && !jarAddress && !isCampaignListLoading ? (
        <div className="mb-8 max-w-2xl rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 text-sm text-text-sub-600">
          {formatMessage(
            {
              id: "public.cookies.unknownCampaign",
              defaultMessage:
                'The "{campaign}" cookie jar is not configured yet. Use a direct jar link for now.',
            },
            { campaign: campaignSlug }
          )}
        </div>
      ) : null}

      <section aria-labelledby="public-cookies-grid-title" className="pb-16">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.cookies.gridKicker",
                defaultMessage: "§ 01 Cookie jars",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-cookies-grid-title">
              {formatMessage({
                id: "public.cookies.gridTitle",
                defaultMessage: "Seasonal jars.",
              })}
            </EditorialHeading>
            <p className="mt-4 max-w-2xl text-base leading-[1.6] text-text-sub-600 md:text-lg">
              {gridLede}
            </p>
            {primaryAddress ? (
              <div className="mt-5">
                <ConnectionStatusLine
                  primaryAddress={primaryAddress as Address}
                  onAction={() => openWalletModal()}
                />
              </div>
            ) : null}
          </div>

          {summaryLine ? (
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
              {summaryLine}
            </p>
          ) : null}
        </header>

        <div className="mt-10">
          {isCampaignListLoading ? (
            <CookiesSectionSkeleton />
          ) : sortedCampaigns.length === 0 ? (
            <div className="max-w-2xl border-t border-stroke-soft-200 pt-6">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {formatMessage({
                  id: "public.cookies.gridEmptyKicker",
                  defaultMessage: "Jar list",
                })}
              </p>
              <p className="mt-2 font-serif text-xl italic text-text-sub-600 md:text-2xl">
                {campaignListError
                  ? formatMessage({
                      id: "public.cookies.registryLoadFailed",
                      defaultMessage:
                        "The campaign jar list could not be loaded. Direct jar links still work.",
                    })
                  : formatMessage({
                      id: "public.cookies.gridEmpty",
                      defaultMessage: "No seasonal campaign jars have been published yet.",
                    })}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2 xl:grid-cols-3">
              {sortedCampaigns.map((entry) => (
                <PublicCookieJarCard
                  key={entry.address}
                  campaign={entry}
                  gardensByAddress={gardensByAddress}
                  isConnected={isConnected}
                  isHighlighted={jarAddress?.toLowerCase() === entry.address.toLowerCase()}
                />
              ))}
            </div>
          )}
          {unresolvedCount > 0 && !isCampaignListLoading ? (
            <p className="mt-6 font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
              {formatMessage(
                {
                  id: "public.cookies.unresolvedNote",
                  defaultMessage:
                    "Reading {count, plural, one {# jar} other {# jars}} on chain. Balances may update as data resolves.",
                },
                { count: unresolvedCount }
              )}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

export default function CookiesPage() {
  const { formatMessage } = useIntl();

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("cookies")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-cookies-hero-title"
        title={formatMessage(
          {
            id: "public.cookies.title",
            defaultMessage: "Shared <accent>cookie jars</accent> for seasonal campaign work.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.cookies.description",
          defaultMessage:
            "Campaign jars hold funds for seasonal work, event rewards, and Garden cohort budgets. Connect a wallet to claim from jars on your allowlist, or add funds to keep the jar full.",
        })}
      />

      <div className="bg-bg-weak-50 pt-32 pb-16 sm:pt-36 sm:pb-20 md:pt-40">
        <WalletRuntimeProviders>
          <CookiesCampaignSurface />
        </WalletRuntimeProviders>
      </div>

      <PublicFooter variant="soil" />
    </>
  );
}
