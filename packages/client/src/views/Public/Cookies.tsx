import {
  type Address,
  Button,
  type CampaignCookieJarCampaign,
  classifyTxError,
  formatTokenAmount,
  isMeaningfulTxErrorMessage,
  TxInlineFeedback,
  useAppKit,
  useCampaignCookieJar,
  useCampaignCookieJarCampaigns,
  useCampaignCookieJarDeposit,
  useCampaignCookieJarWithdraw,
  useInViewReveal,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { useBalance } from "wagmi";
import { EditorialTitleAccent } from "@/components/Public/atoms";
import { PublicEditorialHero } from "@/components/Public/PublicEditorialHero";
import { PublicFooter } from "@/components/Public/PublicFooter";
import { getPublicHeroImage, publicCuration } from "@/content/publicCuration";

const WalletRuntimeProviders = lazy(() => import("@/routes/WalletRuntimeProviders"));

type CookieMode = "claim" | "deposit";

function formatDisplayAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatTokenAmount(value, decimals, 4)} ${symbol}`;
}

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

function CampaignCookieJarPanel({ jarAddress }: { jarAddress: Address }) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  const { open: openWalletModal } = useAppKit();
  const [mode, setMode] = useState<CookieMode>("claim");
  const [depositAmount, setDepositAmount] = useState("");
  const [claimAmount, setClaimAmount] = useState("");
  const [purpose, setPurpose] = useState(
    formatMessage({
      id: "public.cookies.defaultPurpose",
      defaultMessage: "Campaign cookie claim",
    })
  );

  const { jar, isLoading, error, hasDetailReadFailure } = useCampaignCookieJar(jarAddress);
  const depositMutation = useCampaignCookieJarDeposit({ errorMode: "inline" });
  const claimMutation = useCampaignCookieJarWithdraw({ errorMode: "inline" });
  const depositMutationError = depositMutation.error;
  const resetDepositMutation = depositMutation.reset;
  const claimMutationError = claimMutation.error;
  const resetClaimMutation = claimMutation.reset;

  const decimals = jar?.decimals ?? 18;
  const symbol = jar?.symbol ?? "TOKEN";
  const fixedClaim = jar?.withdrawalType === "fixed";
  const effectiveClaimAmount = fixedClaim ? (jar?.fixedAmount ?? 0n) : claimAmount;
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
    if (!jar) return 0n;
    if (fixedClaim) return jar.fixedAmount;
    if (!claimAmount.trim() || claimInputError) return 0n;
    try {
      return parseUnits(claimAmount, decimals);
    } catch {
      return 0n;
    }
  }, [claimAmount, claimInputError, decimals, fixedClaim, jar]);

  const maxVariableClaim = jar?.maxWithdrawal ?? 0n;
  const claimTooLarge = !fixedClaim && parsedClaim > 0n && parsedClaim > maxVariableClaim;
  const claimExceedsBalance = jar ? parsedClaim > jar.balance : false;
  const belowMinDeposit = jar && parsedDeposit > 0n && parsedDeposit < jar.minDeposit;

  const { data: walletBalance } = useBalance({
    address: primaryAddress as Address | undefined,
    token: jar?.assetAddress,
    query: { enabled: Boolean(primaryAddress && jar?.assetAddress) },
  });

  useEffect(() => {
    if (!jar || !fixedClaim) return;
    setClaimAmount(formatUnits(jar.fixedAmount, decimals));
  }, [decimals, fixedClaim, jar]);

  useEffect(() => {
    if (depositMutationError) resetDepositMutation();
  }, [depositAmount, depositMutationError, resetDepositMutation]);

  useEffect(() => {
    if (claimMutationError) resetClaimMutation();
  }, [claimAmount, purpose, claimMutationError, resetClaimMutation]);

  const activeError = mode === "claim" ? claimMutationError : depositMutationError;
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

  const nextClaimLabel = jar?.nextClaimAt
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(jar.nextClaimAt * 1000))
    : null;

  const claimDisabled =
    !jar ||
    !primaryAddress ||
    !jar.isEligible ||
    !jar.canClaimNow ||
    parsedClaim <= 0n ||
    claimTooLarge ||
    claimExceedsBalance ||
    Boolean(claimInputError) ||
    claimMutation.isPending ||
    (jar.strictPurpose && purpose.trim().length === 0);
  const depositDisabled =
    !jar ||
    !primaryAddress ||
    parsedDeposit <= 0n ||
    Boolean(depositError) ||
    Boolean(belowMinDeposit) ||
    depositMutation.isPending;

  const handleClaim = () => {
    if (!jar || claimDisabled) return;
    claimMutation.mutate(
      {
        jarAddress: jar.jarAddress,
        amount: parsedClaim,
        purpose: purpose.trim() || effectiveClaimAmount.toString(),
      },
      {
        onSuccess: () => {
          setClaimAmount(fixedClaim ? formatUnits(jar.fixedAmount, decimals) : "");
        },
      }
    );
  };

  const handleDeposit = () => {
    if (!jar || depositDisabled) return;
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

  if (isLoading) {
    return (
      <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-6">
        <div className="h-4 w-36 animate-pulse rounded bg-bg-soft-200" />
        <div className="mt-5 h-24 animate-pulse rounded bg-bg-weak-50" />
      </div>
    );
  }

  if (error || !jar) {
    return (
      <div className="rounded-lg border border-error-light bg-error-lighter p-5 text-sm text-error-dark">
        {formatMessage({
          id: "public.cookies.loadFailed",
          defaultMessage: "This cookie jar could not be loaded. Check the link and try again.",
        })}
      </div>
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-text-soft-400">
              {formatMessage({
                id: "public.cookies.sharedJar",
                defaultMessage: "Shared Cookie Jar",
              })}
            </p>
            <h2 className="mt-2 font-serif text-2xl text-text-strong-950">
              {jar.metadata?.title ??
                formatMessage({
                  id: "public.cookies.untitled",
                  defaultMessage: "Campaign cookie jar",
                })}
            </h2>
          </div>
          <div className="rounded-full border border-stroke-soft-200 p-1">
            {(["claim", "deposit"] as CookieMode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setMode(option)}
                className={
                  mode === option
                    ? "rounded-full bg-primary-action px-4 py-2 text-sm font-semibold text-primary-action-foreground"
                    : "rounded-full px-4 py-2 text-sm font-medium text-text-sub-600 hover:text-text-strong-950"
                }
              >
                {formatMessage({
                  id: option === "claim" ? "public.cookies.claim" : "public.cookies.deposit",
                  defaultMessage: option === "claim" ? "Claim" : "Deposit",
                })}
              </button>
            ))}
          </div>
        </div>

        {hasDetailReadFailure ? (
          <p className="mt-4 rounded-lg border border-warning-light bg-warning-lighter p-3 text-sm text-warning-dark">
            {formatMessage({
              id: "public.cookies.partialRead",
              defaultMessage:
                "Some cookie jar details could not be confirmed. The available state is shown below.",
            })}
          </p>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <CookieJarStat
            label={formatMessage({ id: "app.cookieJar.balance", defaultMessage: "Jar Balance" })}
            value={formatDisplayAmount(jar.balance, decimals, symbol)}
          />
          <CookieJarStat
            label={formatMessage({
              id: "public.cookies.claimAmount",
              defaultMessage: "Claim amount",
            })}
            value={
              fixedClaim
                ? formatDisplayAmount(jar.fixedAmount, decimals, symbol)
                : formatMessage({
                    id: "public.cookies.variable",
                    defaultMessage: "Variable",
                  })
            }
          />
          <CookieJarStat
            label={formatMessage({
              id: "public.cookies.access",
              defaultMessage: "Access",
            })}
            value={
              jar.accessType === "allowlist"
                ? formatMessage({
                    id: "public.cookies.operatorAllowlist",
                    defaultMessage: "Operator allowlist",
                  })
                : jar.accessType.toUpperCase()
            }
          />
          <CookieJarStat
            label={formatMessage({
              id: "public.cookies.cooldown",
              defaultMessage: "Cooldown",
            })}
            value={
              jar.withdrawalInterval === 0n
                ? formatMessage({ id: "public.cookies.none", defaultMessage: "None" })
                : formatMessage(
                    {
                      id: "public.cookies.days",
                      defaultMessage: "{count, plural, one {# day} other {# days}}",
                    },
                    { count: Math.ceil(Number(jar.withdrawalInterval) / 86400) }
                  )
            }
          />
        </div>

        <div className="mt-6 border-t border-stroke-soft-200 pt-6">
          {!primaryAddress ? (
            <div className="rounded-lg bg-bg-weak-50 p-4">
              <p className="text-sm text-text-sub-600">
                {formatMessage({
                  id: "public.cookies.connectHint",
                  defaultMessage: "Connect your wallet to check the jar and take a cookie.",
                })}
              </p>
              <Button className="mt-4" onClick={() => openWalletModal()}>
                {formatMessage({
                  id: "public.cookies.connectWallet",
                  defaultMessage: "Connect wallet",
                })}
              </Button>
            </div>
          ) : mode === "claim" ? (
            <div className="space-y-4">
              <EligibilityNote jar={jar} nextClaimLabel={nextClaimLabel} />
              {!fixedClaim ? (
                <label className="block">
                  <span className="text-sm font-medium text-text-strong-950">
                    {formatMessage({
                      id: "public.cookies.amountToClaim",
                      defaultMessage: "Amount to claim",
                    })}
                  </span>
                  <input
                    value={claimAmount}
                    onChange={(event) => setClaimAmount(event.target.value)}
                    inputMode="decimal"
                    className="mt-2 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm text-text-strong-950 outline-none focus:border-primary-base focus:ring-2 focus:ring-primary-base/30"
                    placeholder="0.00"
                  />
                </label>
              ) : null}
              <label className="block">
                <span className="text-sm font-medium text-text-strong-950">
                  {formatMessage({ id: "app.cookieJar.purpose", defaultMessage: "Purpose" })}
                </span>
                <input
                  value={purpose}
                  onChange={(event) => setPurpose(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm text-text-strong-950 outline-none focus:border-primary-base focus:ring-2 focus:ring-primary-base/30"
                />
              </label>
              {claimInputErrorMessage || claimTooLarge || claimExceedsBalance ? (
                <p className="text-sm text-error-dark">
                  {claimTooLarge
                    ? formatMessage(
                        {
                          id: "public.cookies.claimTooLarge",
                          defaultMessage: "Maximum claim is {amount}.",
                        },
                        { amount: formatDisplayAmount(maxVariableClaim, decimals, symbol) }
                      )
                    : claimExceedsBalance
                      ? formatMessage({
                          id: "public.cookies.claimExceedsBalance",
                          defaultMessage: "The jar does not have enough crumbs for that claim.",
                        })
                      : claimInputErrorMessage}
                </p>
              ) : null}
              <Button
                onClick={handleClaim}
                disabled={claimDisabled}
                loading={claimMutation.isPending}
              >
                {formatMessage({
                  id: "public.cookies.claimCookie",
                  defaultMessage: "Claim cookie",
                })}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-text-strong-950">
                  {formatMessage({
                    id: "public.cookies.depositAmount",
                    defaultMessage: "Deposit amount",
                  })}
                </span>
                <input
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
              >
                {formatMessage({
                  id: "public.cookies.feedJar",
                  defaultMessage: "Feed the jar",
                })}
              </Button>
            </div>
          )}

          <TxInlineFeedback
            visible={Boolean(activeError)}
            severity={txErrorView.severity}
            title={txErrorTitle}
            message={txErrorMessage}
            reserveClassName="min-h-0 mt-4"
          />
        </div>
      </div>

      <aside className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h3 className="font-serif text-xl text-text-strong-950">
          {formatMessage({
            id: "public.cookies.jarNotes",
            defaultMessage: "Jar notes",
          })}
        </h3>
        <dl className="mt-4 space-y-4 text-sm">
          <div>
            <dt className="text-text-soft-400">
              {formatMessage({
                id: "public.cookies.oneTime",
                defaultMessage: "One-time claim",
              })}
            </dt>
            <dd className="mt-1 text-text-strong-950">
              {jar.oneTimeWithdrawal
                ? formatMessage({ id: "app.common.yes", defaultMessage: "Yes" })
                : formatMessage({ id: "app.common.no", defaultMessage: "No" })}
            </dd>
          </div>
          <div>
            <dt className="text-text-soft-400">
              {formatMessage({
                id: "public.cookies.strictPurpose",
                defaultMessage: "Purpose required",
              })}
            </dt>
            <dd className="mt-1 text-text-strong-950">
              {jar.strictPurpose
                ? formatMessage({ id: "app.common.yes", defaultMessage: "Yes" })
                : formatMessage({ id: "app.common.no", defaultMessage: "No" })}
            </dd>
          </div>
          <div>
            <dt className="text-text-soft-400">
              {formatMessage({
                id: "public.cookies.publicLink",
                defaultMessage: "Public link",
              })}
            </dt>
            <dd className="mt-1 break-all text-text-strong-950">
              {`/cookies?jar=${jar.jarAddress}`}
            </dd>
          </div>
        </dl>
      </aside>
    </section>
  );
}

function CookieJarStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-4">
      <p className="text-xs font-medium uppercase text-text-soft-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-text-strong-950">{value}</p>
    </div>
  );
}

function EligibilityNote({
  jar,
  nextClaimLabel,
}: {
  jar: NonNullable<ReturnType<typeof useCampaignCookieJar>["jar"]>;
  nextClaimLabel: string | null;
}) {
  const { formatMessage } = useIntl();

  if (jar.isPaused) {
    return (
      <p className="rounded-lg border border-warning-light bg-warning-lighter p-3 text-sm text-warning-dark">
        {formatMessage({
          id: "public.cookies.paused",
          defaultMessage: "This jar is paused for now.",
        })}
      </p>
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
  if (jar.oneTimeWithdrawal && jar.totalWithdrawn > 0n) {
    return (
      <p className="rounded-lg border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-sub-600">
        {formatMessage({
          id: "public.cookies.alreadyClaimed",
          defaultMessage: "This wallet has already taken its cookie from this jar.",
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
            defaultMessage: "Next cookie unlocks at {time}.",
          },
          { time: nextClaimLabel }
        )}
      </p>
    );
  }
  return (
    <p className="rounded-lg border border-success-light bg-success-lighter p-3 text-sm text-success-dark">
      {formatMessage({
        id: "public.cookies.ready",
        defaultMessage: "You are on the list. Take a cookie when you are ready.",
      })}
    </p>
  );
}

function CookieIndexStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-b border-stroke-soft-200 py-4 last:border-b-0 sm:border-r sm:border-b-0 sm:px-6 sm:first:pl-0 sm:last:border-r-0 sm:last:pr-0">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
        {label}
      </p>
      <p className="mt-1 font-serif text-2xl text-text-strong-950">{value}</p>
    </div>
  );
}

function CampaignCookieJarCard({
  campaign,
  onOpen,
}: {
  campaign: CampaignCookieJarCampaign;
  onOpen: (campaign: CampaignCookieJarCampaign) => void;
}) {
  const { formatMessage } = useIntl();
  const { jar, isLoading, error, hasDetailReadFailure } = useCampaignCookieJar(campaign.address);
  const title = jar?.metadata?.title ?? campaign.label;
  const claimLabel =
    jar?.withdrawalType === "fixed"
      ? formatDisplayAmount(jar.fixedAmount, jar.decimals, jar.symbol)
      : formatMessage({ id: "public.cookies.variable", defaultMessage: "Variable" });
  const balanceLabel = jar
    ? formatDisplayAmount(jar.balance, jar.decimals, jar.symbol)
    : isLoading
      ? formatMessage({ id: "public.cookies.loadingJar", defaultMessage: "Loading jar" })
      : "—";
  const statusLabel = error
    ? formatMessage({
        id: "public.cookies.cardUnavailable",
        defaultMessage: "Needs link check",
      })
    : hasDetailReadFailure
      ? formatMessage({
          id: "public.cookies.partialReadShort",
          defaultMessage: "Partial read",
        })
      : jar?.isPaused
        ? formatMessage({
            id: "public.cookies.paused",
            defaultMessage: "This jar is paused for now.",
          })
        : formatMessage({
            id: "public.cookies.cardStatusReady",
            defaultMessage: "Ready",
          });

  return (
    <article className="group rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-primary-base/50 hover:shadow-md">
      <div className="flex h-full flex-col">
        <p className="text-xs font-medium uppercase text-text-soft-400">{campaign.slug}</p>
        <h3 className="mt-3 font-serif text-2xl text-text-strong-950">{title}</h3>
        <dl className="mt-5 grid gap-3 text-sm">
          <div className="flex items-center justify-between gap-4 border-t border-stroke-soft-200 pt-3">
            <dt className="text-text-soft-400">
              {formatMessage({ id: "public.cookies.cardBalance", defaultMessage: "Balance" })}
            </dt>
            <dd className="text-right font-medium text-text-strong-950">{balanceLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stroke-soft-200 pt-3">
            <dt className="text-text-soft-400">
              {formatMessage({ id: "public.cookies.cardClaim", defaultMessage: "Claim" })}
            </dt>
            <dd className="text-right font-medium text-text-strong-950">{claimLabel}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t border-stroke-soft-200 pt-3">
            <dt className="text-text-soft-400">
              {formatMessage({ id: "public.cookies.cardStatus", defaultMessage: "Status" })}
            </dt>
            <dd className="text-right font-medium text-text-strong-950">{statusLabel}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={() => onOpen(campaign)}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-primary-action px-4 py-2.5 text-sm font-semibold text-primary-action-foreground transition hover:bg-primary-action-hover"
          aria-label={formatMessage(
            { id: "public.cookies.openJarLabel", defaultMessage: "Open {title}" },
            { title }
          )}
        >
          {formatMessage({ id: "public.cookies.openJar", defaultMessage: "Open jar" })}
        </button>
      </div>
    </article>
  );
}

function CampaignCookieJarGrid({
  campaigns,
  isLoading,
  registryError,
  onOpen,
}: {
  campaigns: readonly CampaignCookieJarCampaign[];
  isLoading: boolean;
  registryError: Error | null;
  onOpen: (campaign: CampaignCookieJarCampaign) => void;
}) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 shadow-sm"
          >
            <div className="h-3 w-24 animate-pulse rounded bg-bg-soft-200" />
            <div className="mt-4 h-8 w-3/4 animate-pulse rounded bg-bg-soft-200" />
            <div className="mt-8 space-y-4">
              <div className="h-4 animate-pulse rounded bg-bg-weak-50" />
              <div className="h-4 animate-pulse rounded bg-bg-weak-50" />
              <div className="h-4 animate-pulse rounded bg-bg-weak-50" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stroke-soft-200 bg-bg-white-0 p-8 text-sm text-text-sub-600">
        {registryError
          ? formatMessage({
              id: "public.cookies.registryLoadFailed",
              defaultMessage:
                "The campaign jar list could not be loaded. Direct jar links still work.",
            })
          : formatMessage({
              id: "public.cookies.emptyList",
              defaultMessage:
                "Campaign jars will appear here once the Green Goods team configures them.",
            })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {campaigns.map((campaign) => (
        <CampaignCookieJarCard key={campaign.address} campaign={campaign} onOpen={onOpen} />
      ))}
    </div>
  );
}

function CampaignCookieJarDialog({
  jarAddress,
  title,
  onClose,
}: {
  jarAddress: Address;
  title: string;
  onClose: () => void;
}) {
  const { formatMessage } = useIntl();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;
      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((element) => element.offsetParent !== null);
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    const previousOverflow = document.body.style.overflow;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-dialog-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-static-black/50"
        onClick={onClose}
        aria-label={formatMessage({
          id: "public.cookies.closeDialog",
          defaultMessage: "Close jar dialog",
        })}
      />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="absolute inset-x-3 top-6 bottom-6 mx-auto flex max-w-6xl flex-col overflow-hidden bg-bg-weak-50 shadow-[var(--shadow-editorial-panel)] focus:outline-none sm:inset-x-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-stroke-soft-200 bg-bg-white-0 px-4 py-3 sm:px-5">
          <h2 id="cookie-dialog-title" className="font-serif text-xl text-text-strong-950">
            {title}
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-stroke-soft-200 text-text-sub-600 transition hover:text-text-strong-950"
            aria-label={formatMessage({
              id: "public.cookies.closeDialog",
              defaultMessage: "Close jar dialog",
            })}
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <CampaignCookieJarPanel jarAddress={jarAddress} />
        </div>
      </div>
    </div>
  );
}

function CookiesCampaignSurface() {
  const { formatMessage } = useIntl();
  const [searchParams, setSearchParams] = useSearchParams();
  const { ref: statsRef, revealed: statsRevealed } = useInViewReveal<HTMLElement>();
  const {
    campaigns,
    isLoading: isCampaignListLoading,
    error: campaignListError,
  } = useCampaignCookieJarCampaigns();
  const { jarAddress, campaignSlug, invalidJar, campaign } = useMemo(
    () => resolveCampaignJar(searchParams, campaigns),
    [campaigns, searchParams]
  );

  // Lightweight registry-level proxy for "active this season" — campaigns
  // whose metadata loaded and is marked valid. Per-jar paused/cooldown state
  // requires N hook calls (`useCampaignCookieJar`) and is deferred to a
  // follow-up that can aggregate cleanly without per-card duplication.
  const activeThisSeasonCount = useMemo(
    () => campaigns.filter((entry) => entry.metadata?.isValidCampaign === true).length,
    [campaigns]
  );

  const openCampaign = useCallback(
    (nextCampaign: CampaignCookieJarCampaign) => {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("jar");
      nextParams.set("campaign", nextCampaign.slug);
      setSearchParams(nextParams);
    },
    [searchParams, setSearchParams]
  );

  const closeDialog = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("jar");
    nextParams.delete("campaign");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const dialogTitle =
    campaign?.title ??
    campaign?.label ??
    formatMessage({
      id: "public.cookies.directJar",
      defaultMessage: "Direct jar",
    });

  return (
    <>
      <section
        ref={statsRef}
        data-revealed={statsRevealed}
        className="editorial-section-reveal mx-auto max-w-7xl px-6 sm:px-10"
        aria-label={formatMessage({
          id: "public.cookies.statsLabel",
          defaultMessage: "Cookie jar stats",
        })}
      >
        <div className="editorial-cascade grid border-b border-stroke-soft-200 bg-bg-weak-50 sm:grid-cols-3">
          <CookieIndexStat
            label={formatMessage({
              id: "public.cookies.stats.configured",
              defaultMessage: "Configured jars",
            })}
            value={String(campaigns.length)}
          />
          <CookieIndexStat
            label={formatMessage({
              id: "public.cookies.stats.activeThisSeason",
              defaultMessage: "Active this season",
            })}
            value={String(activeThisSeasonCount)}
          />
          <CookieIndexStat
            label={formatMessage({
              id: "public.cookies.stats.access",
              defaultMessage: "Access model",
            })}
            value={formatMessage({
              id: "public.cookies.stats.accessValue",
              defaultMessage: "Garden operators",
            })}
          />
        </div>
      </section>

      <main className="mx-auto max-w-7xl px-6 py-10 sm:px-10 sm:py-14">
        {invalidJar ? (
          <div className="mb-6 rounded-lg border border-error-light bg-error-lighter p-5 text-sm text-error-dark">
            {formatMessage(
              {
                id: "public.cookies.invalidJar",
                defaultMessage: '"{jar}" is not a valid jar address.',
              },
              { jar: invalidJar }
            )}
          </div>
        ) : campaignSlug && !jarAddress && !isCampaignListLoading ? (
          <div className="mb-6 rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 text-sm text-text-sub-600">
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

        <div className="mb-6 flex flex-col gap-3 border-b border-stroke-soft-200 pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-serif text-3xl text-text-strong-950">
              {formatMessage({
                id: "public.cookies.browseTitle",
                defaultMessage: "Open a jar",
              })}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-text-sub-600 md:text-base">
              {formatMessage({
                id: "public.cookies.browseDescription",
                defaultMessage:
                  "Choose a campaign below. The claim and deposit tools open here, so the page stays easy to share.",
              })}
            </p>
          </div>
        </div>

        {/* Reserve a stable height so the empty / single-campaign state does
            not collapse the page and shift the footer up. */}
        <div className="min-h-[60vh]">
          <CampaignCookieJarGrid
            campaigns={campaigns}
            isLoading={isCampaignListLoading}
            registryError={campaignListError}
            onOpen={openCampaign}
          />
        </div>
        {jarAddress ? (
          <CampaignCookieJarDialog
            jarAddress={jarAddress}
            title={dialogTitle}
            onClose={closeDialog}
          />
        ) : null}
      </main>
    </>
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
            defaultMessage: "Shared <accent>jars</accent> for campaign funds.",
          },
          {
            accent: (chunks) => <EditorialTitleAccent>{chunks}</EditorialTitleAccent>,
          }
        )}
        lede={formatMessage({
          id: "public.cookies.description",
          defaultMessage:
            "Shared jars hold campaign funds in one place. Operators from selected Gardens claim their share; supporters top up the jar for the next round.",
        })}
      />

      <div className="bg-bg-weak-50 pt-32 pb-16 sm:pt-36 sm:pb-20 md:pt-40">
        <Suspense fallback={null}>
          <WalletRuntimeProviders>
            <CookiesCampaignSurface />
          </WalletRuntimeProviders>
        </Suspense>
      </div>

      <PublicFooter variant="soil" />
    </>
  );
}
