import {
  type Address,
  Alert,
  cn,
  formatAddress,
  formatTokenAmount,
  type OctantVaultPosition,
  useAuth,
  useEnsName,
  useOctantVaultPositions,
  useOctantVaultRedeem,
  useTxErrorMessages,
  useUser,
  normalizeDecimalInput,
  validateDecimalInput,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine } from "@remixicon/react";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import { formatUnits, parseUnits } from "viem";
import WalletRuntimeProviders from "@/routes/WalletRuntimeProviders";
import { EditorialGhostButton } from "./atoms";
import {
  CheckoutTransactionDetails,
  getAddressExplorerUrl,
  getEthereumNetworkLabel,
} from "./vaultCheckoutShell";

export interface VaultManagePositionsPanelProps {
  open: boolean;
  onExitComplete?: () => void;
  onOpenChange: (open: boolean) => void;
  /** Endow CTA target — closes the panel and returns to browse. */
  onEndow?: () => void;
}

const EXIT_ANIMATION_BUFFER_MS = 50;
const EXIT_ANIMATION_FALLBACK_MS = 300;

function parseCssTimeToMs(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.endsWith("ms")) return Number.parseFloat(trimmed);
  if (trimmed.endsWith("s")) return Number.parseFloat(trimmed) * 1000;
  return null;
}

function parseCssTimeListToMs(value: string): number[] {
  return value
    .split(",")
    .map(parseCssTimeToMs)
    .filter((time): time is number => time !== null && Number.isFinite(time));
}

function getExitAnimationDurationMs(element: HTMLElement | null): number {
  if (typeof window === "undefined" || !element) return EXIT_ANIMATION_FALLBACK_MS;

  const styles = window.getComputedStyle(element);
  const durations = parseCssTimeListToMs(styles.animationDuration);
  const delays = parseCssTimeListToMs(styles.animationDelay);
  const totals = durations.map((duration, index) => {
    const delay = delays[index] ?? delays[delays.length - 1] ?? 0;
    return duration + delay;
  });
  const longestDuration = Math.max(...totals, 0);

  return longestDuration > 0 ? longestDuration : EXIT_ANIMATION_FALLBACK_MS;
}

/**
 * Route-local management for Octant V2 vault positions, opened from
 * `/vaults?manage=positions`. Desktop renders a right-edge side sheet; mobile a
 * bottom sheet (the `PublicEndowmentPanel` treatment). It manages only the
 * connected wallet's vault positions. Browse stays wallet-runtime-free: the
 * AppKit runtime mounts only while this panel is open.
 */
export function VaultManagePositionsPanel({
  open,
  onExitComplete,
  onOpenChange,
  onEndow,
}: VaultManagePositionsPanelProps) {
  return (
    <WalletRuntimeProviders>
      <VaultManagePositionsContent
        open={open}
        onExitComplete={onExitComplete}
        onOpenChange={onOpenChange}
        onEndow={onEndow}
      />
    </WalletRuntimeProviders>
  );
}

function VaultManagePositionsContent({
  open,
  onExitComplete,
  onOpenChange,
  onEndow,
}: VaultManagePositionsPanelProps) {
  const { formatMessage } = useIntl();
  const { authMode, primaryAddress } = useUser();
  const connectedAddress = authMode === "wallet" ? (primaryAddress as Address | null) : null;
  const [dialogOpen, setDialogOpen] = useState(open);
  const [exitAnimationComplete, setExitAnimationComplete] = useState(!open);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const exitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const motionState = open ? "open" : exitAnimationComplete ? "idle" : "closed";

  const clearExitFallback = useCallback(() => {
    if (exitFallbackRef.current) {
      clearTimeout(exitFallbackRef.current);
      exitFallbackRef.current = null;
    }
  }, []);

  const finishClose = useCallback(() => {
    clearExitFallback();
    setExitAnimationComplete(true);
    setDialogOpen(false);
    onExitComplete?.();
  }, [clearExitFallback, onExitComplete]);

  useEffect(() => {
    if (open) {
      clearExitFallback();
      setExitAnimationComplete(false);
      setDialogOpen(true);
      return;
    }

    if (!dialogOpen) return;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      finishClose();
      return;
    }

    setExitAnimationComplete(false);
    exitFallbackRef.current = setTimeout(
      finishClose,
      getExitAnimationDurationMs(surfaceRef.current) + EXIT_ANIMATION_BUFFER_MS
    );

    return clearExitFallback;
  }, [clearExitFallback, dialogOpen, finishClose, open]);

  useEffect(() => clearExitFallback, [clearExitFallback]);

  return (
    <Dialog.Root open={dialogOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-component="VaultManagePositionsPanel"
          data-motion-state={motionState}
          data-slot="overlay"
          className="vault-manage-overlay fixed inset-0 z-overlay bg-static-black/40"
        />
        <Dialog.Content
          data-component="VaultManagePositionsPanel"
          data-motion-state={motionState}
          data-slot="surface"
          data-testid="vault-manage-positions-panel"
          ref={surfaceRef}
          className={cn(
            "vault-manage-panel fixed z-modal flex max-h-[86vh] w-full flex-col overflow-hidden border border-stroke-soft-200 bg-bg-weak-50 text-text-strong-950 shadow-[var(--shadow-editorial-panel)] focus:outline-none",
            "inset-x-0 bottom-0 rounded-none",
            "sm:inset-x-auto sm:inset-y-4 sm:right-4 sm:max-h-[calc(100vh-2rem)] sm:w-[min(34rem,calc(100vw-2rem))] sm:rounded-none"
          )}
          onAnimationEnd={(event) => {
            if (event.target === event.currentTarget && !open) {
              finishClose();
            }
          }}
        >
          <header className="flex items-start justify-between gap-4 border-b border-stroke-soft-200 bg-bg-white-0 px-5 py-5 sm:px-6">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
                {formatMessage({
                  id: "public.vaults.manage.kicker",
                  defaultMessage: "Your endowments",
                })}
              </p>
              <Dialog.Title className="mt-2 font-serif text-2xl font-normal leading-[1.08] text-text-strong-950 md:text-3xl">
                {formatMessage({
                  id: "public.vaults.manage.title",
                  defaultMessage: "Manage Endowments",
                })}
              </Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-[1.6] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.manage.lede",
                  defaultMessage:
                    "Review the endowments connected to your wallet and redeem what's available.",
                })}
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                className="inline-flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-stroke-soft-200 bg-bg-white-0 text-text-sub-600 transition-colors hover:bg-bg-weak-50 hover:text-text-strong-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action focus-visible:ring-offset-2"
                aria-label={formatMessage({
                  id: "public.vaults.manage.close",
                  defaultMessage: "Close Manage Endowments",
                })}
              >
                <RiCloseLine className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </header>

          <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <ConnectedWalletSection address={connectedAddress} onEndow={onEndow} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
      <div className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-5">
        <h3 className="font-serif text-xl font-normal text-text-strong-950">
          {formatMessage({
            id: "public.vaults.manage.connected.connectTitle",
            defaultMessage: "Connect to see your endowments",
          })}
        </h3>
        <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.connected.connectBody",
            defaultMessage:
              "This view only checks your connected wallet. Your address is not added to the page URL.",
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
    <div className="space-y-4">
      <ConnectedWalletIndicator address={address} />
      <PositionsList
        positions={positions}
        ownerLabel=""
        emptyTitle={formatMessage({
          id: "public.vaults.manage.empty.connected.title",
          defaultMessage: "No endowments for this wallet yet",
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
    </div>
  );
}

function ConnectedWalletIndicator({ address }: { address: Address }) {
  const { formatMessage } = useIntl();
  const { data: ensName } = useEnsName(address, { enabled: Boolean(address) });
  const displayLabel = formatAddress(address, {
    ensName: ensName ?? undefined,
    variant: "long",
  });
  const fallbackAddress = formatAddress(address, { variant: "long" });

  return (
    <section className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4">
      <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
        {formatMessage({
          id: "public.vaults.manage.connectedWallet",
          defaultMessage: "Connected wallet",
        })}
      </p>
      <p
        className={cn(
          "mt-2 text-sm font-medium text-text-strong-950",
          ensName ? "truncate" : "break-all font-mono"
        )}
      >
        {displayLabel}
      </p>
      {ensName ? (
        <p className="mt-1 break-all font-mono text-xs text-text-soft-400">{fallbackAddress}</p>
      ) : null}
    </section>
  );
}

/**
 * Shared list shell: loading skeleton, error/retry, empty state (which points back
 * to Endow), and the owner address strip. Row rendering is injected so the
 * connected-wallet management surface can reuse this scaffolding.
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
        className="rounded-none bg-error-lighter/30 p-5"
        title={formatMessage({
          id: "public.vaults.manage.error.title",
          defaultMessage: "We couldn't load your endowments",
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
      <div className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-5">
        {beforeList}
        <h3 className="font-serif text-xl font-normal text-text-strong-950">{emptyTitle}</h3>
        <p className="mt-3 text-sm leading-[1.6] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.empty.body",
            defaultMessage: "When you endow a campaign, it appears here for review or redemption.",
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
      {ownerLabel ? (
        <p className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-text-soft-400">
          {ownerLabel}
        </p>
      ) : null}
      <div className="space-y-4">{positions.positions.map(renderRow)}</div>
    </div>
  );
}

export function PositionsSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-28 animate-pulse rounded-none bg-bg-white-0" />
      <div className="h-28 animate-pulse rounded-none bg-bg-white-0" />
    </div>
  );
}

/** Connected-wallet row: redeems through the chain-aware transaction sender. */
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
  const redeem = useOctantVaultRedeem({ errorMode: "inline" });
  const txError = useTxErrorMessages(redeem.error);

  return (
    <VaultPositionRowView
      position={position}
      destinationLabel={formatMessage({
        id: "public.vaults.manage.withdraw.destinationWallet",
        defaultMessage: "your connected wallet",
      })}
      isRedeeming={redeem.isPending}
      errorNode={
        redeem.error ? (
          <Alert
            variant="error"
            className="mt-4 rounded-none bg-error-lighter/30 p-3"
            title={txError.title}
          >
            <p className="mt-1 text-xs leading-[1.5] text-text-sub-600">{txError.message}</p>
          </Alert>
        ) : null
      }
      onRedeem={async (shares) => {
        await redeem.mutateAsync({
          chainId: position.chainId,
          vaultAddress: position.vaultAddress,
          shares,
          owner,
          receiver: owner,
        });
        await onRefresh();
      }}
      onResetError={redeem.reset}
    />
  );
}

/**
 * Presentational redeem row shared by both owner sources. Default view shows
 * campaign, position value, owned shares, redeemable shares, and estimated WETH
 * proceeds; technical details (vault, token, chain, raw shares, explorer) live
 * behind a disclosure. Redeem is a collapsed control that expands to shares →
 * review → confirm; the actual signing is injected via `onRedeem`.
 */
export function VaultPositionRowView({
  position,
  destinationLabel,
  isRedeeming,
  errorNode,
  onRedeem,
  onResetError,
  disabledReason,
}: {
  position: OctantVaultPosition;
  destinationLabel: string;
  isRedeeming: boolean;
  errorNode?: React.ReactNode;
  onRedeem: (shares: bigint) => Promise<void>;
  onResetError?: () => void;
  /** When set, the redeem control is replaced by this node (e.g. restore session). */
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
  const assetDecimals = position.assetDecimals;
  const shareDecimals = position.shareDecimals;
  const symbol = position.assetSymbol;

  const inputError = useMemo(
    () => validateDecimalInput(amountInput, shareDecimals),
    [amountInput, shareDecimals]
  );
  const parsedShares = useMemo(() => {
    if (!amountInput.trim() || inputError) return 0n;
    try {
      return parseUnits(normalizeDecimalInput(amountInput), shareDecimals);
    } catch {
      return 0n;
    }
  }, [amountInput, inputError, shareDecimals]);

  const displayAssets = (value: bigint) =>
    `${formatTokenAmount(value, assetDecimals, 4, undefined, true)} ${symbol}`;
  const displayShares = (value: bigint) =>
    `${formatTokenAmount(value, shareDecimals, 4, undefined, true)} shares`;
  const redeemableShares = position.redeemableShares;
  const unavailableProceedsLabel = formatMessage({
    id: "public.vaults.manage.position.estimatedProceedsUnavailable",
    defaultMessage: "Unavailable",
  });
  const redemptionUnavailable = position.shares > 0n && redeemableShares <= 0n;
  const redemptionPreviewUnavailable =
    redeemableShares > 0n && position.estimatedRedeemAssets === null;
  const redeemControlUnavailable = redemptionUnavailable || redemptionPreviewUnavailable;
  const estimateRedeemAssets = (shares: bigint): bigint | null => {
    if (redemptionPreviewUnavailable) return null;
    if (
      shares <= 0n ||
      redeemableShares <= 0n ||
      position.estimatedRedeemAssets === null ||
      position.estimatedRedeemAssets <= 0n
    ) {
      return 0n;
    }
    return (position.estimatedRedeemAssets * shares) / redeemableShares;
  };
  const estimatedAssets = estimateRedeemAssets(parsedShares);
  const estimatedAssetsLabel =
    estimatedAssets === null ? unavailableProceedsLabel : displayAssets(estimatedAssets);
  const exceedsAvailable =
    parsedShares > 0n && redeemableShares > 0n && parsedShares > redeemableShares;
  const disableConfirm =
    isRedeeming ||
    Boolean(inputError) ||
    estimatedAssets === null ||
    parsedShares <= 0n ||
    redeemableShares <= 0n ||
    exceedsAvailable;
  const vaultExplorerUrl = getAddressExplorerUrl(position.explorerLink, position.vaultAddress);
  const tokenExplorerUrl = getAddressExplorerUrl(position.explorerLink, position.assetAddress);

  const resetInput = () => {
    setAmountInput("");
    setShowConfirm(false);
    setSuccessMessage("");
    onResetError?.();
  };

  const executeRedeem = async () => {
    if (disableConfirm) return;
    if (estimatedAssets === null) return;
    const assetsLabel = displayAssets(estimatedAssets);
    try {
      await onRedeem(parsedShares);
      setAmountInput("");
      setShowConfirm(false);
      setSuccessMessage(
        formatMessage(
          {
            id: "public.vaults.manage.withdraw.success",
            defaultMessage:
              "Redemption submitted. Estimated return: {assets}. Balances may take a moment to update.",
          },
          { assets: assetsLabel }
        )
      );
    } catch {
      // Error surfaces through errorNode; keep the entered amount for retry.
    }
  };

  return (
    <article
      className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4"
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
              defaultMessage: "Campaign endowment",
            })}
          </p>
          <dl className="mt-3 space-y-1 text-xs leading-[1.55] text-text-soft-400">
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.value",
                  defaultMessage: "Current value",
                })}
                {": "}
              </dt>
              <dd className="inline font-semibold text-text-strong-950">
                {displayAssets(position.positionValue)}
              </dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.withdrawable",
                  defaultMessage: "Redeemable now",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">{displayShares(redeemableShares)}</dd>
            </div>
            <div>
              <dt className="inline">
                {formatMessage({
                  id: "public.vaults.manage.position.estimatedProceeds",
                  defaultMessage: "Estimated return",
                })}
                {": "}
              </dt>
              <dd className="inline text-text-sub-600">
                {redeemControlUnavailable || position.estimatedRedeemAssets === null
                  ? unavailableProceedsLabel
                  : displayAssets(position.estimatedRedeemAssets)}
              </dd>
            </div>
          </dl>
        </div>
        {disabledReason || redeemControlUnavailable ? null : (
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
              defaultMessage: "Redeem",
            })}
          </EditorialGhostButton>
        )}
      </div>

      <CheckoutTransactionDetails
        className="mt-3"
        label={formatMessage({
          id: "public.vaults.manage.position.technical",
          defaultMessage: "Transaction details",
        })}
      >
        <dl className="grid gap-2 text-xs sm:grid-cols-2">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.vault",
                defaultMessage: "Octant vault",
              })}
            </dt>
            <dd className="break-all font-mono text-text-sub-600">
              {vaultExplorerUrl ? (
                <a
                  href={vaultExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                >
                  {position.vaultAddress}
                </a>
              ) : (
                position.vaultAddress
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.manage.position.tech.token",
                defaultMessage: "WETH token",
              })}
            </dt>
            <dd className="break-all text-text-sub-600">
              {position.assetSymbol} ·{" "}
              {tokenExplorerUrl ? (
                <a
                  href={tokenExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                >
                  {position.assetAddress}
                </a>
              ) : (
                <span className="font-mono">{position.assetAddress}</span>
              )}
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
              {getEthereumNetworkLabel(position.chainId, formatMessage)}
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
      </CheckoutTransactionDetails>

      {disabledReason ? <div className="mt-3">{disabledReason}</div> : null}

      {redemptionUnavailable ? (
        <Alert
          variant="warning"
          className="mt-3 rounded-none bg-warning-lighter/30 p-3"
          title={formatMessage({
            id: "public.vaults.manage.redeem.unavailableTitle",
            defaultMessage: "Redemption unavailable right now",
          })}
        >
          <p className="mt-1 text-xs leading-[1.5] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.manage.redeem.unavailableBody",
              defaultMessage:
                "This endowment is visible, but nothing is redeemable right now. Try again later or leave it in place.",
            })}
          </p>
        </Alert>
      ) : null}

      {redemptionPreviewUnavailable ? (
        <Alert
          variant="warning"
          className="mt-3 rounded-none bg-warning-lighter/30 p-3"
          title={formatMessage({
            id: "public.vaults.manage.redeem.previewUnavailableTitle",
            defaultMessage: "Estimated return unavailable",
          })}
        >
          <p className="mt-1 text-xs leading-[1.5] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.manage.redeem.previewUnavailableBody",
              defaultMessage:
                "We can see a redeemable amount, but the return estimate is unavailable. Refresh before redeeming.",
            })}
          </p>
        </Alert>
      ) : null}

      {expanded && !disabledReason && !redeemControlUnavailable ? (
        <div
          id={regionId}
          className="mt-4 rounded-none border border-stroke-soft-200 bg-bg-weak-50 p-4"
        >
          <label
            htmlFor={amountInputId}
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.manage.withdraw.amount",
              defaultMessage: "Amount to redeem",
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
              onBlur={() => setAmountInput((current) => normalizeDecimalInput(current))}
              placeholder="0.0 shares"
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
                setAmountInput(formatUnits(redeemableShares, shareDecimals));
                setShowConfirm(false);
                setSuccessMessage("");
                onResetError?.();
              }}
              disabled={redeemableShares <= 0n}
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
                defaultMessage: "Enter an amount no higher than what is redeemable now.",
              })}
            </p>
          ) : (
            <p id={feedbackId} className="mt-2 text-xs text-text-soft-400">
              {formatMessage(
                {
                  id: "public.vaults.manage.withdraw.available",
                  defaultMessage:
                    "Available to redeem: {shares}. The estimate updates before confirmation.",
                },
                { shares: displayShares(redeemableShares) }
              )}
            </p>
          )}

          {showConfirm ? (
            <div className="mt-4 rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4">
              <p className="font-serif text-lg font-normal text-text-strong-950">
                {formatMessage({
                  id: "public.vaults.manage.withdraw.confirmTitle",
                  defaultMessage: "Confirm redemption",
                })}
              </p>
              <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage(
                  {
                    id: "public.vaults.manage.withdraw.confirmBody",
                    defaultMessage: "Redeem approximately {assets} to {destination}?",
                  },
                  {
                    assets: estimatedAssetsLabel,
                    destination: destinationLabel,
                  }
                )}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <EditorialGhostButton
                  variant="warm"
                  className="px-5 py-2.5 text-sm"
                  disabled={disableConfirm}
                  onClick={() => void executeRedeem()}
                >
                  {isRedeeming
                    ? formatMessage({
                        id: "public.vaults.manage.withdraw.pending",
                        defaultMessage: "Redeeming…",
                      })
                    : formatMessage({
                        id: "public.vaults.manage.withdraw.confirm",
                        defaultMessage: "Confirm",
                      })}
                </EditorialGhostButton>
                <EditorialGhostButton
                  className="px-5 py-2.5 text-sm"
                  disabled={isRedeeming}
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
              onClick={() => {
                setAmountInput((current) => normalizeDecimalInput(current));
                setShowConfirm(true);
              }}
            >
              {formatMessage({
                id: "public.vaults.manage.withdraw.review",
                defaultMessage: "Review redemption",
              })}
            </EditorialGhostButton>
          )}

          {errorNode}

          {successMessage ? (
            <Alert variant="success" className="mt-4 rounded-none bg-success-lighter/30 p-3">
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
