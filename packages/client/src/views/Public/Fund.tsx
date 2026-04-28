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
import { PublicFundingReceipt } from "@/components/Public/PublicFundingReceipt";
import { PublicGardenCard } from "@/components/Public/PublicGardenCard";

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

/**
 * Fund — public garden funding gateway.
 *
 * Behavior:
 * - `?intent=<id>` triggers receipt mode (reads X-GG-Receipt-Token from session).
 * - `?garden=<id-or-slug>` resolves via `publicGardenHelpers.deriveSlug`. Stale,
 *   missing, zero-match, or ambiguous queries fall back to the regular Fund
 *   layout with a localized non-blocking message.
 * - Garden support CTAs open `PublicFundingMethodSelector`. Wallet path uses
 *   the existing CookieJarDepositDialog / VaultDepositDialog (Reown/wagmi).
 *   Card path is hidden unless `publicProviderProofRegistry` marks the exact
 *   tuple `live`.
 * - No public withdrawal or admin controls (support-only).
 */
export default function FundPage() {
  const { formatMessage } = useIntl();
  const { data: gardens = [], isLoading } = usePublicGardens();
  const [searchParams] = useSearchParams();

  const intentId = searchParams.get("intent");
  const gardenQuery = searchParams.get("garden");

  const resolved = useMemo(() => resolveGardenQuery(gardenQuery, gardens), [gardenQuery, gardens]);
  const totalGardeners = useMemo(
    () => gardens.reduce((sum, g) => sum + g.contributorCount, 0),
    [gardens]
  );

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
      // entry for the exact tuple. Until that lands, this branch is unreachable
      // by design and the dialog falls back to wallet.
    },
    []
  );

  return (
    <div className="bg-bg-weak-50">
      {/* Editorial header */}
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-6 sm:px-6 sm:pt-16">
        <h1 className="font-serif text-3xl text-text-strong-950 md:text-4xl">
          {formatMessage({ id: "public.fund.title", defaultMessage: "Fund" })}
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-text-sub-600 md:text-base">
          {formatMessage({
            id: "public.fund.description",
            defaultMessage:
              "Support regenerative Gardens directly through Cookie Jars, or Endow a Vault designed to preserve your deposit while yield helps the Garden.",
          })}
        </p>
        <p className="mt-2 max-w-2xl text-xs text-text-soft-400">
          {formatMessage({
            id: "public.fund.taxDisclaimer",
            defaultMessage:
              "Funding supports the Garden directly. It is not tax-deductible, charitable, or nonprofit-backed unless separately configured.",
          })}
        </p>
      </div>

      {/* Receipt UI takes priority when ?intent= is present */}
      {intentId ? (
        <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <PublicFundingReceipt intentId={intentId} />
        </div>
      ) : null}

      {/* Stale/ambiguous /fund?garden message */}
      {resolved.status === "stale" || resolved.status === "ambiguous" ? (
        <div className="mx-auto max-w-6xl px-4 pb-4 sm:px-6">
          <div
            role="status"
            className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm text-text-sub-600"
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
          </div>
        </div>
      ) : null}

      {/* Aggregate stats — confirmed counts only */}
      <div className="mx-auto grid max-w-6xl gap-4 px-4 pb-8 sm:grid-cols-2 sm:px-6">
        <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({
              id: "public.fund.totalGardens",
              defaultMessage: "Total Gardens",
            })}
          </p>
          <p className="mt-2 font-serif text-3xl text-text-strong-950">
            {isLoading ? "—" : gardens.length}
          </p>
        </div>
        <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({
              id: "public.fund.totalContributors",
              defaultMessage: "Total Contributors",
            })}
          </p>
          <p className="mt-2 font-serif text-3xl text-text-strong-950">
            {isLoading ? "—" : totalGardeners}
          </p>
        </div>
      </div>

      {/* Garden list */}
      <div className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl bg-bg-white-0"
                aria-hidden="true"
              />
            ))}
          </div>
        ) : orderedGardens.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stroke-soft-200 bg-bg-white-0 p-8 text-sm text-text-sub-600">
            {formatMessage({
              id: "public.fund.empty",
              defaultMessage: "Funding destinations will appear here as Gardens enable them.",
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {orderedGardens.map((garden) => {
              const isMatchedHighlight =
                resolved.status === "match" && resolved.garden?.id === garden.id;
              return (
                <div
                  key={garden.id}
                  ref={isMatchedHighlight ? matchHighlightRef : undefined}
                  className={
                    isMatchedHighlight
                      ? "relative rounded-3xl ring-2 ring-primary-base ring-offset-2"
                      : undefined
                  }
                >
                  <PublicGardenCard garden={garden} />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={() => setSelectorGarden(garden)}
                      className="rounded-full bg-primary-action px-5 py-2.5 text-sm font-semibold text-primary-action-foreground transition-colors hover:bg-primary-action-hover"
                    >
                      {formatMessage({
                        id: "public.fund.support",
                        defaultMessage: "Support this Garden",
                      })}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
