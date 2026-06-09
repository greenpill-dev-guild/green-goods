import {
  type Address,
  DEFAULT_WITHDRAW_MAX_LOSS_BPS,
  type OctantVaultPosition,
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
      <p className="rounded-2xl bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
        {formatMessage({
          id: "public.vaults.manage.card.missingClientId",
          defaultMessage: "Card wallet management is not available on this domain yet.",
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

  return (
    <div className="space-y-6">
      {owners.map((owner) => (
        <CardOwnerPositions
          key={owner}
          owner={owner}
          client={client}
          activeAddress={(activeAccount?.address as Address | undefined) ?? null}
          sessionResolving={sessionResolving}
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
  onEndow,
}: {
  owner: Address;
  client: ThirdwebClient;
  activeAddress: Address | null;
  sessionResolving: boolean;
  onEndow?: () => void;
}) {
  const { formatMessage } = useIntl();
  const positions = useOctantVaultPositions(owner, { enabled: true });
  const sessionLive = Boolean(activeAddress && activeAddress.toLowerCase() === owner.toLowerCase());

  const readOnlyNote = (
    <p className="rounded-xl bg-bg-weak-50 p-3 text-xs leading-[1.5] text-text-sub-600">
      {formatMessage({
        id: "public.vaults.manage.card.readOnly",
        defaultMessage: "Read-only — restore the email wallet above to redeem shares.",
      })}
    </p>
  );

  const sessionBanner =
    positions.hasPositions && !sessionLive ? (
      sessionResolving ? (
        <p className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4 text-sm leading-[1.55] text-text-sub-600">
          {formatMessage({
            id: "public.vaults.manage.card.checking",
            defaultMessage: "Checking your card wallet session…",
          })}
        </p>
      ) : (
        <RestoreEmailWallet client={client} expectedOwner={owner} />
      )
    ) : null;

  return (
    <PositionsList
      positions={positions}
      ownerLabel={formatMessage(
        { id: "public.vaults.manage.card.ownerLabel", defaultMessage: "Card wallet {address}" },
        { address: truncateAddress(owner) }
      )}
      emptyTitle={formatMessage({
        id: "public.vaults.manage.empty.card.title",
        defaultMessage: "No vault positions for this card wallet yet",
      })}
      onEndow={onEndow}
      beforeList={sessionBanner}
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
          <p className="mt-4 rounded-2xl bg-error-lighter/30 p-3 text-xs leading-[1.5] text-error-base">
            {error}
          </p>
        ) : null
      }
      onRedeem={async (shares) => {
        setError(null);
        try {
          const vault = getContract({ client, chain, address: position.vaultAddress });
          // Fresh pre-check at the SAME 1% maxLoss the read used, so we fail before
          // the wallet prompt rather than reverting on-chain.
          const maxResult = await readContract({
            contract: vault,
            method:
              "function maxRedeem(address owner, uint256 maxLoss, address[] strategies) view returns (uint256)",
            params: [owner, DEFAULT_WITHDRAW_MAX_LOSS_BPS, []],
          });
          const maxRedeemable = typeof maxResult === "bigint" ? maxResult : 0n;
          if (shares > maxRedeemable) {
            throw new Error(
              formatMessage({
                id: "public.vaults.manage.withdraw.exceeds",
                defaultMessage: "Share amount is higher than the currently redeemable shares.",
              })
            );
          }
          const transaction = prepareContractCall({
            contract: vault,
            method:
              "function redeem(uint256 shares, address receiver, address owner) returns (uint256)",
            params: [shares, owner, owner],
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
                    "Redemption could not be completed. Review the wallet error and retry.",
                })
          );
          throw caught;
        }
      }}
    />
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
                  "That email wallet doesn't match this position. Use the email that owns it.",
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
    <section className="rounded-2xl border border-stroke-soft-200 bg-bg-white-0 p-4">
      <h3 className="font-serif text-lg font-normal text-text-strong-950">
        {formatMessage({
          id: "public.vaults.manage.card.restoreTitle",
          defaultMessage: "Restore email wallet to redeem",
        })}
      </h3>
      <p className="mt-2 text-sm leading-[1.55] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.manage.card.restoreBody",
          defaultMessage:
            "Viewing is read-only. To redeem shares, restore the email wallet that owns this position.",
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
          <p className="rounded-xl bg-primary-action/10 p-3 text-xs leading-[1.5] text-primary-base">
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
              defaultMessage: "Restore email wallet",
            })}
          </EditorialGhostButton>
        </form>
      ) : null}

      {error ? (
        <p className="mt-3 rounded-xl bg-error-lighter/30 p-3 text-xs leading-[1.5] text-error-base">
          {error}
        </p>
      ) : null}
    </section>
  );
}
