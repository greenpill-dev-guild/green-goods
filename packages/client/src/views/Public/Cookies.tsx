import { lazy, Suspense } from "react";
import { useIntl } from "react-intl";
import { EditorialHeading, EditorialKicker, EditorialTitleAccent } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const CookiesWalletSurface = lazy(() => import("./CookiesWalletSurface"));

function CookiesLoadingPage() {
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
          { accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent> }
        )}
        lede={formatMessage({
          id: "public.cookies.description",
          defaultMessage:
            "Campaign jars hold funds for seasonal work, event rewards, and Garden cohort budgets. Connect a wallet to claim from jars on your allowlist, or add funds to keep the jar full.",
        })}
      />
      <section className="bg-bg-weak-50 px-6 py-24 sm:px-10 md:py-32">
        <div className="mx-auto max-w-3xl border-t border-stroke-soft-200 pt-8">
          <EditorialKicker>
            {formatMessage({
              id: "public.cookies.gridKicker",
              defaultMessage: "§ 01: Cookie jars",
            })}
          </EditorialKicker>
          <EditorialHeading className="mt-3">
            {formatMessage({ id: "public.cookies.gridTitle", defaultMessage: "Seasonal jars." })}
          </EditorialHeading>
          <p className="mt-5 text-base leading-[1.6] text-text-sub-600 md:text-lg">
            {formatMessage({
              id: "public.cookies.gridLedeDisconnected",
              defaultMessage:
                "Connect a wallet to see which jars you can claim from, or add funds to support a seasonal campaign.",
            })}
          </p>
        </div>
      </section>
      <PublicFooter variant="soil" />
    </>
  );
}

export default function CookiesPage() {
  return (
    <Suspense fallback={<CookiesLoadingPage />}>
      <CookiesWalletSurface />
    </Suspense>
  );
}
