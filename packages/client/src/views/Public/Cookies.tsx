import {
  type Address,
  Button,
  classifyTxError,
  formatTokenAmount,
  isMeaningfulTxErrorMessage,
  TxInlineFeedback,
  useAppKit,
  useCampaignCookieJar,
  useCampaignCookieJarDeposit,
  useCampaignCookieJarWithdraw,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useSearchParams } from "react-router-dom";
import { formatUnits, getAddress, isAddress, parseUnits } from "viem";
import { useBalance } from "wagmi";

const WalletRuntimeProviders = lazy(() => import("@/routes/WalletRuntimeProviders"));

type CookieMode = "claim" | "deposit";

function formatDisplayAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatTokenAmount(value, decimals, 4)} ${symbol}`;
}

function normalizeCampaignSlug(value: string): string {
  return value.trim().toLowerCase();
}

function readCampaignCookieJarAliases(): Record<string, Address | undefined> {
  const raw = (import.meta.env as Record<string, string | undefined>).VITE_CAMPAIGN_COOKIE_JARS;
  if (!raw?.trim()) return {};

  const aliases: Record<string, Address | undefined> = {};
  const addAlias = (slug: unknown, address: unknown) => {
    if (typeof slug !== "string" || typeof address !== "string" || !isAddress(address)) return;
    aliases[normalizeCampaignSlug(slug)] = getAddress(address) as Address;
  };

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    Object.entries(parsed).forEach(([slug, address]) => addAlias(slug, address));
    return aliases;
  } catch {
    raw.split(/[\n,]+/).forEach((entry) => {
      const [slug, address] = entry.split(/[=:]/).map((part) => part.trim());
      addAlias(slug, address);
    });
  }

  return aliases;
}

function resolveCampaignJar(searchParams: URLSearchParams): {
  jarAddress?: Address;
  campaignSlug?: string;
  invalidJar?: string;
} {
  const jar = searchParams.get("jar")?.trim();
  if (jar) {
    if (!isAddress(jar)) return { invalidJar: jar };
    return { jarAddress: getAddress(jar) as Address };
  }

  const campaignSlug = normalizeCampaignSlug(searchParams.get("campaign") ?? "");
  if (!campaignSlug) return {};
  return { jarAddress: readCampaignCookieJarAliases()[campaignSlug], campaignSlug };
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
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
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
      <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">{label}</p>
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

export default function CookiesPage() {
  const { formatMessage } = useIntl();
  const [searchParams] = useSearchParams();
  const { jarAddress, campaignSlug, invalidJar } = useMemo(
    () => resolveCampaignJar(searchParams),
    [searchParams]
  );

  return (
    <div className="min-h-screen bg-bg-weak-50">
      <div className="mx-auto max-w-6xl px-4 pt-12 pb-16 sm:px-6 sm:pt-16">
        <header className="max-w-3xl">
          <p className="text-xs font-medium uppercase tracking-wide text-text-soft-400">
            {formatMessage({
              id: "public.cookies.eyebrow",
              defaultMessage: "Campaign cookie jars",
            })}
          </p>
          <h1 className="mt-3 font-serif text-4xl text-text-strong-950 md:text-5xl">
            {formatMessage({
              id: "public.cookies.title",
              defaultMessage: "A shared jar for garden operators",
            })}
          </h1>
          <p className="mt-4 text-base leading-7 text-text-sub-600">
            {formatMessage({
              id: "public.cookies.description",
              defaultMessage:
                "Campaign funds land in one jar. Operators from selected gardens can claim their cookie, and supporters can top up the jar for the next round.",
            })}
          </p>
        </header>

        <div className="mt-8">
          {invalidJar ? (
            <div className="rounded-lg border border-error-light bg-error-lighter p-5 text-sm text-error-dark">
              {formatMessage(
                {
                  id: "public.cookies.invalidJar",
                  defaultMessage: '"{jar}" is not a valid jar address.',
                },
                { jar: invalidJar }
              )}
            </div>
          ) : jarAddress ? (
            <Suspense fallback={null}>
              <WalletRuntimeProviders>
                <CampaignCookieJarPanel jarAddress={jarAddress} />
              </WalletRuntimeProviders>
            </Suspense>
          ) : (
            <div className="rounded-lg border border-stroke-soft-200 bg-bg-white-0 p-6 text-sm text-text-sub-600">
              {formatMessage(
                {
                  id: campaignSlug ? "public.cookies.unknownCampaign" : "public.cookies.missingJar",
                  defaultMessage: campaignSlug
                    ? 'The "{campaign}" cookie jar is not configured yet. Use a direct jar link for now.'
                    : "Open this page with a jar link, like /cookies?jar=0x...",
                },
                { campaign: campaignSlug ?? "" }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
