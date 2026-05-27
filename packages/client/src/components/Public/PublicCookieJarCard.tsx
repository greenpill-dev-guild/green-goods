import {
  type Address,
  Alert,
  Button,
  type CampaignCookieJarCampaign,
  classifyTxError,
  cn,
  formatTokenAmount,
  ImageWithFallback,
  isMeaningfulTxErrorMessage,
  type PublicGardenSummary,
  resolveIPFSUrl,
  TxInlineFeedback,
  useAppKit,
  useCampaignCookieJar,
  useCampaignCookieJarDeposit,
  useCampaignCookieJarWithdraw,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { useBalance } from "wagmi";

export type CookieJarBucket = "for-you" | "active" | "unresolved";

const STRICT_PURPOSE_MIN_LENGTH = 27;
const FALLBACK_CAMPAIGN_COOKIE_JAR_CLAIM_PURPOSE = "Green Goods campaign cookie claim";

export type CookieJarStatus =
  | { kind: "for-you-claimable"; bucket: "for-you" }
  | { kind: "for-you-cooldown"; bucket: "for-you"; nextClaimAt: number }
  | { kind: "for-you-claimed"; bucket: "for-you" }
  | { kind: "needs-funding"; bucket: "active" }
  | { kind: "claims-paused"; bucket: "active" }
  | { kind: "active-open"; bucket: "active" }
  | { kind: "active-not-eligible"; bucket: "active" }
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

export function classifyCookieJarStatus(
  jar: JarLikeForStatus | null | undefined,
  options: { hasError: boolean; isConnected: boolean }
): CookieJarStatus {
  if (options.hasError) return { kind: "error", bucket: "unresolved" };
  if (!jar) return { kind: "loading", bucket: "unresolved" };

  if (jar.isPaused) return { kind: "claims-paused", bucket: "active" };
  if (jar.balance === 0n) return { kind: "needs-funding", bucket: "active" };

  if (options.isConnected && jar.isEligible) {
    if (jar.canClaimNow) return { kind: "for-you-claimable", bucket: "for-you" };
    if (jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n) {
      return { kind: "for-you-claimed", bucket: "for-you" };
    }
    if (jar.nextClaimAt && jar.nextClaimAt * 1000 > Date.now()) {
      return { kind: "for-you-cooldown", bucket: "for-you", nextClaimAt: jar.nextClaimAt };
    }
  }

  if (options.isConnected && !jar.isEligible) {
    return { kind: "active-not-eligible", bucket: "active" };
  }
  return { kind: "active-open", bucket: "active" };
}

function formatDisplayAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatTokenAmount(value, decimals, 4)} ${symbol}`;
}

function resolveCampaignCookieJarClaimPurpose(
  formatMessage: ReturnType<typeof useIntl>["formatMessage"],
  strictPurpose: boolean
): string {
  const localizedPurpose = formatMessage({
    id: "public.cookies.defaultPurpose",
    defaultMessage: FALLBACK_CAMPAIGN_COOKIE_JAR_CLAIM_PURPOSE,
  });

  if (!strictPurpose || localizedPurpose.trim().length >= STRICT_PURPOSE_MIN_LENGTH) {
    return localizedPurpose;
  }

  return FALLBACK_CAMPAIGN_COOKIE_JAR_CLAIM_PURPOSE;
}

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

function formatClaimWindow(seconds: number, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(seconds * 1000));
}

function getClaimableAmount(
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]>
): bigint {
  if (jar.withdrawalType === "fixed") return jar.fixedAmount;
  if (jar.withdrawalType === "variable") {
    return jar.balance < jar.maxWithdrawal ? jar.balance : jar.maxWithdrawal;
  }
  return 0n;
}

const STATUS_PILL_CLASSES: Record<CookieJarStatus["kind"], string> = {
  "for-you-claimable": "bg-domain-agro-soft text-domain-agro",
  "for-you-cooldown": "bg-domain-education-soft text-domain-education",
  "for-you-claimed": "bg-bg-weak-50 text-text-soft-400",
  "needs-funding": "bg-domain-solar-soft text-domain-solar",
  "claims-paused": "bg-warning-lighter text-warning-dark",
  "active-open": "bg-domain-solar-soft text-domain-solar",
  "active-not-eligible": "bg-bg-weak-50 text-text-soft-400",
  loading: "bg-bg-weak-50 text-text-soft-400",
  error: "bg-error-lighter text-error-dark",
};

export interface PublicCookieJarCardProps {
  campaign: CampaignCookieJarCampaign;
  gardensByAddress?: Map<Address, PublicGardenSummary>;
  isConnected: boolean;
  isHighlighted?: boolean;
}

export function PublicCookieJarCard({
  campaign,
  gardensByAddress,
  isConnected,
  isHighlighted = false,
}: PublicCookieJarCardProps) {
  const intl = useIntl();
  const rootRef = useRef<HTMLElement>(null);
  const { jar, isLoading, error, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const status = classifyCookieJarStatus(jar, { hasError: Boolean(error), isConnected });

  const metadata = jar?.metadata ?? campaign.metadata;
  const title = metadata?.title ?? campaign.title ?? campaign.label;
  const description = metadata?.description;
  const image = metadata?.image ? resolveIPFSUrl(metadata.image) : null;
  const externalUrl = metadata?.externalUrl;
  const decimals = jar?.decimals ?? 18;
  const symbol = jar?.symbol ?? "TOKEN";
  const sourceGardens = metadata?.sourceGardens ?? [];
  const sourceLabel = formatSourceGardens(sourceGardens, gardensByAddress);

  useEffect(() => {
    if (!isHighlighted) return;
    rootRef.current?.scrollIntoView?.({ behavior: "smooth", block: "center" });
    rootRef.current?.focus({ preventScroll: true });
  }, [isHighlighted]);

  const statusLabel = (() => {
    switch (status.kind) {
      case "for-you-claimable":
        return intl.formatMessage({
          id: "public.cookies.status.forYouClaimable",
          defaultMessage: "Ready to claim",
        });
      case "for-you-cooldown":
        return intl.formatMessage({
          id: "public.cookies.status.forYouCooldown",
          defaultMessage: "Claim window pending",
        });
      case "for-you-claimed":
        return intl.formatMessage({
          id: "public.cookies.status.forYouClaimed",
          defaultMessage: "Already claimed",
        });
      case "needs-funding":
        return intl.formatMessage({
          id: "public.cookies.status.needsFunding",
          defaultMessage: "Needs funding",
        });
      case "claims-paused":
        return intl.formatMessage({
          id: "public.cookies.status.claimsPaused",
          defaultMessage: "Claims paused",
        });
      case "active-open":
        return intl.formatMessage({
          id: "public.cookies.status.activeOpen",
          defaultMessage: "Open jar",
        });
      case "active-not-eligible":
        return intl.formatMessage({
          id: "public.cookies.status.activeNotEligible",
          defaultMessage: "Not on this list",
        });
      case "loading":
        return intl.formatMessage({
          id: "public.cookies.status.loading",
          defaultMessage: "Reading...",
        });
      case "error":
        return intl.formatMessage({
          id: "public.cookies.status.error",
          defaultMessage: "Needs link check",
        });
    }
  })();

  const heroAmount: { value: string; label: string } = (() => {
    if (status.kind === "for-you-claimable" && jar) {
      return {
        value: formatTokenAmount(getClaimableAmount(jar), decimals, 4),
        label: intl.formatMessage(
          { id: "public.cookies.metric.readyToClaim", defaultMessage: "{symbol} ready to claim" },
          { symbol }
        ),
      };
    }
    if (status.kind === "for-you-cooldown") {
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
          { id: "public.cookies.metric.youClaimed", defaultMessage: "{symbol} claimed" },
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
      value: isLoading ? "..." : "?",
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

  return (
    <article
      ref={rootRef}
      tabIndex={-1}
      id={`cookie-jar-${campaign.slug}`}
      aria-label={title}
      className={cn(
        "flex h-full flex-col gap-4 border-t border-stroke-soft-200 pt-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2",
        isHighlighted && "ring-2 ring-primary-action ring-offset-2"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.16em]",
            STATUS_PILL_CLASSES[status.kind]
          )}
        >
          {statusLabel}
        </span>
        {campaign.createdAt ? (
          <span className="text-xs text-text-soft-400">
            {formatDate(campaign.createdAt, intl.locale)}
          </span>
        ) : null}
      </div>

      <div className="relative aspect-[4/3] w-full overflow-hidden bg-bg-weak-50">
        {image ? (
          <ImageWithFallback
            src={image}
            alt={intl.formatMessage(
              {
                id: "public.cookies.campaignImageAlt",
                defaultMessage: "{title} campaign artwork",
              },
              { title }
            )}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center">
            <p className="font-serif text-lg italic leading-snug text-text-soft-400">
              {intl.formatMessage({
                id: "public.cookies.imageFallback",
                defaultMessage: "Cookie jar",
              })}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3
          className="font-serif text-xl font-normal leading-[1.15] text-text-strong-950"
          title={title}
        >
          <span className="line-clamp-2">{title}</span>
        </h3>
        {description ? (
          <p className="text-sm leading-[1.55] text-text-sub-600" title={description}>
            <span className="line-clamp-3">{description}</span>
          </p>
        ) : null}
        {sourceLabel ? (
          <p className="text-sm font-medium leading-[1.4] text-text-strong-950" title={sourceLabel}>
            <span className="line-clamp-1">{sourceLabel}</span>
          </p>
        ) : null}
      </div>

      <div className="grid gap-1">
        <p className="font-serif text-3xl font-normal leading-none text-text-strong-950">
          {heroAmount.value}
        </p>
        <p className="text-xs leading-relaxed text-text-soft-400">{heroAmount.label}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-soft-400">
        {accessLabel ? <span>{accessLabel}</span> : null}
        {accessLabel && partialReadHint ? (
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
          />
        ) : null}
        {partialReadHint ? <span className="italic">{partialReadHint}</span> : null}
        {externalUrl ? (
          <>
            {accessLabel || partialReadHint ? (
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-0.5 rounded-full bg-current opacity-50"
              />
            ) : null}
            <a
              href={externalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-text-sub-600 underline decoration-stroke-soft-200 underline-offset-4 transition hover:text-primary-action"
            >
              {intl.formatMessage({
                id: "public.cookies.campaignPage",
                defaultMessage: "Campaign page",
              })}
            </a>
          </>
        ) : null}
      </div>

      {jar ? (
        <CampaignCookieJarInlineActions jar={jar} />
      ) : (
        <div className="mt-auto rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm text-text-sub-600">
          {isLoading
            ? intl.formatMessage({
                id: "public.cookies.status.loading",
                defaultMessage: "Reading...",
              })
            : intl.formatMessage({
                id: "public.cookies.loadFailed",
                defaultMessage:
                  "This cookie jar could not be loaded. Check the link and try again.",
              })}
        </div>
      )}
    </article>
  );
}

function CampaignCookieJarInlineActions({
  jar,
}: {
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]>;
}) {
  const { formatMessage, locale } = useIntl();
  const { primaryAddress } = useUser();
  const { open: openWalletModal } = useAppKit();
  const claimId = useId();
  const depositId = useId();
  const [claimAmount, setClaimAmount] = useState("");
  const [depositAmount, setDepositAmount] = useState("");

  const depositMutation = useCampaignCookieJarDeposit({ errorMode: "inline" });
  const claimMutation = useCampaignCookieJarWithdraw({ errorMode: "inline" });
  const depositMutationError = depositMutation.error;
  const resetDepositMutation = depositMutation.reset;
  const claimMutationError = claimMutation.error;
  const resetClaimMutation = claimMutation.reset;

  const fixedClaim = jar.withdrawalType === "fixed";
  const claimableAmount = getClaimableAmount(jar);
  const decimals = jar.decimals;
  const symbol = jar.symbol;
  const depositError = validateDecimalInput(depositAmount, decimals);
  const claimInputError = fixedClaim ? null : validateDecimalInput(claimAmount, decimals);
  const depositErrorMessage = depositError
    ? formatMessage({ id: depositError, defaultMessage: "Enter a valid amount." })
    : null;
  const claimInputErrorMessage = claimInputError
    ? formatMessage({ id: claimInputError, defaultMessage: "Enter a valid amount." })
    : null;

  const parsedDeposit = useMemo(() => {
    if (!depositAmount.trim() || depositError) return 0n;
    try {
      return parseUnits(depositAmount, decimals);
    } catch {
      return 0n;
    }
  }, [decimals, depositAmount, depositError]);

  const parsedClaim = useMemo(() => {
    if (fixedClaim) return claimableAmount;
    if (!claimAmount.trim() || claimInputError) return 0n;
    try {
      return parseUnits(claimAmount, decimals);
    } catch {
      return 0n;
    }
  }, [claimAmount, claimInputError, claimableAmount, decimals, fixedClaim]);

  const belowMinDeposit = parsedDeposit > 0n && parsedDeposit < jar.minDeposit;
  const claimTooLarge = !fixedClaim && parsedClaim > 0n && parsedClaim > jar.maxWithdrawal;
  const claimExceedsBalance = parsedClaim > jar.balance;
  const claimDisabled =
    !primaryAddress ||
    !jar.isEligible ||
    !jar.canClaimNow ||
    parsedClaim <= 0n ||
    claimTooLarge ||
    claimExceedsBalance ||
    Boolean(claimInputError) ||
    claimMutation.isPending;
  const depositDisabled =
    !primaryAddress ||
    parsedDeposit <= 0n ||
    Boolean(depositError) ||
    Boolean(belowMinDeposit) ||
    depositMutation.isPending;

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: jar.assetAddress,
    query: { enabled: Boolean(primaryAddress && jar.assetAddress) },
  });

  useEffect(() => {
    if (!jar || !fixedClaim) return;
    setClaimAmount(formatUnits(claimableAmount, decimals));
  }, [claimableAmount, decimals, fixedClaim, jar]);

  useEffect(() => {
    if (depositMutationError) resetDepositMutation();
  }, [depositAmount, depositMutationError, resetDepositMutation]);

  useEffect(() => {
    if (claimMutationError) resetClaimMutation();
  }, [claimAmount, claimMutationError, resetClaimMutation]);

  const activeError = claimMutationError ?? depositMutationError;
  const txErrorView = useMemo(() => classifyTxError(activeError), [activeError]);
  const txErrorTitle = formatMessage({
    id: txErrorView.titleKey,
    defaultMessage:
      txErrorView.severity === "warning" ? "Transaction cancelled" : "Transaction failed",
  });
  const txErrorMessage = isMeaningfulTxErrorMessage(txErrorView.rawMessage)
    ? txErrorView.rawMessage
    : formatMessage({
        id: txErrorView.messageKey,
        defaultMessage: "Something went wrong. Please try again.",
      });

  const nextClaimLabel = jar.nextClaimAt ? formatClaimWindow(jar.nextClaimAt, locale) : null;

  const handleClaim = () => {
    if (!primaryAddress) {
      openWalletModal();
      return;
    }
    if (claimDisabled) return;
    claimMutation.mutate(
      {
        jarAddress: jar.jarAddress,
        amount: parsedClaim,
        purpose: resolveCampaignCookieJarClaimPurpose(formatMessage, jar.strictPurpose),
      },
      {
        onSuccess: () => {
          setClaimAmount(fixedClaim ? formatUnits(claimableAmount, decimals) : "");
        },
      }
    );
  };

  const handleDeposit = () => {
    if (!primaryAddress) {
      openWalletModal();
      return;
    }
    if (depositDisabled) return;
    depositMutation.mutate(
      {
        jarAddress: jar.jarAddress,
        assetAddress: jar.assetAddress,
        amount: parsedDeposit,
      },
      {
        onSuccess: () => setDepositAmount(""),
      }
    );
  };

  if (!primaryAddress) {
    return (
      <div className="mt-auto rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-4">
        <p className="text-sm leading-[1.5] text-text-sub-600">
          {formatMessage({
            id: "public.cookies.connectHint",
            defaultMessage: "Connect a wallet to check claim access and add funds.",
          })}
        </p>
        <Button className="mt-4" onClick={() => openWalletModal()}>
          {formatMessage({
            id: "public.cookies.connectWallet",
            defaultMessage: "Connect wallet",
          })}
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-auto grid gap-4 border-t border-stroke-soft-200 pt-4">
      <div className="grid gap-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400">
            {formatMessage({ id: "public.cookies.claim", defaultMessage: "Claim" })}
          </p>
          {fixedClaim ? (
            <p className="text-xs text-text-soft-400">
              {formatDisplayAmount(claimableAmount, decimals, symbol)}
            </p>
          ) : null}
        </div>

        <ClaimEligibilityNote jar={jar} nextClaimLabel={nextClaimLabel} />

        {!fixedClaim ? (
          <label className="block" htmlFor={claimId}>
            <span className="text-sm font-medium text-text-strong-950">
              {formatMessage({
                id: "public.cookies.amountToClaim",
                defaultMessage: "Amount to claim",
              })}
            </span>
            <input
              id={claimId}
              value={claimAmount}
              onChange={(event) => setClaimAmount(event.target.value)}
              inputMode="decimal"
              className="mt-2 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm text-text-strong-950 outline-none focus:border-primary-base focus:ring-2 focus:ring-primary-base/30"
              placeholder="0.00"
            />
          </label>
        ) : null}

        {claimInputErrorMessage || claimTooLarge || claimExceedsBalance ? (
          <p className="text-sm text-error-dark">
            {claimTooLarge
              ? formatMessage(
                  {
                    id: "public.cookies.claimTooLarge",
                    defaultMessage: "Maximum claim is {amount}.",
                  },
                  { amount: formatDisplayAmount(jar.maxWithdrawal, decimals, symbol) }
                )
              : claimExceedsBalance
                ? formatMessage({
                    id: "public.cookies.claimExceedsBalance",
                    defaultMessage: "The jar does not have enough funds for that claim.",
                  })
                : claimInputErrorMessage}
          </p>
        ) : null}

        <Button
          onClick={handleClaim}
          disabled={claimDisabled}
          loading={claimMutation.isPending}
          className="w-full"
        >
          {formatMessage({
            id: "public.cookies.claimCookie",
            defaultMessage: "Claim cookie",
          })}
        </Button>
      </div>

      <div className="grid gap-3 border-t border-stroke-soft-200 pt-4">
        <label className="block" htmlFor={depositId}>
          <span className="text-sm font-medium text-text-strong-950">
            {formatMessage({
              id: "public.cookies.depositAmount",
              defaultMessage: "Deposit amount",
            })}
          </span>
          <input
            id={depositId}
            value={depositAmount}
            onChange={(event) => setDepositAmount(event.target.value)}
            inputMode="decimal"
            className="mt-2 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm text-text-strong-950 outline-none focus:border-primary-base focus:ring-2 focus:ring-primary-base/30"
            placeholder="0.00"
          />
        </label>

        {walletBalance ? (
          <p className="text-xs text-text-soft-400">
            {formatMessage(
              {
                id: "public.cookies.walletBalance",
                defaultMessage: "Wallet balance: {amount}",
              },
              { amount: `${walletBalance.formatted} ${walletBalance.symbol}` }
            )}
          </p>
        ) : null}

        {depositErrorMessage || belowMinDeposit ? (
          <p className="text-sm text-error-dark">
            {belowMinDeposit
              ? formatMessage(
                  {
                    id: "app.cookieJar.belowMinDeposit",
                    defaultMessage: "Minimum deposit is {amount} {asset}",
                  },
                  {
                    amount: formatUnits(jar.minDeposit, decimals),
                    asset: symbol,
                  }
                )
              : depositErrorMessage}
          </p>
        ) : null}

        <Button
          onClick={handleDeposit}
          disabled={depositDisabled}
          loading={depositMutation.isPending}
          className="w-full"
        >
          {formatMessage({
            id: "public.cookies.deposit",
            defaultMessage: "Deposit",
          })}
        </Button>
      </div>

      <TxInlineFeedback
        visible={Boolean(activeError)}
        severity={txErrorView.severity}
        title={txErrorTitle}
        message={txErrorMessage}
        reserveClassName="min-h-0"
      />
    </div>
  );
}

function ClaimEligibilityNote({
  jar,
  nextClaimLabel,
}: {
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]>;
  nextClaimLabel: string | null;
}) {
  const { formatMessage } = useIntl();

  if (jar.isPaused) {
    return (
      <Alert variant="warning" className="p-3">
        {formatMessage({
          id: "public.cookies.paused",
          defaultMessage: "Claims are paused for this jar.",
        })}
      </Alert>
    );
  }
  if (!jar.isEligible) {
    return (
      <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
        {formatMessage({
          id: "public.cookies.notEligible",
          defaultMessage:
            "This jar is for garden operators on the campaign allowlist. Your wallet is not on the list yet.",
        })}
      </p>
    );
  }
  if (jar.balance === 0n) {
    return (
      <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
        {formatMessage({
          id: "public.cookies.needsFunding",
          defaultMessage: "This jar needs funds before claims can go out.",
        })}
      </p>
    );
  }
  if (jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n) {
    return (
      <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
        {formatMessage({
          id: "public.cookies.alreadyClaimed",
          defaultMessage: "This wallet has already claimed from this jar.",
        })}
      </p>
    );
  }
  if (nextClaimLabel) {
    return (
      <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
        {formatMessage(
          {
            id: "public.cookies.nextClaim",
            defaultMessage: "Next claim window opens at {time}.",
          },
          { time: nextClaimLabel }
        )}
      </p>
    );
  }
  return (
    <Alert variant="success" className="p-3">
      {formatMessage({
        id: "public.cookies.ready",
        defaultMessage: "You are on the list. Claim when you are ready.",
      })}
    </Alert>
  );
}
