import {
  type Address,
  type CampaignCookieJarCampaign,
  cn,
  formatTokenAmount,
  type PublicGardenSummary,
  useCampaignCookieJar,
} from "@green-goods/shared";
import { useIntl } from "react-intl";

/**
 * The classification a `CookieJarStatus` falls into. Drives both the section
 * the card lives in (For-you / Active / Past) and the pill color/copy at the
 * top of the card.
 */
export type CookieJarBucket = "for-you" | "active" | "past" | "unresolved";

export type CookieJarStatus =
  | { kind: "for-you-claimable"; bucket: "for-you" }
  | { kind: "for-you-cooldown"; bucket: "for-you"; nextClaimAt: number }
  | { kind: "for-you-claimed"; bucket: "for-you" }
  | { kind: "for-you-empty"; bucket: "for-you" }
  | { kind: "active-open"; bucket: "active" }
  | { kind: "active-not-eligible"; bucket: "active" }
  | { kind: "past-paused"; bucket: "past" }
  | { kind: "past-empty"; bucket: "past" }
  | { kind: "loading"; bucket: "unresolved" }
  | { kind: "error"; bucket: "unresolved" };

interface JarLikeForStatus {
  isPaused: boolean;
  balance: bigint;
  isEligible: boolean;
  canClaimNow: boolean;
  nextClaimAt: number | null;
  oneTimeWithdrawal: boolean;
  totalWithdrawn: bigint;
}

/**
 * Centralized status classification. Exported so the parent surface can run
 * the same logic against a `JarStateProbe`'s reading and bucket the campaign
 * for sectioning *before* the card renders.
 */
export function classifyCookieJarStatus(
  jar: JarLikeForStatus | null | undefined,
  options: { hasError: boolean; isConnected: boolean }
): CookieJarStatus {
  if (options.hasError) return { kind: "error", bucket: "unresolved" };
  if (!jar) return { kind: "loading", bucket: "unresolved" };

  if (jar.isPaused) return { kind: "past-paused", bucket: "past" };
  if (jar.balance === 0n) return { kind: "past-empty", bucket: "past" };

  if (options.isConnected && jar.isEligible) {
    if (jar.canClaimNow) return { kind: "for-you-claimable", bucket: "for-you" };
    if (jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n) {
      return { kind: "for-you-claimed", bucket: "for-you" };
    }
    if (jar.nextClaimAt && jar.nextClaimAt * 1000 > Date.now()) {
      return { kind: "for-you-cooldown", bucket: "for-you", nextClaimAt: jar.nextClaimAt };
    }
    return { kind: "for-you-empty", bucket: "for-you" };
  }

  if (options.isConnected && !jar.isEligible) {
    return { kind: "active-not-eligible", bucket: "active" };
  }
  return { kind: "active-open", bucket: "active" };
}

/** "Aiyeloja Family Garden", "Aiyeloja Family Garden + 2", or "Across 3 Gardens". */
function formatSourceGardens(
  sourceGardens: readonly Address[],
  gardensByAddress: Map<Address, PublicGardenSummary> | undefined
): string {
  if (sourceGardens.length === 0) return "";
  const names = sourceGardens
    .map((addr) => gardensByAddress?.get(addr.toLowerCase() as Address)?.name)
    .filter((name): name is string => Boolean(name && name.trim().length > 0));
  if (names.length === 0)
    return `${sourceGardens.length} Garden${sourceGardens.length === 1 ? "" : "s"}`;
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names[0]} + ${names.length - 1} more`;
}

function formatDate(seconds: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(seconds * 1000);
}

const STATUS_PILL_CLASSES: Record<CookieJarStatus["kind"], string> = {
  "for-you-claimable": "bg-domain-agro-soft text-domain-agro",
  "for-you-cooldown": "bg-domain-education-soft text-domain-education",
  "for-you-claimed": "bg-bg-weak-50 text-text-soft-400 line-through",
  "for-you-empty": "bg-bg-weak-50 text-text-soft-400",
  "active-open": "bg-domain-solar-soft text-domain-solar",
  "active-not-eligible": "bg-bg-weak-50 text-text-soft-400",
  "past-paused": "bg-bg-weak-50 text-text-soft-400",
  "past-empty": "bg-bg-weak-50 text-text-soft-400",
  loading: "bg-bg-weak-50 text-text-soft-400",
  error: "bg-error-lighter text-error-dark",
};

export interface PublicCookieJarCardProps {
  campaign: CampaignCookieJarCampaign;
  gardensByAddress?: Map<Address, PublicGardenSummary>;
  isConnected: boolean;
  onOpen: (campaign: CampaignCookieJarCampaign) => void;
}

/**
 * Editorial cookie-jar campaign card. Hairline-only chrome, Fraunces title,
 * domain-inked status pill at the top, big-serif hero numeral, source-Garden
 * line, and a created/access meta strip at the bottom. Replaces the older
 * `CampaignCookieJarCard` that lived inside `Cookies.tsx` and used
 * `border + shadow-sm` chrome that didn't match Gardens / Impact.
 *
 * The whole card is a `<button>` so opening the campaign dialog is one click,
 * and so the card participates in keyboard nav like the rest of the public
 * surfaces.
 */
export function PublicCookieJarCard({
  campaign,
  gardensByAddress,
  isConnected,
  onOpen,
}: PublicCookieJarCardProps) {
  const intl = useIntl();
  const { jar, isLoading, error, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const status = classifyCookieJarStatus(jar, { hasError: Boolean(error), isConnected });

  const title = jar?.metadata?.title ?? campaign.title ?? campaign.label;
  const decimals = jar?.decimals ?? 18;
  const symbol = jar?.symbol ?? "TOKEN";
  const sourceGardens = jar?.metadata?.sourceGardens ?? campaign.metadata?.sourceGardens ?? [];
  const sourceLabel = formatSourceGardens(sourceGardens, gardensByAddress);

  const statusLabel = (() => {
    switch (status.kind) {
      case "for-you-claimable":
        return intl.formatMessage({
          id: "public.cookies.status.forYouClaimable",
          defaultMessage: "For you · ready",
        });
      case "for-you-cooldown":
        return intl.formatMessage({
          id: "public.cookies.status.forYouCooldown",
          defaultMessage: "For you · cooldown",
        });
      case "for-you-claimed":
        return intl.formatMessage({
          id: "public.cookies.status.forYouClaimed",
          defaultMessage: "Claimed",
        });
      case "for-you-empty":
        return intl.formatMessage({
          id: "public.cookies.status.forYouEmpty",
          defaultMessage: "On the list",
        });
      case "active-open":
        return intl.formatMessage({
          id: "public.cookies.status.activeOpen",
          defaultMessage: "Active",
        });
      case "active-not-eligible":
        return intl.formatMessage({
          id: "public.cookies.status.activeNotEligible",
          defaultMessage: "Not on this list",
        });
      case "past-paused":
        return intl.formatMessage({
          id: "public.cookies.status.pastPaused",
          defaultMessage: "Paused",
        });
      case "past-empty":
        return intl.formatMessage({
          id: "public.cookies.status.pastEmpty",
          defaultMessage: "Sealed",
        });
      case "loading":
        return intl.formatMessage({
          id: "public.cookies.status.loading",
          defaultMessage: "Reading…",
        });
      case "error":
        return intl.formatMessage({
          id: "public.cookies.status.error",
          defaultMessage: "Needs link check",
        });
    }
  })();

  // Hero metric: serves the visitor's most useful number for the current
  // status. Connected eligible → claimable amount. Otherwise → balance.
  const heroAmount: { value: string; label: string } = (() => {
    if (status.kind === "for-you-claimable" && jar) {
      return {
        value: formatTokenAmount(jar.fixedAmount, decimals, 4),
        label: intl.formatMessage(
          { id: "public.cookies.metric.readyToClaim", defaultMessage: "{symbol} ready to claim" },
          { symbol }
        ),
      };
    }
    if (status.kind === "for-you-cooldown" && jar) {
      return {
        value: formatDate(status.nextClaimAt, intl.locale),
        label: intl.formatMessage({
          id: "public.cookies.metric.nextClaim",
          defaultMessage: "Next claim window",
        }),
      };
    }
    if (status.kind === "for-you-claimed" && jar) {
      return {
        value: formatTokenAmount(jar.totalWithdrawn, decimals, 4),
        label: intl.formatMessage(
          { id: "public.cookies.metric.youClaimed", defaultMessage: "{symbol} you've claimed" },
          { symbol }
        ),
      };
    }
    if (jar) {
      return {
        value: formatTokenAmount(jar.balance, decimals, 4),
        label: intl.formatMessage(
          { id: "public.cookies.metric.available", defaultMessage: "{symbol} in the jar" },
          { symbol }
        ),
      };
    }
    return {
      value: isLoading ? "—" : "?",
      label: intl.formatMessage({
        id: "public.cookies.metric.unknown",
        defaultMessage: "balance unavailable",
      }),
    };
  })();

  const accessLabel = (() => {
    if (!jar) return null;
    if (jar.accessType === "allowlist") {
      return intl.formatMessage({
        id: "public.cookies.access.allowlist",
        defaultMessage: "Operator allowlist",
      });
    }
    if (jar.accessType === "erc721" || jar.accessType === "erc1155") {
      return intl.formatMessage({
        id: "public.cookies.access.gated",
        defaultMessage: "NFT-gated",
      });
    }
    return null;
  })();

  const partialReadHint = hasDetailReadFailure
    ? intl.formatMessage({
        id: "public.cookies.partialReadCard",
        defaultMessage: "Some details unavailable.",
      })
    : null;

  const createdAt = campaign.createdAt;

  return (
    <button
      type="button"
      onClick={() => onOpen(campaign)}
      className="group flex h-full cursor-pointer flex-col gap-4 border-t border-stroke-soft-200 pt-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
      aria-label={title}
    >
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
          STATUS_PILL_CLASSES[status.kind]
        )}
      >
        {statusLabel}
      </span>

      <h3
        className="font-serif text-xl font-normal leading-[1.15] tracking-[-0.012em] text-text-strong-950 transition-[color,transform] duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] group-hover:text-primary-action motion-safe:group-hover:-translate-y-px"
        title={title}
      >
        <span className="line-clamp-2">{title}</span>
      </h3>

      {sourceLabel ? (
        <p className="text-sm font-medium leading-[1.4] text-text-strong-950" title={sourceLabel}>
          <span className="line-clamp-1">{sourceLabel}</span>
        </p>
      ) : null}

      <div className="mt-2 flex flex-col gap-1">
        <p className="font-serif text-3xl font-normal leading-none tracking-[-0.025em] text-text-strong-950">
          {heroAmount.value}
        </p>
        <p className="text-xs leading-relaxed text-text-soft-400">{heroAmount.label}</p>
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 text-xs text-text-soft-400">
        {createdAt ? <span>{formatDate(createdAt, intl.locale)}</span> : null}
        {createdAt && accessLabel ? (
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
          />
        ) : null}
        {accessLabel ? <span>{accessLabel}</span> : null}
        {partialReadHint ? (
          <>
            <span
              aria-hidden="true"
              className="inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
            />
            <span className="italic">{partialReadHint}</span>
          </>
        ) : null}
      </div>
    </button>
  );
}
