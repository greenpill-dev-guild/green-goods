import { lazy, Suspense, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { EditorialHeading, EditorialKicker, EditorialTitleAccent } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const VaultsWalletSurface = lazy(() => import("./VaultsWalletSurface"));

export default function VaultsPage() {
  const { formatMessage } = useIntl();
  const [searchParams] = useSearchParams();
  const [showWalletSurface, setShowWalletSurface] = useState(
    () => searchParams.has("endow") || searchParams.has("manage")
  );

  if (showWalletSurface) {
    return (
      <Suspense fallback={null}>
        <VaultsWalletSurface />
      </Suspense>
    );
  }

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("vaults")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-vaults-hero-title"
        title={formatMessage(
          {
            id: "public.vaults.hero.title",
            defaultMessage: "Public goods campaigns, powered by <accent>Octant vaults</accent>.",
          },
          { accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent> }
        )}
        lede={formatMessage({
          id: "public.vaults.hero.lede",
          defaultMessage:
            "Back a campaign once, and its support can keep growing as generated yield is routed toward the public good.",
        })}
      />
      <section className="bg-bg-weak-50 px-6 py-24 sm:px-10 md:py-32">
        <div className="mx-auto max-w-3xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker>
            {formatMessage({
              id: "public.vaults.hero.kicker",
              defaultMessage: "Octant V2 Ethereum vaults",
            })}
          </EditorialKicker>
          <EditorialHeading className="mt-3">
            {formatMessage({
              id: "public.vaults.strategy.title",
              defaultMessage: "How yield support works",
            })}
          </EditorialHeading>
          <p className="mt-5 text-base leading-[1.6] text-text-sub-600 md:text-lg">
            {formatMessage({
              id: "public.vaults.strategy.body",
              defaultMessage:
                "Each endowment helps back a campaign today, while the yield it generates can keep supporting the work over time. You are not earning personal yield; the campaign is the beneficiary.",
            })}
          </p>
          <button
            type="button"
            onClick={() => setShowWalletSurface(true)}
            className="mt-8 inline-flex min-h-12 items-center justify-center border border-primary-action bg-primary-action px-6 py-3 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
          >
            {formatMessage({
              id: "public.vaults.openWalletSurface",
              defaultMessage: "View Campaign Vaults",
            })}
          </button>
        </div>
      </section>
      <PublicFooter variant="soil" />
    </>
  );
}
