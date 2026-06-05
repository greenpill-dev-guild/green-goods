import {
  type Address,
  Alert,
  cn,
  formatTokenAmount,
  getOctantVaultCardWalletOwners,
  type OctantVaultPosition,
  truncateAddress,
  useAuth,
  useOctantVaultPositions,
  useOctantVaultWithdraw,
  useTxErrorMessages,
  useUser,
  validateDecimalInput,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { lazy, Suspense, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import { EditorialGhostButton } from "./atoms";

/** Card-wallet management nests a ThirdwebProvider + BuyWidget-class deps; keep it
 * out of the main chunk and only load it when a card position actually exists. */
const VaultCardWalletManage = lazy(() => import("./VaultCardWalletManage"));

type ManageTab = "connected" | "card";

export interface VaultManagePositionsPanelProps {
  open: boolean;
  onClose: () => void;
  /** Endow CTA target — closes the panel and returns to browse. */
  onEndow?: () => void;
}

/**
 * Route-local management for Octant V2 vault positions, opened from
 * `/vaults?manage=positions`. Desktop renders a right-edge side sheet; mobile a
 * bottom sheet (the `PublicEndowmentPanel` treatment). It supports two owner
 * sources — the connected wallet and card/recovered email wallets — shown as
 * separate sections so a supporter who used both can see each. Browse stays
 * wallet-runtime-free: the AppKit runtime mounts only while this panel is open.
 */
export function VaultManagePositionsPanel({
  open,
  onClose,
  onEndow,
}: VaultManagePositionsPanelProps) {
  if (!open) return null;
  return (
    <WalletRuntimeProviders>
      <VaultManagePositionsContent open={open} onClose={onClose} onEndow={onEndow} />
    </WalletRuntimeProviders>
  );
}

function VaultManagePositionsContent({ open, onClose, onEndow }: VaultManagePositionsPanelProps) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const connectedAddress = authMode === "wallet" ? (primaryAddress as Address | null) : null;
  // Snapshot cached card owners once per open so withdraw-driven refetches don't
  // reshuffle sections mid-interaction.
  const cardOwners = useMemo(() => getOctantVaultCardWalletOwners(), []);
  const hasCardOwners = cardOwners.length > 0;
  const [tab, setTab] = useState<ManageTab>("connected");
  const activeTab: ManageTab = hasCardOwners ? tab : "connected";

  return (
    <Dialog.Root open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-overlay bg-static-black/40" />
        <Dialog.Content
          data-component="VaultManagePositionsPanel"
          data-testid="vault-manage-positions-panel"
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
                  id: "public.vaults.manage.kicker",
                  defaultMessage: "Vault positions",
                })}
              </p>
              <Dialog.Title className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950 md:text-3xl">
                {formatMessage({
                  id: "public.vaults.manage.title",
                  defaultMessage: "Manage vault positions",
                })}
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.manage.lede",
                  defaultMessage: "View and withdraw your WETH-backed Octant vault positions.",
                })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                aria-label={formatMessage({
                  id: "public.vaults.manage.close",
                  defaultMessage: "Close vault positions",
                })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </header>

          {hasCardOwners ? (
            <div
              role="tablist"
              aria-label={formatMessage({
                id: "public.vaults.manage.tablistLabel",
                defaultMessage: "Owner sources",
              })}
              className="flex shrink-0 gap-1 border-b border-stroke-soft-200 bg-bg-white-0 px-5 sm:px-6"
            >
              <ManageTabButton
                active={activeTab === "connected"}
                onClick={() => setTab("connected")}
                label={formatMessage({
                  id: "public.vaults.manage.tab.connected",
                  defaultMessage: "Connected wallet",
                })}
              />
              <ManageTabButton
                active={activeTab === "card"}
                onClick={() => setTab("card")}
                label={formatMessage({
                  id: "public.vaults.manage.tab.card",
                  defaultMessage: "Card wallet",
                })}
              />
            </div>
          ) : null}

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {activeTab === "connected" ? (
              <ConnectedWalletSection address={connectedAddress} onEndow={onEndow} />
            ) : (
              <Suspense fallback={<PositionsSkeleton />}>
                <VaultCardWalletManage owners={cardOwners} onEndow={onEndow} />
              </Suspense>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function ManageTabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "-mb-px border-b-2 px-1 py-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action",
        active
          ? "border-primary-action text-text-strong-950"
          : "border-transparent text-text-soft-400 hover:text-text-sub-600"
      )}
    >
      {label}
    </button>
  );
}

function ConnectedWalletSection({
  address,
  onEndow,
}: {
  address: Address | null;
  onEndow?: () => void;
}) {
  const { formatMessage } = useIntl();
  const { loginWithWallet } = useAuth();
  const positions = useOctantVaultPositions(address, { enabled: Boolean(address) });

  if (!address) {
    return (
      <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h3 className="font-serif text-xl font-normal text-text-strong-950">
          {formatMessage({
            id: "public.vaults.manage.connected.connectTitle",
            defaultMessage: "Connect to see your positions",
          })}
        </h3>
        <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.connected.connectBody",
            defaultMessage:
              "This view only uses your connected wallet. It never adds your address to the URL.",
          })}
        </p>
        <EditorialGhostButton
          variant="warm"
          className="mt-5 w-full px-5 py-2.5 text-sm"
          onClick={() => loginWithWallet()}
        >
          {formatMessage({
            id: "public.vaults.manage.connected.connectCta",
            defaultMessage: "Connect Wallet",
          })}
        </EditorialGhostButton>
      </div>
    );
  }

  return (
    <PositionsList
      positions={positions}
      ownerLabel={truncateAddress(address)}
      emptyTitle={formatMessage({
        id: "public.vaults.manage.empty.connected.title",
        defaultMessage: "No vault positions for this wallet yet",
      })}
      onEndow={onEndow}
      renderRow={(position) => (
        <ConnectedVaultPositionRow
          key={`${position.vaultAddress}:${position.chainId}`}
          position={position}
          owner={address}
          onRefresh={positions.refetch}
        />
      )}
    />
  );
}

/**
 * Shared list shell: loading skeleton, error/retry, empty state (which points back
 * to Endow), and the owner address strip. Row rendering is injected so the
 * connected (transaction-sender) and card (Thirdweb) paths share this scaffolding.
 */
export function PositionsList({
  positions,
  ownerLabel,
  emptyTitle,
  onEndow,
  renderRow,
  beforeList,
}: {
  positions: ReturnType<typeof useOctantVaultPositions>;
  ownerLabel: string;
  emptyTitle: string;
  onEndow?: () => void;
  renderRow: (position: OctantVaultPosition) => React.ReactNode;
  beforeList?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();

  if (positions.isLoading) return <PositionsSkeleton />;

  if (positions.isError) {
    return (
      <Alert
        variant="error"
        className="rounded-2xl bg-error-lighter/30 p-5"
        title={formatMessage({
          id: "public.vaults.manage.error.title",
          defaultMessage: "We couldn't load these positions",
        })}
      >
        <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.error.body",
            defaultMessage: "Refresh and try again.",
          })}
        </p>
        <EditorialGhostButton
          className="mt-5 px-5 py-2.5 text-sm"
          onClick={() => void positions.refetch()}
        >
          {formatMessage({ id: "public.vaults.manage.error.retry", defaultMessage: "Refresh" })}
        </EditorialGhostButton>
      </Alert>
    );
  }

  if (!positions.hasPositions) {
    return (
      <div className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-5">
        {beforeList}
        <h3 className="font-serif text-xl font-normal text-text-strong-950">{emptyTitle}</h3>
        <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.empty.body",
            defaultMessage:
              "When you endow a campaign on /vaults, your position appears here so you can manage it.",
          })}
        </p>
        {onEndow ? (
          <EditorialGhostButton
            variant="warm"
            className="mt-5 w-full px-5 py-2.5 text-sm"
            onClick={onEndow}
          >
            {formatMessage({
              id: "public.vaults.manage.empty.cta",
              defaultMessage: "Endow a campaign",
            })}
          </EditorialGhostButton>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {beforeList}
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
        {ownerLabel}
      </p>
      <div className="space-y-4">{positions.positions.map(renderRow)}</div>
    </div>
  );
}

export function PositionsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-2xl bg-bg-white-0" />
      <div className="h-28 animate-pulse rounded-2xl bg-bg-white-0" />
    </div>
  );
}

/** Connected-wallet row: withdraws through the chain-aware transaction sender. */
function ConnectedVaultPositionRow({
  position,
  owner,
  onRefresh,
}: {
  position: OctantVaultPosition;
  owner: Address;
  onRefresh: () => Promise<unknown>;
}) {
  const { formatMessage } = useIntl();
  const withdraw = useOctantVaultWithdraw({ errorMode: "inline" });
  const txError = useTxErrorMessages(withdraw.error);

  return (
    <VaultPositionRowView
      position={position}
      destinationLabel={formatMessage({
        id: "public.vaults.manage.withdraw.destinationWallet",
        defaultMessage: "your connected wallet",
      })}
      isWithdrawing={withdraw.isPending}
      errorNode={
        withdraw.error ? (
          <Alert
            variant="error"
            className="mt-4 rounded-2xl bg-error-lighter/30 p-3"
            title={txError.title}
          >
            <p className="mt-1 text-xs leading-[1.5] text-text-sub-600">{txError.message}</p>
          </Alert>
        ) : null
      }
      onWithdraw={async (amount) => {
        await withdraw.mutateAsync({
          chainId: position.chainId,
          vaultAddress: position.vaultAddress,
          amount,
          owner,
        });
        await onRefresh();
      }}
      onResetError={withdraw.reset}
    />
  );
}

/**
 * Presentational withdraw row shared by both owner sources. Default view shows
 * campaign, position value, shares, and withdrawable; technical details (vault,
 * token, chain, raw shares, explorer) live behind a disclosure. Withdraw is a
 * collapsed control that expands to amount → review → confirm; the actual signing
 * is injected via `onWithdraw`.
 */
export function VaultPositionRowView({
  position,
  destinationLabel,
  isWithdrawing,
  errorNode,
  onWithdraw,
  onResetError,
  disabledReason,
}: {
  position: OctantVaultPosition;
  destinationLabel: string;
  isWithdrawing: boolean;
  errorNode?: React.ReactNode;
  onWithdraw: (amount: bigint) => Promise<void>;
  onResetError?: () => void;
  /** When set, the withdraw control is replaced by this node (e.g. restore session). */
  disabledReason?: React.ReactNode;
}) {
  const { formatMessage } = useIntl();
  const amountInputId = useId();
  const feedbackId = `${amountInputId}-feedback`;
  const regionId = `${amountInputId}-region`;
  const [expanded, setExpanded] = useState(false);
  const [amountInput, setAmountInput] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const decimals = position.assetDecimals;
  const symbol = position.assetSymbol;

  const inputError = useMemo(
    () => validateDecimalInput(amountInput, decimals),
    [amountInput, decimals]
  );
  const parsedAmount = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(amountInput, decimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, decimals]);

  const display = (value: bigint) =>
    `${formatTokenAmount(value, decimals, 4, undefined, true)} ${symbol}`;
  const withdrawable = position.withdrawable;
  const exceedsAvailable = parsedAmount > 0n && withdrawable > 0n && parsedAmount > withdrawable;
  const disableConfirm =
    isWithdrawing ||
    Boolean(inputError) ||
    parsedAmount <= 0n ||
    withdrawable <= 0n ||
    exceedsAvailable;

  const resetInput = () => {
    setAmountInput("");
    setShowConfirm(false);
    setSuccessMessage("");
    onResetError?.();
  };

  const executeWithdraw = async () => {
    if (disableConfirm) return;
    const amountLabel = display(parsedAmount);
    try {
      await onWithdraw(parsedAmount);
      setAmountInput("");
      setShowConfirm(false);
      setSuccessMessage(
        formatMessage(
          {
            id: "public.vaults.manage.withdraw.success",
            defaultMessage: "{amount} withdrawn. Balances may take a moment to update.",
          },
          { amount: amountLabel }
        )
      );
    } catch {
      // Error surfaces through errorNode; keep the entered amount for retry.
    }
  };

  return (
    <article
      className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-testid={`vault-manage-position-${position.campaignSlug}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p
            className="truncate font-serif text-lg font-normal text-text-strong-950"
            title={position.displayName}
          >
            {position.displayName}
          </p>
          <p className="mt-0.5 text-xs text-text-soft-400">
            {formatMessage({
              id: "public.vaults.manage.position.backed",
              defaultMessage: "WETH-backed vault position",
            })}
          </p>
          <dl className="mt-3 space-y-1 text-xs leading-[1.55] text-text-soft-400">
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.value",
                  defaultMessage: "Position value in WETH",
                })}
                {": "}
              </dt>
              <dd className="inline font-semibold text-text-strong-950">
                {display(position.positionValue)}
              </dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.shares",
                  defaultMessage: "Shares",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">{formatTokenAmount(position.shares, 18)}</dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.withdrawable",
                  defaultMessage: "Withdrawable now",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">{display(withdrawable)}</dd>
            </div>
          </dl>
        </div>
        {disabledReason ? null : (
          <EditorialGhostButton
            className="shrink-0 px-4 py-2 text-xs"
            aria-expanded={expanded}
            aria-controls={expanded ? regionId : undefined}
            onClick={() => {
              setExpanded((current) => !current);
              setSuccessMessage("");
            }}
          >
            {formatMessage({
              id: "public.vaults.manage.position.withdraw",
              defaultMessage: "Withdraw",
            })}
          </EditorialGhostButton>
        )}
      </div>

      <details className="mt-3 border-t border-stroke-soft-200 pt-3">
        <summary className="cursor-pointer font-mono text-[10.5px] uppercase tracking-[0.16em] text-text-soft-400">
          {formatMessage({
            id: "public.vaults.manage.position.technical",
            defaultMessage: "Technical details",
          })}
        </summary>
        <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.vault",
                defaultMessage: "Octant vault",
              })}
            </dt>
            <dd className="break-all font-mono text-text-sub-600">{position.vaultAddress}</dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.token",
                defaultMessage: "WETH token",
              })}
            </dt>
            <dd className="break-all font-mono text-text-sub-600">
              {position.assetSymbol} · {position.assetAddress}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.chain",
                defaultMessage: "Network",
              })}
            </dt>
            <dd className="text-text-sub-600">
              {formatMessage(
                {
                  id: "public.vaults.manage.position.tech.chainValue",
                  defaultMessage: "Ethereum chain {chainId}",
                },
                { chainId: position.chainId }
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.shares",
                defaultMessage: "Raw shares",
              })}
            </dt>
            <dd className="break-all font-mono text-text-sub-600">{position.shares.toString()}</dd>
          </div>
        </dl>
        {position.explorerLink ? (
          <a
            href={position.explorerLink}
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-xs font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
          >
            {formatMessage({
              id: "public.vaults.manage.position.tech.explorer",
              defaultMessage: "View vault on explorer",
            })}
          </a>
        ) : null}
      </details>

      {disabledReason ? <div className="mt-3">{disabledReason}</div> : null}

      {expanded && !disabledReason ? (
        <div
          id={regionId}
          className="mt-4 rounded-2xl border border-stroke-soft-200 bg-bg-weak-50 p-4"
        >
          <label
            htmlFor={amountInputId}
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.manage.withdraw.amount",
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
                onResetError?.();
              }}
              placeholder={`0.0 ${symbol}`}
              aria-invalid={Boolean(inputError || exceedsAvailable)}
              aria-describedby={feedbackId}
              className={cn(
                "min-h-11 w-full rounded-full border bg-bg-white-0 px-4 py-2.5 text-sm text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action",
                inputError || exceedsAvailable ? "border-error-base" : "border-stroke-soft-200"
              )}
            />
            <button
              type="button"
              onClick={() => {
                setAmountInput(formatUnits(withdrawable, decimals));
                setShowConfirm(false);
                setSuccessMessage("");
                onResetError?.();
              }}
              disabled={withdrawable <= 0n}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2.5 text-xs font-medium text-text-sub-600 transition-colors hover:bg-bg-weak-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formatMessage({ id: "public.vaults.manage.withdraw.max", defaultMessage: "Max" })}
            </button>
          </div>

          {inputError ? (
            <p id={feedbackId} className="mt-2 text-xs text-error-dark" role="alert">
              {formatMessage({ id: inputError })}
            </p>
          ) : exceedsAvailable ? (
            <p id={feedbackId} className="mt-2 text-xs text-error-dark" role="alert">
              {formatMessage({
                id: "public.vaults.manage.withdraw.exceeds",
                defaultMessage: "Amount is higher than the withdrawable amount.",
              })}
            </p>
          ) : (
            <p id={feedbackId} className="mt-2 text-xs text-text-soft-400">
              {formatMessage(
                {
                  id: "public.vaults.manage.withdraw.available",
                  defaultMessage: "Available now: {amount}",
                },
                { amount: display(withdrawable) }
              )}
            </p>
          )}

          {showConfirm ? (
            <div className="mt-4 rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4">
              <p className="font-serif text-lg font-normal text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.manage.withdraw.confirmTitle",
                  defaultMessage: "Confirm withdrawal",
                })}
              </p>
              <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.vaults.manage.withdraw.confirmBody",
                    defaultMessage: "Return {amount} to {destination}?",
                  },
                  { amount: display(parsedAmount), destination: destinationLabel }
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <EditorialGhostButton
                  variant="warm"
                  className="px-5 py-2.5 text-sm"
                  disabled={disableConfirm}
                  onClick={() => void executeWithdraw()}
                >
                  {isWithdrawing
                    ? formatMessage({
                        id: "public.vaults.manage.withdraw.pending",
                        defaultMessage: "Withdrawing…",
                      })
                    : formatMessage({
                        id: "public.vaults.manage.withdraw.confirm",
                        defaultMessage: "Confirm",
                      })}
                </EditorialGhostButton>
                <EditorialGhostButton
                  className="px-5 py-2.5 text-sm"
                  disabled={isWithdrawing}
                  onClick={() => setShowConfirm(false)}
                >
                  {formatMessage({
                    id: "public.vaults.manage.withdraw.cancel",
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
                id: "public.vaults.manage.withdraw.review",
                defaultMessage: "Review withdrawal",
              })}
            </EditorialGhostButton>
          )}

          {errorNode}

          {successMessage ? (
            <Alert variant="success" className="mt-4 rounded-2xl bg-success-lighter/30 p-3">
              {successMessage}
            </Alert>
          ) : null}

          <button
            type="button"
            onClick={resetInput}
            className="mt-3 text-xs font-medium text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
          >
            {formatMessage({
              id: "public.vaults.manage.withdraw.refresh",
              defaultMessage: "Reset",
            })}
          </button>
        </div>
      ) : null}
    </article>
  );
}
