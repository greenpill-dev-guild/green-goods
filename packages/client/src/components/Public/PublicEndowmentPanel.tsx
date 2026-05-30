import * as Dialog from "@radix-ui/react-dialog";
import {
  type Address,
  Alert,
  cn,
  DEFAULT_WITHDRAW_MAX_LOSS_BPS,
  formatTokenAmount,
  type PublicEndowmentAssetTotal,
  type PublicEndowmentGardenGroup,
  type PublicEndowmentPosition,
  truncateAddress,
  useAuth,
  useDebouncedValue,
  usePublicEndowmentPositions,
  useTxErrorMessages,
  useUser,
  useVaultPreview,
  useVaultWithdraw,
  validateDecimalInput,
} from "@green-goods/shared";
import { RiCloseLine } from "@remixicon/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import { EditorialGhostButton } from "./atoms";

export interface PublicEndowmentPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDisplayAmount(value: bigint, decimals: number, symbol: string): string {
  return `${formatTokenAmount(value, decimals, 4, undefined, true)} ${symbol}`;
}

export function PublicEndowmentPanel({ open, onOpenChange }: PublicEndowmentPanelProps) {
  const { formatMessage } = useIntl();
  const { primaryAddress } = useUser();
  // Connect via wallet auth (stores "wallet" intent so the auth machine logs in
  // and primaryAddress resolves) rather than only opening the AppKit modal —
  // otherwise endowment positions stay unreachable for a freshly-connected
  // public wallet (shared root cause with PRD-497).
  const { loginWithWallet } = useAuth();
  const portfolio = usePublicEndowmentPositions(primaryAddress as Address | undefined, {
    enabled: open && Boolean(primaryAddress),
  });

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-static-black/40" />
        <Dialog.Content
          data-component="PublicEndowmentPanel"
          className={cn(
            "fixed z-modal flex max-h-[86vh] w-full flex-col overflow-hidden border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 shadow-[var(--shadow-editorial-panel)] focus:outline-none",
            "inset-x-0 bottom-0 rounded-t-3xl",
            "sm:inset-x-auto sm:inset-y-4 sm:right-4 sm:max-h-[calc(100vh-2rem)] sm:w-[min(34rem,calc(100vw-2rem))] sm:rounded-3xl"
          )}
        >
          <header className="flex items-start justify-between gap-4 border-b border-stroke-soft-200 bg-bg-white-0 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {formatMessage({
                  id: "public.fund.endowments.kicker",
                  defaultMessage: "Account view",
                })}
              </p>
              <Dialog.Title className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950 md:text-3xl">
                {formatMessage({
                  id: "public.fund.endowments.title",
                  defaultMessage: "Your Endowments",
                })}
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                {primaryAddress
                  ? formatMessage(
                      {
                        id: "public.fund.endowments.wallet",
                        defaultMessage: "Connected wallet {address}",
                      },
                      { address: truncateAddress(primaryAddress) }
                    )
                  : formatMessage({
                      id: "public.fund.endowments.connect.lede",
                      defaultMessage:
                        "Connect the wallet you used to endow Gardens and review what you have supported.",
                    })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                aria-label={formatMessage({
                  id: "public.fund.endowments.close",
                  defaultMessage: "Close endowments",
                })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {!primaryAddress ? (
              <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
                <h3 className="font-serif text-xl font-normal text-text-strong-950">
                  {formatMessage({
                    id: "public.fund.endowments.connect.title",
                    defaultMessage: "Connect to see your endowments",
                  })}
                </h3>
                <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.fund.endowments.connect.body",
                    defaultMessage:
                      "This view only uses your connected wallet. It does not expose receipt tokens or add account details to the URL.",
                  })}
                </p>
                <EditorialGhostButton
                  variant="warm"
                  className="mt-5 w-full px-5 py-2.5 text-sm"
                  onClick={() => loginWithWallet()}
                >
                  {formatMessage({
                    id: "public.fund.endowments.connect.cta",
                    defaultMessage: "Connect Wallet",
                  })}
                </EditorialGhostButton>
              </div>
            ) : portfolio.isLoading ? (
              <div className="space-y-4" aria-hidden="true">
                <div className="h-24 animate-pulse rounded-2xl bg-bg-white-0" />
                <div className="h-32 animate-pulse rounded-2xl bg-bg-white-0" />
                <div className="h-32 animate-pulse rounded-2xl bg-bg-white-0" />
              </div>
            ) : portfolio.isError ? (
              <Alert
                variant="error"
                className="rounded-2xl bg-error-lighter/30 p-5"
                title={formatMessage({
                  id: "public.fund.endowments.error.title",
                  defaultMessage: "We could not load these endowments",
                })}
              >
                <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.fund.endowments.error.body",
                    defaultMessage: "Refresh the account view and try again.",
                  })}
                </p>
                <EditorialGhostButton
                  className="mt-5 px-5 py-2.5 text-sm"
                  onClick={() => void portfolio.refetch()}
                >
                  {formatMessage({
                    id: "public.fund.endowments.error.retry",
                    defaultMessage: "Refresh",
                  })}
                </EditorialGhostButton>
              </Alert>
            ) : !portfolio.hasPositions ? (
              <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
                <h3 className="font-serif text-xl font-normal text-text-strong-950">
                  {formatMessage({
                    id: "public.fund.endowments.empty.title",
                    defaultMessage: "No endowments for this wallet yet",
                  })}
                </h3>
                <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                  {formatMessage({
                    id: "public.fund.endowments.empty.body",
                    defaultMessage:
                      "When this wallet endows a Garden, those positions will appear here grouped by Garden.",
                  })}
                </p>
              </div>
            ) : (
              <EndowmentPortfolio
                gardenGroups={portfolio.gardenGroups}
                assetTotals={portfolio.assetTotals}
                gardenCount={portfolio.gardenCount}
                ownerAddress={primaryAddress as Address}
                onRefresh={portfolio.refetch}
              />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface EndowmentPortfolioProps {
  gardenGroups: PublicEndowmentGardenGroup[];
  assetTotals: PublicEndowmentAssetTotal[];
  gardenCount: number;
  ownerAddress: Address;
  onRefresh: () => Promise<void>;
}

function EndowmentPortfolio({
  gardenGroups,
  assetTotals,
  gardenCount,
  ownerAddress,
  onRefresh,
}: EndowmentPortfolioProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
          {formatMessage({
            id: "public.fund.endowments.summary.kicker",
            defaultMessage: "What you've supported",
          })}
        </p>
        <dl className="mt-4 grid gap-3">
          {assetTotals.map((total) => (
            <div
              key={`${total.chainId}:${total.asset}`}
              className="flex items-baseline justify-between gap-4 border-b border-stroke-soft-200 pb-3 last:border-b-0 last:pb-0"
            >
              <dt className="min-w-0 text-sm text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.fund.endowments.summary.totalEndowed",
                    defaultMessage: "Total endowed in {asset}",
                  },
                  { asset: total.assetSymbol }
                )}
              </dt>
              <dd className="shrink-0 text-right font-serif text-xl font-normal tabular-nums text-text-strong-950">
                {formatDisplayAmount(total.totalEndowed, total.decimals, total.assetSymbol)}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4">
            <dt className="min-w-0 text-sm text-text-sub-600">
              {formatMessage({
                id: "public.fund.endowments.summary.gardensSupported",
                defaultMessage: "Gardens supported",
              })}
            </dt>
            <dd className="shrink-0 text-right font-serif text-xl font-normal tabular-nums text-text-strong-950">
              {formatMessage(
                {
                  id: "public.fund.endowments.summary.gardenCount",
                  defaultMessage: "{count, plural, one {# Garden} other {# Gardens}}",
                },
                { count: gardenCount }
              )}
            </dd>
          </div>
        </dl>
      </section>

      <div className="space-y-4">
        {gardenGroups.map((group) => (
          <GardenEndowmentGroup
            key={group.gardenAddress}
            group={group}
            ownerAddress={ownerAddress}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </div>
  );
}

interface GardenEndowmentGroupProps {
  group: PublicEndowmentGardenGroup;
  ownerAddress: Address;
  onRefresh: () => Promise<void>;
}

function GardenEndowmentGroup({ group, ownerAddress, onRefresh }: GardenEndowmentGroupProps) {
  const { formatMessage } = useIntl();

  return (
    <section className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4">
      <div className="border-b border-stroke-soft-200 pb-3">
        <h3 className="font-serif text-xl font-normal leading-tight text-text-strong-950">
          {group.gardenName}
        </h3>
        {group.gardenLocation ? (
          <p className="mt-1 text-xs text-text-soft-400">{group.gardenLocation}</p>
        ) : null}
        {!group.hasGardenMetadata ? (
          <p className="mt-2 text-xs text-text-soft-400">
            {formatMessage({
              id: "public.fund.endowments.metadataUnavailable",
              defaultMessage: "Garden metadata is still syncing.",
            })}
          </p>
        ) : null}
      </div>
      <div className="divide-y divide-stroke-soft-200">
        {group.positions.map((position) => (
          <EndowmentAssetRow
            key={position.id}
            position={position}
            ownerAddress={ownerAddress}
            onRefresh={onRefresh}
          />
        ))}
      </div>
    </section>
  );
}

interface EndowmentAssetRowProps {
  position: PublicEndowmentPosition;
  ownerAddress: Address;
  onRefresh: () => Promise<void>;
}

function EndowmentAssetRow({ position, ownerAddress, onRefresh }: EndowmentAssetRowProps) {
  const { formatMessage } = useIntl();
  const withdrawMutation = useVaultWithdraw({ errorMode: "inline" });
  const txError = useTxErrorMessages(withdrawMutation.error);
  const amountInputId = useId();
  const amountFeedbackId = `${amountInputId}-feedback`;
  const withdrawRegionId = `${amountInputId}-region`;
  const expandedRegionRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // When a row expands, the revealed amount input + Review/Confirm controls can
  // fall below the scroll fold of the panel body — most acutely for the last
  // position in a tall portfolio inside the mobile bottom sheet. Nudge the
  // freshly revealed region into the body's scroll viewport. `block: "nearest"`
  // keeps the scroll minimal and avoids a smooth animation (reduced-motion safe).
  useEffect(() => {
    if (expanded) {
      expandedRegionRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [expanded]);

  const inputError = useMemo(
    () => validateDecimalInput(amountInput, position.decimals),
    [amountInput, position.decimals]
  );

  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, position.decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, position.decimals]);

  const debouncedAmount = useDebouncedValue(parsedAmount, 300);
  const {
    preview,
    isFetching,
    isLoading: isPreviewLoading,
    refetch: refetchPreview,
  } = useVaultPreview({
    vaultAddress: position.vaultAddress,
    amount: debouncedAmount,
    userAddress: ownerAddress,
    chainId: position.chainId,
    maxLossBps: DEFAULT_WITHDRAW_MAX_LOSS_BPS,
    enabled: true,
  });

  const maxWithdrawable = preview?.maxWithdraw ?? 0n;
  const withdrawableLabel = preview
    ? formatDisplayAmount(maxWithdrawable, position.decimals, position.assetSymbol)
    : isPreviewLoading || isFetching
      ? formatMessage({
          id: "public.fund.endowments.position.refreshingAvailable",
          defaultMessage: "Refreshing…",
        })
      : formatMessage({
          id: "public.fund.endowments.position.availableUnavailable",
          defaultMessage: "Unavailable",
        });
  const exceedsAvailable =
    parsedAmount > 0n && maxWithdrawable > 0n && parsedAmount > maxWithdrawable;
  const disableConfirm =
    withdrawMutation.isPending ||
    Boolean(inputError) ||
    parsedAmount <= 0n ||
    maxWithdrawable <= 0n ||
    exceedsAvailable;

  const amountLabel = formatDisplayAmount(parsedAmount, position.decimals, position.assetSymbol);

  const executeWithdraw = () => {
    if (disableConfirm) return;
    withdrawMutation.mutate(
      {
        gardenAddress: position.gardenAddress,
        assetAddress: position.asset,
        vaultAddress: position.vaultAddress,
        amount: parsedAmount,
        owner: ownerAddress,
        receiver: ownerAddress,
        maxLossBps: DEFAULT_WITHDRAW_MAX_LOSS_BPS,
      },
      {
        onSuccess: async () => {
          setAmountInput("");
          setShowConfirm(false);
          setSuccessMessage(
            formatMessage(
              {
                id: "public.fund.endowments.withdraw.success",
                defaultMessage: "{amount} returned to your wallet.",
              },
              { amount: amountLabel }
            )
          );
          // Refresh the portfolio (deposits/vaults/gardens) and this row's
          // own withdraw preview together, so "Available if needed" reflects
          // the post-withdraw balance instead of a stale figure.
          await Promise.all([onRefresh(), refetchPreview()]);
        },
      }
    );
  };

  return (
    <article className="py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="truncate text-sm font-semibold text-text-strong-950"
            title={position.assetSymbol}
          >
            {position.assetSymbol}
          </p>
          <dl className="mt-2 space-y-1 text-xs leading-[1.55] text-text-soft-400">
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.fund.endowments.position.endowed",
                  defaultMessage: "Endowed",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">
                {formatDisplayAmount(
                  position.totalEndowed,
                  position.decimals,
                  position.assetSymbol
                )}
              </dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.fund.endowments.position.shares",
                  defaultMessage: "Shares",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">{formatTokenAmount(position.shares, 18)}</dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.fund.endowments.position.available",
                  defaultMessage: "Available if needed",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">{withdrawableLabel}</dd>
            </div>
          </dl>
        </div>
        <EditorialGhostButton
          className="shrink-0 px-4 py-2 text-xs"
          aria-expanded={expanded}
          aria-controls={expanded ? withdrawRegionId : undefined}
          onClick={() => {
            setExpanded((current) => !current);
            setSuccessMessage("");
          }}
        >
          {formatMessage({
            id: "public.fund.endowments.position.withdraw",
            defaultMessage: "Withdraw",
          })}
        </EditorialGhostButton>
      </div>

      {expanded ? (
        <div
          ref={expandedRegionRef}
          id={withdrawRegionId}
          className="mt-4 rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-4"
        >
          <label
            htmlFor={amountInputId}
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.fund.endowments.withdraw.amount",
              defaultMessage: "Withdrawal amount",
            })}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <input
              type="text"
              id={amountInputId}
              inputMode="decimal"
              autoComplete="off"
              value={amountInput}
              onChange={(event) => {
                setAmountInput(event.target.value);
                setShowConfirm(false);
                setSuccessMessage("");
                withdrawMutation.reset();
              }}
              placeholder={`0.0 ${position.assetSymbol}`}
              aria-invalid={Boolean(inputError || exceedsAvailable)}
              aria-describedby={amountFeedbackId}
              className={cn(
                "min-h-11 w-full rounded-full border bg-bg-white-0 px-4 py-2.5 text-sm text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action",
                inputError || exceedsAvailable ? "border-error-base" : "border-stroke-soft-200"
              )}
            />
            <button
              type="button"
              onClick={() => {
                setAmountInput(formatUnits(maxWithdrawable, position.decimals));
                setShowConfirm(false);
                setSuccessMessage("");
                withdrawMutation.reset();
              }}
              disabled={maxWithdrawable <= 0n || isFetching}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2.5 text-xs font-medium text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formatMessage({
                id: "public.fund.endowments.withdraw.max",
                defaultMessage: "Max",
              })}
            </button>
          </div>

          {inputError ? (
            <p id={amountFeedbackId} className="mt-2 text-xs text-error-dark" role="alert">
              {formatMessage({ id: inputError })}
            </p>
          ) : exceedsAvailable ? (
            <p id={amountFeedbackId} className="mt-2 text-xs text-error-dark" role="alert">
              {formatMessage({
                id: "public.fund.endowments.withdraw.exceedsAvailable",
                defaultMessage: "Amount is higher than the current withdrawable amount.",
              })}
            </p>
          ) : (
            <p id={amountFeedbackId} className="mt-2 text-xs text-text-soft-400">
              {formatMessage(
                {
                  id: "public.fund.endowments.withdraw.available",
                  defaultMessage: "Available now: {amount}",
                },
                {
                  amount: formatDisplayAmount(
                    maxWithdrawable,
                    position.decimals,
                    position.assetSymbol
                  ),
                }
              )}
            </p>
          )}

          {showConfirm ? (
            <div className="mt-4 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4">
              <p className="font-serif text-lg font-normal text-text-strong-950">
                {formatMessage({
                  id: "public.fund.endowments.withdraw.confirmTitle",
                  defaultMessage: "Confirm withdrawal",
                })}
              </p>
              <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.fund.endowments.withdraw.confirmBody",
                    defaultMessage: "Return {amount} to your connected wallet?",
                  },
                  { amount: amountLabel }
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <EditorialGhostButton
                  variant="warm"
                  className="px-5 py-2.5 text-sm"
                  disabled={disableConfirm}
                  onClick={executeWithdraw}
                >
                  {withdrawMutation.isPending
                    ? formatMessage({
                        id: "public.fund.endowments.withdraw.pending",
                        defaultMessage: "Withdrawing…",
                      })
                    : formatMessage({
                        id: "public.fund.endowments.withdraw.confirm",
                        defaultMessage: "Confirm",
                      })}
                </EditorialGhostButton>
                <EditorialGhostButton
                  className="px-5 py-2.5 text-sm"
                  disabled={withdrawMutation.isPending}
                  onClick={() => setShowConfirm(false)}
                >
                  {formatMessage({
                    id: "public.fund.endowments.withdraw.cancel",
                    defaultMessage: "Cancel",
                  })}
                </EditorialGhostButton>
              </div>
            </div>
          ) : (
            <EditorialGhostButton
              variant="warm"
              className="mt-4 w-full px-5 py-2.5 text-sm"
              disabled={disableConfirm}
              onClick={() => setShowConfirm(true)}
            >
              {formatMessage({
                id: "public.fund.endowments.withdraw.review",
                defaultMessage: "Review withdrawal",
              })}
            </EditorialGhostButton>
          )}

          {withdrawMutation.error ? (
            <Alert
              variant="error"
              className="mt-4 rounded-2xl bg-error-lighter/30 p-3"
              title={txError.title}
            >
              <p className="mt-1 text-xs leading-[1.5] text-text-sub-600">{txError.message}</p>
            </Alert>
          ) : null}

          {successMessage ? (
            <Alert variant="success" className="mt-4 rounded-2xl bg-success-lighter/30 p-3">
              {successMessage}
            </Alert>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
