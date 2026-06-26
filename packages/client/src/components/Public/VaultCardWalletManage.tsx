import {
  type Address,
  DEFAULT_WITHDRAW_MAX_LOSS_BPS,
  formatTokenAmount,
  getOctantVaultCampaignBySlug,
  getOctantVaultRedeemCallShape,
  getOctantVaultPendingFundedCardWalletRefs,
  OCTANT_VAULT_REDEEM_CALL_SHAPES,
  type OctantVaultCardWalletPositionRef,
  type OctantVaultPosition,
  type OctantVaultRedeemCallVariant,
  rememberOctantVaultCardWalletPosition,
  truncateAddress,
  useOctantVaultPositions,
} from "@green-goods/shared";
import { type FormEvent, useCallback, useId, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  readContract,
  type ThirdwebClient,
} from "thirdweb";
import { defineChain, ethereum } from "thirdweb/chains";
import {
  ThirdwebProvider,
  useActiveAccount,
  useAutoConnect,
  useConnect,
  useSendAndConfirmTransaction,
} from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets/in-app";
import { EditorialGhostButton } from "./atoms";
import { PositionsList, VaultPositionRowView } from "./VaultManagePositionsPanel";

function getThirdwebClientId(): string {
  return import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim() ?? "";
}

function getThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
}

async function readCardWalletMaxRedeemable({
  contract,
  owner,
}: {
  contract: ReturnType<typeof getContract>;
  owner: Address;
}): Promise<{ shares: bigint; variant: OctantVaultRedeemCallVariant }> {
  for (const shape of OCTANT_VAULT_REDEEM_CALL_SHAPES) {
    try {
      const result = await readContract({
        contract,
        method: shape.maxRedeemMethod,
        params: shape.maxRedeemArgs(owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS),
      });
      return {
        shares: typeof result === "bigint" ? result : 0n,
        variant: shape.variant,
      };
    } catch {
      // Try the next Octant V2 / ERC-4626-compatible redeem shape.
    }
  }

  return { shares: 0n, variant: "multistrategy" };
}

// The recovered email wallet config must match the one Card Endow connected with,
// so Thirdweb's autoConnect knows which wallet to silently reconnect.
function emailInAppWallet() {
  return inAppWallet({ auth: { options: ["email"] }, metadata: { name: "Green Goods" } });
}

export interface VaultCardWalletManageProps {
  owners: Address[];
  onEndow?: () => void;
}

/**
 * Manage card/recovered email-wallet vault positions on `/vaults`.
 *
 * Viewing is always read-only — positions are read from the cached recovered
 * wallet address through a public client, no session required. Redeeming needs
 * the live Thirdweb in-app (email) wallet session: `useAutoConnect` silently
 * reconnects a still-valid session (so a supporter who just finished Card Endow
 * never re-verifies), and only once autoConnect has settled WITHOUT a matching
 * session do we prompt to restore the email wallet.
 */
export default function VaultCardWalletManage({ owners, onEndow }: VaultCardWalletManageProps) {
  const { formatMessage } = useIntl();
  const clientId = getThirdwebClientId();
  const client = useMemo<ThirdwebClient | null>(
    () => (clientId ? createThirdwebClient({ clientId }) : null),
    [clientId]
  );

  if (!client) {
    return (
      <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
        {formatMessage({
          id: "public.vaults.manage.card.missingClientId",
          defaultMessage: "Card wallet management is not available here yet.",
        })}
      </p>
    );
  }

  return (
    <ThirdwebProvider>
      <CardWalletManageInner client={client} owners={owners} onEndow={onEndow} />
    </ThirdwebProvider>
  );
}

function CardWalletManageInner({
  client,
  owners,
  onEndow,
}: {
  client: ThirdwebClient;
  owners: Address[];
  onEndow?: () => void;
}) {
  const wallets = useMemo(() => [emailInAppWallet()], []);
  const autoConnect = useAutoConnect({ client, wallets });
  const activeAccount = useActiveAccount();
  // Treat the session as "still resolving" until autoConnect settles, so a
  // same-session supporter is never wrongly told to re-verify during the window.
  const sessionResolving = autoConnect.isLoading;
  // Pending-funded recovery entries (card funding landed, no shares yet). Held
  // in state so finishing a deposit removes the card without a full remount.
  const [pendingRefs, setPendingRefs] = useState<OctantVaultCardWalletPositionRef[]>(() =>
    getOctantVaultPendingFundedCardWalletRefs()
  );
  const refreshPendingRefs = useCallback(() => {
    setPendingRefs(getOctantVaultPendingFundedCardWalletRefs());
  }, []);

  return (
    <div className="space-y-6">
      {owners.map((owner) => (
        <CardOwnerPositions
          key={owner}
          owner={owner}
          client={client}
          activeAddress={(activeAccount?.address as Address | undefined) ?? null}
          sessionResolving={sessionResolving}
          pendingRefs={pendingRefs.filter(
            (ref) => ref.recoveredWalletAddress.toLowerCase() === owner.toLowerCase()
          )}
          onPendingResolved={refreshPendingRefs}
          onEndow={onEndow}
        />
      ))}
    </div>
  );
}

function CardOwnerPositions({
  owner,
  client,
  activeAddress,
  sessionResolving,
  pendingRefs,
  onPendingResolved,
  onEndow,
}: {
  owner: Address;
  client: ThirdwebClient;
  activeAddress: Address | null;
  sessionResolving: boolean;
  pendingRefs: OctantVaultCardWalletPositionRef[];
  onPendingResolved: () => void;
  onEndow?: () => void;
}) {
  const { formatMessage } = useIntl();
  const positions = useOctantVaultPositions(owner, { enabled: true });
  const sessionLive = Boolean(activeAddress && activeAddress.toLowerCase() === owner.toLowerCase());
  const hasPending = pendingRefs.length > 0;

  const readOnlyNote = (
    <p className="rounded-none bg-bg-weak-50 p-3 text-xs leading-[1.5] text-text-sub-600">
      {formatMessage({
        id: "public.vaults.manage.card.readOnly",
        defaultMessage: "View only. Restore your email recovery wallet to redeem.",
      })}
    </p>
  );

  // The restore prompt also serves pending-funded recovery: a returning
  // supporter whose card funding landed without a finished deposit restores the
  // email wallet here, then finishes the deposit below.
  const sessionBanner =
    (positions.hasPositions || hasPending) && !sessionLive ? (
      sessionResolving ? (
        <p className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm leading-[1.55] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.card.checking",
            defaultMessage: "Checking your recovery session…",
          })}
        </p>
      ) : (
        <RestoreEmailWallet client={client} expectedOwner={owner} />
      )
    ) : null;

  const pendingCards = hasPending ? (
    <div className="space-y-3">
      {pendingRefs.map((ref) => (
        <PendingFundedDepositCard
          key={`${ref.recoveredWalletAddress}:${ref.vaultAddress}`}
          refEntry={ref}
          client={client}
          sessionLive={sessionLive}
          onResolved={async () => {
            onPendingResolved();
            await positions.refetch();
          }}
        />
      ))}
    </div>
  ) : null;

  const beforeList =
    sessionBanner || pendingCards ? (
      <div className="space-y-3">
        {sessionBanner}
        {pendingCards}
      </div>
    ) : null;

  return (
    <PositionsList
      positions={positions}
      ownerLabel={formatMessage(
        {
          id: "public.vaults.manage.card.ownerLabel",
          defaultMessage: "Email recovery wallet {address}",
        },
        { address: truncateAddress(owner) }
      )}
      emptyTitle={formatMessage({
        id: "public.vaults.manage.empty.card.title",
        defaultMessage: "No endowments for this recovery wallet yet",
      })}
      onEndow={onEndow}
      beforeList={beforeList}
      renderRow={(position) =>
        sessionLive ? (
          <CardVaultPositionRow
            key={`${position.vaultAddress}:${position.chainId}`}
            position={position}
            client={client}
            owner={owner}
            onRefresh={positions.refetch}
          />
        ) : (
          <VaultPositionRowView
            key={`${position.vaultAddress}:${position.chainId}`}
            position={position}
            destinationLabel={formatMessage({
              id: "public.vaults.manage.withdraw.destinationCard",
              defaultMessage: "your card wallet",
            })}
            isRedeeming={false}
            onRedeem={async () => undefined}
            disabledReason={readOnlyNote}
          />
        )
      }
    />
  );
}

/** Card-wallet row: signs the redeem with the live Thirdweb in-app wallet. */
function CardVaultPositionRow({
  position,
  client,
  owner,
  onRefresh,
}: {
  position: OctantVaultPosition;
  client: ThirdwebClient;
  owner: Address;
  onRefresh: () => Promise<unknown>;
}) {
  const { formatMessage } = useIntl();
  const sendAndConfirm = useSendAndConfirmTransaction({ payModal: false });
  const [error, setError] = useState<string | null>(null);
  const chain = useMemo(() => getThirdwebChain(position.chainId), [position.chainId]);

  return (
    <VaultPositionRowView
      position={position}
      destinationLabel={formatMessage({
        id: "public.vaults.manage.withdraw.destinationCard",
        defaultMessage: "your card wallet",
      })}
      isRedeeming={sendAndConfirm.isPending}
      onResetError={() => setError(null)}
      errorNode={
        error ? (
          <p className="mt-4 rounded-none bg-error-lighter/30 p-3 text-xs leading-[1.5] text-error-base">
            {error}
          </p>
        ) : null
      }
      onRedeem={async (shares) => {
        setError(null);
        try {
          const vault = getContract({ client, chain, address: position.vaultAddress });
          // Fresh pre-check using the same ABI fallback order the read hook uses,
          // so TokenizedStrategy pilot vaults do not look unredeemable.
          const maxRedeemable = await readCardWalletMaxRedeemable({ contract: vault, owner });
          if (shares > maxRedeemable.shares) {
            throw new Error(
              formatMessage({
                id: "public.vaults.manage.withdraw.exceeds",
                defaultMessage: "Enter an amount no higher than what is redeemable now.",
              })
            );
          }
          const redeemShape = getOctantVaultRedeemCallShape(maxRedeemable.variant);
          const transaction = prepareContractCall({
            contract: vault,
            method: redeemShape.redeemMethod,
            params: redeemShape.redeemArgs(shares, owner, owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS),
          });
          await sendAndConfirm.mutateAsync(transaction);
          await onRefresh();
        } catch (caught) {
          setError(
            caught instanceof Error
              ? caught.message
              : formatMessage({
                  id: "public.vaults.manage.withdraw.error",
                  defaultMessage:
                    "Redemption could not be completed. Review the wallet message and try again.",
                })
          );
          throw caught;
        }
      }}
    />
  );
}

/**
 * Pending-funded recovery: card funding (WETH) landed in the recovered wallet
 * but the approve/deposit never produced shares. With a live session this card
 * finishes the same ordered approve -> deposit pair the checkout uses, verifies
 * positive `vault.balanceOf(owner)`, and upgrades the cache entry to confirmed.
 * Without a session it stays read-only until the email wallet is restored above.
 */
function PendingFundedDepositCard({
  refEntry,
  client,
  sessionLive,
  onResolved,
}: {
  refEntry: OctantVaultCardWalletPositionRef;
  client: ThirdwebClient;
  sessionLive: boolean;
  onResolved: () => Promise<void> | void;
}) {
  const { formatMessage } = useIntl();
  const sendAndConfirm = useSendAndConfirmTransaction({ payModal: false });
  const [busy, setBusy] = useState(false);
  const [, setPendingStep] = useState<"idle" | "approval" | "deposit">("idle");
  const [approvalComplete, setApprovalComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const campaign = useMemo(
    () => getOctantVaultCampaignBySlug(refEntry.campaignSlug),
    [refEntry.campaignSlug]
  );
  const displayName = campaign?.displayName ?? refEntry.campaignSlug;
  const assetDecimals = campaign?.vault?.asset?.decimals ?? 18;
  const assetSymbol = campaign?.vault?.asset?.symbol ?? "WETH";
  const chain = useMemo(() => getThirdwebChain(refEntry.chainId), [refEntry.chainId]);
  const expectedAmount = refEntry.expectedAmount;
  const tokenAddress = refEntry.tokenAddress;
  const amountLabel = expectedAmount
    ? `${formatTokenAmount(BigInt(expectedAmount), assetDecimals, 6, undefined, true)} ${assetSymbol}`
    : null;

  const finishDeposit = useCallback(async () => {
    if (!sessionLive || busy || !tokenAddress || !expectedAmount) return;
    setBusy(true);
    setPendingStep(approvalComplete ? "deposit" : "approval");
    setError(null);
    try {
      const amount = BigInt(expectedAmount);
      const tokenContract = getContract({ client, chain, address: tokenAddress });
      if (!approvalComplete) {
        const approveTransaction = prepareContractCall({
          contract: tokenContract,
          method: "function approve(address spender, uint256 value)",
          params: [refEntry.vaultAddress, amount],
        });
        await sendAndConfirm.mutateAsync(approveTransaction);
        setApprovalComplete(true);
      }

      const vaultContract = getContract({ client, chain, address: refEntry.vaultAddress });
      const depositTransaction = prepareContractCall({
        contract: vaultContract,
        method: "function deposit(uint256 assets, address receiver) returns (uint256)",
        params: [amount, refEntry.recoveredWalletAddress],
      });
      setPendingStep("deposit");
      await sendAndConfirm.mutateAsync(depositTransaction);

      const sharesResult = await readContract({
        contract: vaultContract,
        method: "function balanceOf(address account) view returns (uint256)",
        params: [refEntry.recoveredWalletAddress],
      });
      const shares =
        typeof sharesResult === "bigint" ? sharesResult : BigInt(String(sharesResult ?? "0"));
      if (shares <= 0n) {
        setError(
          formatMessage({
            id: "public.vaults.manage.card.pendingSharesUnconfirmed",
            defaultMessage:
              "The transaction was sent, but confirmation is not visible yet. Refresh in a moment.",
          })
        );
        return;
      }

      rememberOctantVaultCardWalletPosition({
        recoveredWalletAddress: refEntry.recoveredWalletAddress,
        campaignSlug: refEntry.campaignSlug,
        vaultAddress: refEntry.vaultAddress,
        chainId: refEntry.chainId,
        status: "confirmed",
      });
      setApprovalComplete(false);
      await onResolved();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : formatMessage({
              id: "public.vaults.manage.card.pendingFinishError",
              defaultMessage:
                "The endowment could not be completed. Review the wallet message and try again.",
            })
      );
    } finally {
      setBusy(false);
      setPendingStep("idle");
    }
  }, [
    approvalComplete,
    busy,
    chain,
    client,
    expectedAmount,
    formatMessage,
    onResolved,
    refEntry.campaignSlug,
    refEntry.chainId,
    refEntry.recoveredWalletAddress,
    refEntry.vaultAddress,
    sendAndConfirm,
    sessionLive,
    tokenAddress,
  ]);
  const pendingFinishLabel = busy
    ? formatMessage({
        id: "public.vaults.manage.card.pendingFinishPending",
        defaultMessage: "Finishing endowment...",
      })
    : formatMessage({
        id: "public.vaults.manage.card.pendingFinishCta",
        defaultMessage: "Finish endowment",
      });

  return (
    <section
      className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4"
      data-testid={`vault-manage-pending-funded-${refEntry.campaignSlug}`}
    >
      <h3 className="font-serif text-lg font-normal text-text-strong-950">
        {formatMessage({
          id: "public.vaults.manage.card.pendingTitle",
          defaultMessage: "Finish your endowment",
        })}
      </h3>
      <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
        {amountLabel
          ? formatMessage(
              {
                id: "public.vaults.manage.card.pendingBody",
                defaultMessage:
                  "Your card payment of {amount} for {campaign} arrived, but the endowment is not finished yet. Finish it here to confirm your campaign support.",
              },
              { amount: amountLabel, campaign: displayName }
            )
          : formatMessage(
              {
                id: "public.vaults.manage.card.pendingBodyNoAmount",
                defaultMessage:
                  "Your card payment for {campaign} arrived, but the endowment is not finished yet.",
              },
              { campaign: displayName }
            )}
      </p>
      {sessionLive ? (
        <EditorialGhostButton
          variant="warm"
          className="mt-4 w-full px-5 py-2.5 text-sm"
          disabled={busy || !tokenAddress || !expectedAmount}
          onClick={() => void finishDeposit()}
        >
          {pendingFinishLabel}
        </EditorialGhostButton>
      ) : (
        <p className="mt-3 rounded-none bg-bg-weak-50 p-3 text-xs leading-[1.5] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.card.pendingRestoreNote",
            defaultMessage: "Restore your email recovery wallet above to finish this endowment.",
          })}
        </p>
      )}
      {error ? (
        <p className="mt-3 rounded-none bg-error-lighter/30 p-3 text-xs leading-[1.5] text-error-base">
          {error}
        </p>
      ) : null}
    </section>
  );
}

/**
 * Restore the recovered email wallet session when autoConnect found none —
 * email + OTP, reusing the Card Endow recovery ceremony. On success the active
 * account becomes the recovered wallet and redeem unlocks.
 */
function RestoreEmailWallet({
  client,
  expectedOwner,
}: {
  client: ThirdwebClient;
  expectedOwner: Address;
}) {
  const { formatMessage } = useIntl();
  const emailInputId = useId();
  const otpInputId = useId();
  const { connect, isConnecting } = useConnect();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = email.trim().includes("@") && !otpSent;
  const canVerify = otpSent && otp.trim().length > 0;

  const sendCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSend) return;
      setError(null);
      try {
        await preAuthenticate({ client, strategy: "email", email: email.trim() });
        setOtpSent(true);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Email code could not be sent.");
      }
    },
    [canSend, client, email]
  );

  const verify = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canVerify) return;
      setError(null);
      try {
        await connect(async () => {
          const wallet = emailInAppWallet();
          const account = await wallet.connect({
            client,
            chain: ethereum,
            strategy: "email",
            email: email.trim(),
            verificationCode: otp.trim(),
          });
          if (account.address.toLowerCase() !== expectedOwner.toLowerCase()) {
            throw new Error(
              formatMessage({
                id: "public.vaults.manage.card.restoreMismatch",
                defaultMessage:
                  "That email does not match this endowment. Use the email from the original card checkout.",
              })
            );
          }
          return wallet;
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Email wallet could not be restored.");
      }
    },
    [canVerify, client, connect, email, expectedOwner, formatMessage, otp]
  );

  return (
    <section className="rounded-none border border-stroke-soft-200 bg-bg-white-0 p-4">
      <h3 className="font-serif text-lg font-normal text-text-strong-950">
        {formatMessage({
          id: "public.vaults.manage.card.restoreTitle",
          defaultMessage: "Restore access to redeem",
        })}
      </h3>
      <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.manage.card.restoreBody",
          defaultMessage:
            "To redeem this endowment, restore the email you used during card checkout.",
        })}
      </p>

      <form className="mt-4 grid gap-2" onSubmit={sendCode}>
        <label
          htmlFor={emailInputId}
          className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
        >
          {formatMessage({ id: "public.vaults.manage.card.emailLabel", defaultMessage: "Email" })}
        </label>
        <input
          id={emailInputId}
          type="email"
          autoComplete="email"
          value={email}
          placeholder="you@example.com"
          onChange={(event) => {
            setEmail(event.target.value);
            if (otpSent) {
              setOtpSent(false);
              setOtp("");
            }
            setError(null);
          }}
          className="min-h-11 w-full rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2.5 text-sm text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action"
        />
        {!otpSent ? (
          <EditorialGhostButton
            variant="warm"
            type="submit"
            disabled={!canSend}
            className="mt-1 px-5 py-2.5 text-sm"
          >
            {formatMessage({
              id: "public.vaults.manage.card.sendCode",
              defaultMessage: "Send email code",
            })}
          </EditorialGhostButton>
        ) : null}
      </form>

      {otpSent ? (
        <form className="mt-3 grid gap-2" onSubmit={verify}>
          <p className="rounded-none bg-primary-action/10 p-3 text-xs leading-[1.5] text-primary-base">
            {formatMessage(
              {
                id: "public.vaults.manage.card.codeSent",
                defaultMessage: "Code sent. Check {email} and enter the 6-digit code.",
              },
              { email: email.trim() }
            )}
          </p>
          <label
            htmlFor={otpInputId}
            className="font-mono text-[10.5px] font-medium uppercase tracking-[0.16em] text-text-soft-400"
          >
            {formatMessage({
              id: "public.vaults.manage.card.codeLabel",
              defaultMessage: "Email code",
            })}
          </label>
          <input
            id={otpInputId}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={otp}
            placeholder="123456"
            onChange={(event) => {
              setOtp(event.target.value);
              setError(null);
            }}
            className="min-h-11 w-full rounded-full border border-stroke-soft-200 bg-bg-white-0 px-4 py-2.5 text-sm text-text-strong-950 outline-none transition-colors placeholder:text-text-soft-400 focus:border-primary-action"
          />
          <EditorialGhostButton
            variant="warm"
            type="submit"
            disabled={!canVerify || isConnecting}
            className="mt-1 px-5 py-2.5 text-sm"
          >
            {formatMessage({
              id: "public.vaults.manage.card.verify",
              defaultMessage: "Restore access",
            })}
          </EditorialGhostButton>
        </form>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-none bg-error-lighter/30 p-3 text-xs leading-[1.5] text-error-base">
          {error}
        </p>
      ) : null}
    </section>
  );
}
