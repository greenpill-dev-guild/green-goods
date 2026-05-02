import {
  type Address,
  type PublicGardenSummary,
  publicGardenHelpers,
  usePublicGardens,
} from "@green-goods/shared";
import type {
  PublicFundingAvailability,
  PublicFundingIntentKind,
} from "@green-goods/shared/public-contracts";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import {
  EditorialDivider,
  EditorialHeading,
  EditorialKicker,
  EditorialNumeral,
  EditorialPrimaryButton,
  EditorialTitleAccent,
} from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { PublicFundingReceipt } from "@/components/Public/PublicFundingReceipt";
import { PublicGardenCard } from "@/components/Public/PublicGardenCard";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const WalletRuntimeProviders = lazy(() => import("@/routes/WalletRuntimeProviders"));
const PublicFundingMethodSelector = lazy(() =>
  import("@/components/Public/PublicFundingMethodSelector").then((module) => ({
    default: module.PublicFundingMethodSelector,
  }))
);
const CookieJarDepositDialog = lazy(() =>
  import("@/components/Dialogs/CookieJarDepositDialog").then((module) => ({
    default: module.CookieJarDepositDialog,
  }))
);
const VaultDepositDialog = lazy(() =>
  import("@/components/Dialogs/VaultDepositDialog").then((module) => ({
    default: module.VaultDepositDialog,
  }))
);

type ResolutionStatus = "absent" | "match" | "stale" | "ambiguous";

interface ResolvedGarden {
  status: ResolutionStatus;
  garden?: PublicGardenSummary;
  rawQuery?: string;
}

function resolveGardenQuery(
  rawQuery: string | null,
  gardens: readonly PublicGardenSummary[]
): ResolvedGarden {
  if (!rawQuery) return { status: "absent" };
  const trimmed = rawQuery.trim();
  if (trimmed.length === 0) return { status: "absent" };

  const lower = trimmed.toLowerCase();
  const exact = gardens.find(
    (garden) => garden.id.toLowerCase() === lower || garden.address.toLowerCase() === lower
  );
  if (exact) return { status: "match", garden: exact, rawQuery: trimmed };

  const slugMatches = gardens.filter(
    (garden) => publicGardenHelpers.deriveSlug(garden.name, garden.id) === lower
  );
  if (slugMatches.length === 1) {
    return { status: "match", garden: slugMatches[0], rawQuery: trimmed };
  }
  if (slugMatches.length > 1) {
    return { status: "ambiguous", rawQuery: trimmed };
  }
  return { status: "stale", rawQuery: trimmed };
}

interface ActiveWalletDialog {
  intent: PublicFundingIntentKind;
  garden: PublicGardenSummary;
}

interface SupportPathProps {
  numeral: string;
  titleId: string;
  defaultTitle: string;
  ledeId: string;
  defaultLede: string;
  routesId: string;
  defaultRoutes: string;
  bestForId: string;
  defaultBestFor: string;
}

function SupportPath({
  numeral,
  titleId,
  defaultTitle,
  ledeId,
  defaultLede,
  routesId,
  defaultRoutes,
  bestForId,
  defaultBestFor,
}: SupportPathProps) {
  const { formatMessage } = useIntl();
  return (
    <article className="flex flex-col gap-5">
      <EditorialNumeral>{numeral}</EditorialNumeral>
      <h3 className="font-serif text-2xl font-normal leading-[1.05] tracking-[-0.012em] text-text-strong-950 md:text-3xl">
        {formatMessage({ id: titleId, defaultMessage: defaultTitle })}
      </h3>
      <p className="text-base leading-[1.6] text-text-sub-600 md:text-lg">
        {formatMessage({ id: ledeId, defaultMessage: defaultLede })}
      </p>
      <dl className="space-y-3 text-sm leading-[1.55] text-text-sub-600">
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.routes", defaultMessage: "Routes through" })}
          </dt>
          <dd className="mt-1">{formatMessage({ id: routesId, defaultMessage: defaultRoutes })}</dd>
        </div>
        <div>
          <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.fund.support.bestFor", defaultMessage: "Best for" })}
          </dt>
          <dd className="mt-1">
            {formatMessage({ id: bestForId, defaultMessage: defaultBestFor })}
          </dd>
        </div>
      </dl>
    </article>
  );
}

/**
 * Fund — public garden funding gateway.
 *
 * Editorial recomposition:
 *   Hero (with calm disclaimer) → § 01 Donate vs Endow explanatory diptych
 *   → § 02 Garden list with single "Support" CTA per row → optional
 *   receipt / stale-link banner → Footer.
 *
 * Behavior preserved from the prior view:
 * - `?intent=<id>` triggers receipt mode (reads X-GG-Receipt-Token from session).
 * - `?garden=<id-or-slug>` resolves via `publicGardenHelpers.deriveSlug`. Stale,
 *   missing, zero-match, or ambiguous queries fall back to the regular Fund
 *   layout with a localized non-blocking message.
 * - Support CTA opens `PublicFundingMethodSelector`. Wallet path uses the
 *   existing CookieJarDepositDialog / VaultDepositDialog (Reown/wagmi). Card
 *   path is hidden unless `publicProviderProofRegistry` marks the tuple `live`.
 * - No public withdrawal or admin controls (support-only).
 *
 * Voice (per chat 8 user feedback): Donate / Endow as terminology (not
 * Direct/Endowment), single "Support" button per garden, hero copy "A small
 * gesture today, growing over many seasons."
 */
export default function FundPage() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();
  const [searchParams] = useSearchParams();

  const intentId = searchParams.get("intent");
  const gardenQuery = searchParams.get("garden");

  const resolved = useMemo(() => resolveGardenQuery(gardenQuery, gardens), [gardenQuery, gardens]);

  const orderedGardens = useMemo(() => {
    if (resolved.status !== "match" || !resolved.garden) return gardens;
    const match = resolved.garden;
    return [match, ...gardens.filter((g) => g.id !== match.id)];
  }, [gardens, resolved]);

  const [selectorGarden, setSelectorGarden] = useState<PublicGardenSummary | null>(null);
  const [walletDialog, setWalletDialog] = useState<ActiveWalletDialog | null>(null);
  const hasWalletRuntime = Boolean(selectorGarden || walletDialog);

  const matchHighlightRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (resolved.status === "match" && matchHighlightRef.current) {
      matchHighlightRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [resolved.status]);

  const closeSelector = useCallback(() => setSelectorGarden(null), []);
  const closeWalletDialog = useCallback(() => setWalletDialog(null), []);

  const handleWalletSelected = useCallback(
    (intent: PublicFundingIntentKind) => {
      if (!selectorGarden) return;
      setWalletDialog({ intent, garden: selectorGarden });
    },
    [selectorGarden]
  );

  const handleCardSelected = useCallback(
    (_intent: PublicFundingIntentKind, _availability: PublicFundingAvailability) => {
      // Card flow lights up only when the provider proof registry has a `live`
      // entry for the exact tuple. Until that lands, this branch is unreachable.
    },
    []
  );

  return (
    <>
      <PublicEditorialHero
        variant="banner"
        imageSrc={getPublicHeroImage("fund")}
        imageFallbackSrc={publicCuration.fallbackImagePaths[0]}
        imageAlt=""
        titleId="public-fund-hero-title"
        title={formatMessage(
          {
            id: "public.fund.heroTitle",
            defaultMessage: "A small gesture, <accent>growing</accent> over many seasons.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.fund.heroLede",
          defaultMessage:
            "Donate to support a Garden's immediate work, or Endow a Vault designed so yield helps the Garden over time.",
        })}
        disclaimer={formatMessage({
          id: "public.fund.taxDisclaimer",
          defaultMessage:
            "Funding supports the Garden directly. It is not tax-deductible, charitable, or nonprofit-backed unless separately configured.",
        })}
      />

      {intentId ? (
        <section className="bg-bg-weak-50 px-6 pt-20 pb-8 sm:px-10 md:pt-24">
          <div className="mx-auto max-w-3xl">
            <PublicFundingReceipt intentId={intentId} />
          </div>
        </section>
      ) : null}

      {!intentId && (resolved.status === "stale" || resolved.status === "ambiguous") ? (
        <section className="bg-bg-weak-50 px-6 pt-20 pb-4 sm:px-10 md:pt-24">
          <div className="mx-auto max-w-3xl">
            <p
              role="status"
              className="border-l-2 border-text-soft-400 bg-bg-white-0 px-4 py-3 text-sm text-text-sub-600"
            >
              {formatMessage(
                {
                  id:
                    resolved.status === "ambiguous"
                      ? "public.fund.gardenQuery.ambiguous"
                      : "public.fund.gardenQuery.stale",
                  defaultMessage:
                    resolved.status === "ambiguous"
                      ? 'We couldn\'t tell which Garden you meant by "{query}". Pick one below.'
                      : 'We couldn\'t find a Garden matching "{query}". Browse the list below.',
                },
                { query: resolved.rawQuery ?? "" }
              )}
            </p>
          </div>
        </section>
      ) : null}

      {/* § 01 — Donate vs Endow editorial diptych */}
      <section
        className={
          intentId || resolved.status === "stale" || resolved.status === "ambiguous"
            ? "bg-bg-weak-50 px-6 pb-16 sm:px-10 md:pb-20"
            : "bg-bg-weak-50 px-6 pt-20 pb-16 sm:px-10 md:pt-24 md:pb-20"
        }
        aria-labelledby="public-fund-paths-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.fund.paths.kicker",
                defaultMessage: "§ 01 — Two paths of support",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-fund-paths-title">
              {formatMessage({
                id: "public.fund.paths.title",
                defaultMessage: "Donate now, or Endow for many seasons.",
              })}
            </EditorialHeading>
          </header>

          <div className="mt-12 grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-16">
            <SupportPath
              numeral="i."
              titleId="public.fund.paths.donateTitle"
              defaultTitle="Donate"
              ledeId="public.fund.paths.donateLede"
              defaultLede="Direct support that reaches a Garden's Cookie Jar today."
              routesId="public.fund.paths.donateRoutes"
              defaultRoutes="The Garden's Cookie Jar."
              bestForId="public.fund.paths.donateBestFor"
              defaultBestFor="Immediate needs and near-term work."
            />
            <SupportPath
              numeral="ii."
              titleId="public.fund.paths.endowTitle"
              defaultTitle="Endow"
              ledeId="public.fund.paths.endowLede"
              defaultLede="A Vault designed so the deposit can remain while yield supports the Garden over time."
              routesId="public.fund.paths.endowRoutes"
              defaultRoutes="A Vault held by the Garden."
              bestForId="public.fund.paths.endowBestFor"
              defaultBestFor="Longer-term support that compounds."
            />
          </div>

          <div className="mt-10">
            <EditorialDivider />
          </div>
          <p className="mt-4 max-w-2xl text-xs leading-relaxed text-text-soft-400">
            <span className="mr-1 font-mono uppercase tracking-[0.16em]">on endowments —</span>
            {formatMessage({
              id: "public.fund.endow.note",
              defaultMessage:
                "Vault support depends on token, provider, and wallet mechanics. Values and access can vary; review the details before continuing.",
            })}
          </p>
        </div>
      </section>

      {/* § 02 — Choose a Garden to support */}
      <section
        className="bg-bg-weak-50 px-6 pb-24 sm:px-10 md:pb-32"
        aria-labelledby="public-fund-gardens-title"
      >
        <div className="mx-auto max-w-7xl">
          <header className="border-b border-stroke-soft-200 pb-6">
            <EditorialKicker className="mb-3">
              {formatMessage({
                id: "public.fund.gardens.kicker",
                defaultMessage: "§ 02 — Choose where to apply your support",
              })}
            </EditorialKicker>
            <EditorialHeading id="public-fund-gardens-title">
              {formatMessage({
                id: "public.fund.gardens.title",
                defaultMessage: "Gardens accepting support this season.",
              })}
            </EditorialHeading>
          </header>

          {isLoading ? (
            <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="aspect-[3/2] w-full animate-pulse bg-editorial-warm"
                  aria-hidden="true"
                />
              ))}
            </div>
          ) : orderedGardens.length === 0 ? (
            <p className="mt-12 max-w-md font-serif text-xl italic text-text-soft-400">
              {formatMessage({
                id: "public.fund.empty",
                defaultMessage: "Funding destinations will appear here as Gardens enable them.",
              })}
            </p>
          ) : (
            <div className="mt-12 grid grid-cols-1 gap-12 sm:grid-cols-2 lg:grid-cols-3">
              {orderedGardens.map((garden) => {
                const isMatchedHighlight =
                  resolved.status === "match" && resolved.garden?.id === garden.id;
                return (
                  <div
                    key={garden.id}
                    ref={isMatchedHighlight ? matchHighlightRef : undefined}
                    className={
                      isMatchedHighlight
                        ? "relative ring-2 ring-primary-action ring-offset-4 ring-offset-bg-weak-50"
                        : undefined
                    }
                  >
                    <div className="flex flex-col gap-5">
                      <PublicGardenCard garden={garden} />
                      <EditorialPrimaryButton
                        onClick={() => setSelectorGarden(garden)}
                        className="self-start"
                      >
                        {formatMessage({
                          id: "public.fund.supportShort",
                          defaultMessage: "Support",
                        })}
                      </EditorialPrimaryButton>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <PublicFooter variant="soil" />

      {hasWalletRuntime ? (
        <Suspense fallback={null}>
          <WalletRuntimeProviders>
            {selectorGarden ? (
              <PublicFundingMethodSelector
                open
                garden={selectorGarden}
                onClose={closeSelector}
                onWalletSelected={handleWalletSelected}
                onCardSelected={handleCardSelected}
              />
            ) : null}

            {walletDialog?.intent === "donate" ? (
              <CookieJarDepositDialog
                isOpen
                onClose={closeWalletDialog}
                gardenAddress={walletDialog.garden.id as Address}
                gardenName={walletDialog.garden.name}
              />
            ) : null}
            {walletDialog?.intent === "endow" ? (
              <VaultDepositDialog
                isOpen
                onClose={closeWalletDialog}
                gardenAddress={walletDialog.garden.id as Address}
                gardenName={walletDialog.garden.name}
              />
            ) : null}
          </WalletRuntimeProviders>
        </Suspense>
      ) : null}
    </>
  );
}
