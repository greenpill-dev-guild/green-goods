import { Button } from "@green-goods/shared/components/Button";
import { getOctantVaultCampaigns } from "@green-goods/shared/modules/vault-crowdfunding/copy";
import type { OctantVaultCampaignManifest } from "@green-goods/shared/modules/vault-crowdfunding/manifest";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormattedMessage, useIntl } from "react-intl";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import {
  EditorialHeading,
  EditorialKicker,
  EditorialLede,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { VaultCheckoutDialog } from "@/components/Public/Vault/VaultCheckoutDialog";
import { VaultManagePositionsPanel } from "@/components/Public/Vault/VaultManagePositionsPanel";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";
import { CampaignCard } from "./VaultsCampaignCard";

function YieldSupportExplainer() {
  const { formatMessage } = useIntl();

  return (
    <section
      className="bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
      aria-labelledby="public-vaults-strategy-title"
    >
      <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
        <EditorialKicker className="mb-3">
          {formatMessage({
            id: "public.vaults.strategy.kicker",
            defaultMessage: "Support that keeps working",
          })}
        </EditorialKicker>
        <EditorialHeading id="public-vaults-strategy-title" size="sub">
          {formatMessage({
            id: "public.vaults.strategy.title",
            defaultMessage: "How yield support works",
          })}
        </EditorialHeading>
        <div className="mt-4 max-w-3xl space-y-4 text-sm leading-[1.65] text-text-sub-600 md:text-base">
          <p>
            {formatMessage({
              id: "public.vaults.strategy.body",
              defaultMessage:
                "Each endowment helps back a campaign today, while the yield it generates can keep supporting the work over time. You are not earning personal yield; the campaign is the beneficiary.",
            })}
          </p>
          <p>
            <FormattedMessage
              id="public.vaults.strategy.evidence"
              defaultMessage="These campaigns use Octant's yield donating strategy model, designed so generated yield can flow toward public goods instead of personal return. Curious readers can explore the broader model in the <docsLink>Octant docs</docsLink>."
              values={{
                docsLink: (chunks) => (
                  <a
                    href="https://docs.v2.octant.build/"
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              }}
            />
          </p>
        </div>
      </div>
    </section>
  );
}

export function VaultsPageContent({
  campaigns: campaignItems,
}: {
  campaigns?: OctantVaultCampaignManifest[];
} = {}) {
  const { formatMessage } = useIntl();
  const campaigns = useMemo(() => campaignItems ?? getOctantVaultCampaigns(), [campaignItems]);
  const [searchParams, setSearchParams] = useSearchParams();
  const managing = searchParams.get("manage") === "positions";
  const [isManagePanelOpen, setManagePanelOpen] = useState(managing);
  const isManagePanelClosePendingRef = useRef(false);
  const [selectedCampaign, setSelectedCampaign] = useState<OctantVaultCampaignManifest | null>(
    null
  );
  const shouldRenderManagePanel =
    isManagePanelOpen || isManagePanelClosePendingRef.current || managing;

  useEffect(() => {
    if (managing) {
      isManagePanelClosePendingRef.current = false;
      setManagePanelOpen(true);
      return;
    }

    setManagePanelOpen(false);
  }, [managing]);

  const handleEndow = useCallback((campaign: OctantVaultCampaignManifest) => {
    setSelectedCampaign(campaign);
  }, []);
  const handleClose = useCallback(() => {
    setSelectedCampaign(null);
  }, []);
  const openManage = useCallback(() => {
    setSelectedCampaign(null);
    isManagePanelClosePendingRef.current = false;
    setManagePanelOpen(true);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("manage", "positions");
        return next;
      },
      { replace: false }
    );
  }, [setSearchParams]);
  const handleManagePanelOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        isManagePanelClosePendingRef.current = false;
        setManagePanelOpen(true);
        return;
      }

      setManagePanelOpen(false);
      if (searchParams.get("manage") === "positions") {
        isManagePanelClosePendingRef.current = true;
      }
    },
    [searchParams]
  );
  const handleManagePanelExitComplete = useCallback(() => {
    if (!isManagePanelClosePendingRef.current) return;

    isManagePanelClosePendingRef.current = false;
    if (searchParams.get("manage") === "positions") {
      const next = new URLSearchParams(searchParams);
      next.delete("manage");
      setSearchParams(next, { replace: true, preventScrollReset: true });
    }
  }, [searchParams, setSearchParams]);

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("vaults")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        kicker={formatMessage({
          id: "public.vaults.hero.kicker",
          defaultMessage: "Octant V2 Ethereum vaults",
        })}
        titleId="public-vaults-title"
        title={formatMessage(
          {
            id: "public.vaults.hero.title",
            defaultMessage: "Public goods campaigns, powered by <accent>Octant vaults</accent>.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.vaults.hero.lede",
          defaultMessage:
            "Back a campaign once, and its support can keep growing as generated yield is routed toward the public good.",
        })}
      />

      <section
        className="bg-bg-weak-50 px-6 pt-32 pb-16 sm:px-10 sm:pt-36 md:pt-40 md:pb-20"
        aria-labelledby="public-vaults-browse-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="flex flex-col gap-6 border-b border-stroke-soft-200 pb-6 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
            <div className="max-w-2xl">
              <EditorialKicker className="mb-3">
                {formatMessage({
                  id: "public.vaults.browse.kicker",
                  defaultMessage: "Active Campaigns",
                })}
              </EditorialKicker>
              <EditorialHeading id="public-vaults-browse-title">
                {formatMessage({
                  id: "public.vaults.browse.title",
                  defaultMessage: "Explore public goods campaigns ready for support.",
                })}
              </EditorialHeading>
              <EditorialLede className="mt-5">
                {formatMessage({
                  id: "public.vaults.browse.lede",
                  defaultMessage:
                    "Each campaign turns support today into ongoing public goods funding.",
                })}
              </EditorialLede>
            </div>
            <div className="flex justify-end sm:shrink-0">
              <Button
                type="button"
                emphasis="secondary"
                onClick={openManage}
                data-testid="vault-manage-positions-entry"
              >
                {formatMessage({
                  id: "public.vaults.manage.entry",
                  defaultMessage: "Manage Endowments",
                })}
              </Button>
            </div>
          </header>

          <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.slug} campaign={campaign} onEndow={handleEndow} />
            ))}
          </div>
        </div>
      </section>

      <YieldSupportExplainer />

      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-vaults-boundary-title"
      >
        <div className="mx-auto max-w-7xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker className="mb-3">
            {formatMessage({
              id: "public.vaults.boundary.kicker",
              defaultMessage: "Beyond these campaigns",
            })}
          </EditorialKicker>
          <EditorialHeading id="public-vaults-boundary-title" size="sub">
            {formatMessage({
              id: "public.vaults.boundary.title",
              defaultMessage: "Want to see more places, projects, and impact?",
            })}
          </EditorialHeading>
          <p className="mt-4 max-w-3xl text-sm leading-[1.65] text-text-sub-600 md:text-base">
            {formatMessage({
              id: "public.vaults.boundary.body",
              defaultMessage:
                "This page is for Octant-backed campaigns. For the wider Green Goods network, explore Gardens.",
            })}
          </p>
          <Link
            to="/gardens"
            className="mt-5 inline-flex text-sm font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
          >
            {formatMessage({
              id: "public.vaults.boundary.cta",
              defaultMessage: "Explore Gardens",
            })}
          </Link>
        </div>
      </section>

      <PublicFooter variant="soil" />

      {shouldRenderManagePanel ? (
        <VaultManagePositionsPanel
          open={isManagePanelOpen}
          onExitComplete={handleManagePanelExitComplete}
          onOpenChange={handleManagePanelOpenChange}
          onEndow={() => handleManagePanelOpenChange(false)}
        />
      ) : selectedCampaign ? (
        <VaultCheckoutDialog
          key={selectedCampaign.slug}
          campaign={selectedCampaign}
          onClose={handleClose}
          onManagePositions={openManage}
        />
      ) : null}
    </>
  );
}

function DeprecatedCardEndowQueryParamScrub() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);

  if (!searchParams.has("cardEndowQa")) return null;

  searchParams.delete("cardEndowQa");
  const nextSearch = searchParams.toString();

  return (
    <Navigate
      replace
      to={{
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
        hash: location.hash,
      }}
    />
  );
}

export default function VaultsWalletSurface() {
  return (
    <>
      <DeprecatedCardEndowQueryParamScrub />
      <VaultsPageContent />
    </>
  );
}
