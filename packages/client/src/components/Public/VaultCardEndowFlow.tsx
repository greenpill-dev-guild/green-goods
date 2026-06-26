import {
  buildPublicFundingAvailabilityKey,
  PUBLIC_AGENT_ROUTES,
  type SubmitFundingIntentProofResponse,
} from "@green-goods/shared/public-contracts";
import {
  prepareOctantVaultCardEndowFallbackPlan,
  getOctantVaultAssetDisplayPolicy,
  rememberOctantVaultCardWalletPosition,
  useTimeout,
  type Address,
  type OctantVaultCampaignManifest,
} from "@green-goods/shared";
import { type FormEvent, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useIntl } from "react-intl";
import {
  createThirdwebClient,
  getContract,
  prepareContractCall,
  readContract,
  waitForReceipt,
  type ThirdwebClient,
} from "thirdweb";
import { defineChain, ethereum } from "thirdweb/chains";
import {
  ThirdwebProvider,
  useConnect,
  useSendAndConfirmTransaction,
  useSendBatchTransaction,
} from "thirdweb/react";
import { inAppWallet, preAuthenticate } from "thirdweb/wallets/in-app";
import { isAddress } from "viem";
import VaultCardPaymentPanel from "./VaultCardPaymentPanel";
import type { VaultCheckoutGuardState } from "./VaultCheckoutDialog";
import {
  CHECKOUT_FIELD_LABEL,
  CHECKOUT_GHOST_BUTTON,
  CHECKOUT_INPUT,
  CHECKOUT_PRIMARY_BUTTON,
  CheckoutStageHeader,
  CheckoutScreen,
  CheckoutSummary,
  CheckoutTransactionDetails,
  getAddressExplorerUrl,
  getEthereumNetworkLabel,
  getTxExplorerUrl,
  getVaultCheckoutTransactionLabel,
  type CheckoutSummaryItem,
} from "./vaultCheckoutShell";

const VAULT_CARD_SETTLEMENT_SLOW_WARNING_MS = 90_000;

function getAgentApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || "";
}

function getThirdwebClientId(): string {
  return import.meta.env.VITE_THIRDWEB_CLIENT_ID?.trim() ?? "";
}

function getThirdwebChain(chainId: number) {
  return chainId === ethereum.id ? ethereum : defineChain(chainId);
}

function supportsCardEndowBatch(chainId: number) {
  return chainId === ethereum.id || chainId === 11155111;
}

function getInAppWalletAdminAddress(wallet: unknown): Address | null {
  const getAdminAccount = (wallet as { getAdminAccount?: unknown }).getAdminAccount;
  if (typeof getAdminAccount !== "function") return null;
  const account = getAdminAccount.call(wallet) as { address?: unknown } | undefined;
  return typeof account?.address === "string" && isAddress(account.address)
    ? (account.address as Address)
    : null;
}

function getTransactionHash(result: unknown): `0x${string}` | null {
  if (!result || typeof result !== "object") return null;
  const candidate = (result as { transactionHash?: unknown }).transactionHash;
  return typeof candidate === "string" && candidate.startsWith("0x")
    ? (candidate as `0x${string}`)
    : null;
}

/**
 * Render-only view of where the Card Endow ceremony is. Derived strictly from the
 * authoritative booleans below — it never owns amount, receiver, lock, or status
 * state; it only decides which single step to show. A failed step resets its own
 * status to idle, so the derivation naturally holds the stage and the inline
 * error renders in place. `blocked` is the degraded branch when a recovered
 * wallet exists but the campaign manifest cannot produce a ready plan.
 *
 * The donor sees three stages: `recover` (Step 1 — verify email wallet),
 * `fund` (Step 2 — secure card payment), and `settle` (Step 3 — vault deposit
 * and proof, entered only after the payment proof gates pass). `done` is the
 * completed end of Step 3.
 */
type CardEndowStage = "recover" | "blocked" | "fund" | "settle" | "done";
type CardEndowBatchStatus = "idle" | "unsupported" | "pending" | "failed" | "succeeded";

export interface VaultCardEndowFlowProps {
  campaign: OctantVaultCampaignManifest;
  /** Base-unit amount selected in the checkout dialog before the card path opens. */
  amount: bigint;
  /** Decisions already made (amount, method) — shown as a compact summary strip. */
  summaryItems: CheckoutSummaryItem[];
  /** Step back to the amount/method configure step (only while inputs are unlocked). */
  onBack: () => void;
  /** Close the checkout sheet once the endowment is complete. */
  onComplete: () => void;
  /** Hand off to `/vaults?manage=positions` after the card position is confirmed. */
  onManagePositions?: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}

/**
 * VaultCardEndowFlow — the Card payment path for the /vaults checkout sheet.
 *
 * Mounted (lazily) only once a valid amount exists and the user chose Card. Renders
 * one focused step at a time inside the fixed-height sheet, keeping every Card Endow
 * safety gate: email verification first, then the Green Goods-owned card payment
 * panel (headless Bridge.Onramp checkout) where the route facts render beside the
 * explicit "open checkout" consent click, strict WETH approve -> deposit ordering,
 * and proof only after a positive `vault.balanceOf(receiver)` read.
 */
export default function VaultCardEndowFlow({
  campaign,
  amount,
  summaryItems,
  onBack,
  onComplete,
  onManagePositions,
  onCheckoutGuardChange,
}: VaultCardEndowFlowProps) {
  const { formatMessage } = useIntl();
  const clientId = getThirdwebClientId();
  const client = useMemo<ThirdwebClient | null>(() => {
    if (!clientId) return null;
    return createThirdwebClient({ clientId });
  }, [clientId]);

  if (!client) {
    return (
      <CheckoutScreen
        footer={
          <button type="button" onClick={onBack} className={CHECKOUT_GHOST_BUTTON}>
            {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
          </button>
        }
      >
        <p
          role="alert"
          className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base"
        >
          {formatMessage({
            id: "public.vaults.cardEndow.missingClientId",
            defaultMessage:
              "Card checkout is not available on this domain yet. Please choose wallet or try again later.",
          })}
        </p>
      </CheckoutScreen>
    );
  }

  return (
    <ThirdwebProvider>
      <CardEndowProviderContent
        campaign={campaign}
        amount={amount}
        client={client}
        summaryItems={summaryItems}
        onBack={onBack}
        onComplete={onComplete}
        onManagePositions={onManagePositions}
        onCheckoutGuardChange={onCheckoutGuardChange}
      />
    </ThirdwebProvider>
  );
}

function CardEndowProviderContent({
  campaign,
  amount,
  client,
  summaryItems,
  onBack,
  onComplete,
  onManagePositions,
  onCheckoutGuardChange,
}: {
  campaign: OctantVaultCampaignManifest;
  amount: bigint;
  client: ThirdwebClient;
  summaryItems: CheckoutSummaryItem[];
  onBack: () => void;
  onComplete: () => void;
  onManagePositions?: () => void;
  onCheckoutGuardChange: (guard: VaultCheckoutGuardState) => void;
}) {
  const { formatMessage } = useIntl();
  const emailInputId = useId();
  const emailHelpId = useId();
  const emailStatusId = useId();
  const emailFormId = useId();
  const otpInputId = useId();
  const otpHelpId = useId();
  const otpFormId = useId();
  const otpRef = useRef<HTMLInputElement>(null);
  const [emailInput, setEmailInput] = useState("");
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [recoveredWalletAddress, setRecoveredWalletAddress] = useState<Address | null>(null);
  // Reported by the payment panel: a provider session is preparing or prepared,
  // so checkout edits must lock while a live card payment could land.
  const [paymentSessionActive, setPaymentSessionActive] = useState(false);
  const [cardFundingStatus, setCardFundingStatus] = useState<"idle" | "funded">("idle");
  // The native-ETH shortfall (reported by the pay panel) the settlement must wrap
  // into WETH before approve+deposit — 0n when the onramp already delivered enough
  // WETH. `wrapStatus` tracks the sequential-fallback wrap so a retry never wraps
  // twice; the batch path is atomic and needs no such guard.
  const [wrapAmount, setWrapAmount] = useState<bigint>(0n);
  const [wrapStatus, setWrapStatus] = useState<"idle" | "pending" | "wrapped">("idle");
  const [batchStatus, setBatchStatus] = useState<CardEndowBatchStatus>("idle");
  const [approvalStatus, setApprovalStatus] = useState<"idle" | "pending" | "approved">("idle");
  const [depositStatus, setDepositStatus] = useState<"idle" | "pending" | "deposited">("idle");
  const [depositTxHash, setDepositTxHash] = useState<`0x${string}` | null>(null);
  const [shareBalance, setShareBalance] = useState<bigint | null>(null);
  const [proofStatus, setProofStatus] = useState<"idle" | "submitting" | "recorded" | "error">(
    "idle"
  );
  const [proofError, setProofError] = useState<string | null>(null);
  const [flowError, setFlowError] = useState<string | null>(null);
  // Recovery affordance: surface a "taking longer" note + unlock close on a stall.
  const [slow, setSlow] = useState(false);
  const { set: scheduleSlow, clear: clearSlow } = useTimeout();
  const { connect, error: connectError, isConnecting } = useConnect();
  const sendBatchTransaction = useSendBatchTransaction();
  const sendAndConfirmTransaction = useSendAndConfirmTransaction({ payModal: false });
  const hasReadyAmount = amount > 0n;
  const chainId = campaign.vault?.chainId ?? ethereum.id;
  const chain = useMemo(() => getThirdwebChain(chainId), [chainId]);
  const receiverAddress =
    recoveredWalletAddress && isAddress(recoveredWalletAddress) ? recoveredWalletAddress : null;
  const flowKey = `${campaign.slug}:${amount.toString()}:${receiverAddress ?? ""}`;
  const flowKeyRef = useRef(flowKey);
  flowKeyRef.current = flowKey;
  const isCurrentFlow = useCallback((candidate: string) => flowKeyRef.current === candidate, []);
  const fallbackPreparation = useMemo(() => {
    if (!hasReadyAmount || !receiverAddress) return null;

    return prepareOctantVaultCardEndowFallbackPlan({
      campaign,
      amount: amount.toString(),
      receiverAddress,
    });
  }, [campaign, hasReadyAmount, amount, receiverAddress]);
  const plan = fallbackPreparation?.status === "ready" ? fallbackPreparation.plan : undefined;
  const canSendEmailCode =
    Boolean(client) && hasReadyAmount && emailInput.trim().includes("@") && !otpSent;
  const canVerifyEmailWallet =
    Boolean(client) &&
    hasReadyAmount &&
    otpSent &&
    otpEmail === emailInput.trim() &&
    emailInput.trim().includes("@") &&
    otpInput.trim().length > 0;
  const completeBusy =
    batchStatus === "pending" ||
    approvalStatus === "pending" ||
    depositStatus === "pending" ||
    sendBatchTransaction.isPending ||
    sendAndConfirmTransaction.isPending;
  const fallbackAvailable = batchStatus === "failed" || batchStatus === "unsupported";
  // One action runs approve -> deposit; retry resumes at deposit when already approved.
  const canCompleteEndowment = Boolean(
    plan &&
      cardFundingStatus === "funded" &&
      fallbackAvailable &&
      depositStatus !== "deposited" &&
      !completeBusy
  );
  const hasPositiveShares = shareBalance !== null && shareBalance > 0n;
  const valuePathStarted =
    cardFundingStatus === "funded" ||
    approvalStatus !== "idle" ||
    depositStatus !== "idle" ||
    depositTxHash !== null ||
    shareBalance !== null ||
    proofStatus !== "idle";
  const transactionPending =
    batchStatus === "pending" ||
    approvalStatus === "pending" ||
    depositStatus === "pending" ||
    proofStatus === "submitting" ||
    sendBatchTransaction.isPending ||
    sendAndConfirmTransaction.isPending;
  // Lock only once a card payment could actually land (session preparing/prepared
  // or value path started) — landing on the pay screen alone must keep Back alive.
  const checkoutInputsLocked = Boolean(
    paymentSessionActive || valuePathStarted || transactionPending
  );

  // Render-only stage derivation (read state, never own it). Highest first.
  // `cardFundingStatus === "funded"` means every payment proof gate passed
  // (exact quote, COMPLETED + tuple, covering WETH/ETH balance) — only then does
  // the donor reach Step 3 settlement (which wraps any ETH shortfall first).
  const stage: CardEndowStage =
    depositStatus === "deposited"
      ? "done"
      : receiverAddress && plan && cardFundingStatus === "funded"
        ? "settle"
        : receiverAddress && plan
          ? "fund"
          : receiverAddress
            ? "blocked"
            : "recover";

  // Switching campaign (a fresh checkout) clears every Card Endow gate.
  useEffect(() => {
    setEmailInput("");
    setOtpEmail(null);
    setVerifiedEmail(null);
    setOtpInput("");
    setOtpSent(false);
    setRecoveredWalletAddress(null);
    setPaymentSessionActive(false);
    setCardFundingStatus("idle");
    setWrapAmount(0n);
    setWrapStatus("idle");
    setBatchStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, [campaign.slug]);

  // A changed amount or recovered wallet invalidates downstream proof gates, but
  // never the email/recovered-wallet inputs themselves — inline errors only set
  // `flowError`, so a failed step keeps the user's progress intact.
  useEffect(() => {
    setCardFundingStatus("idle");
    setWrapAmount(0n);
    setWrapStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, [amount, recoveredWalletAddress]);

  useEffect(() => {
    onCheckoutGuardChange({
      inputsLocked: checkoutInputsLocked,
      closeLocked: transactionPending && !slow,
    });
    return () =>
      onCheckoutGuardChange({
        inputsLocked: false,
        closeLocked: false,
      });
  }, [checkoutInputsLocked, onCheckoutGuardChange, transactionPending, slow]);

  // Recovery affordance: if a transaction is still in flight after a while, surface
  // a "taking longer" note and unlock close so the user is never stranded.
  useEffect(() => {
    if (!transactionPending) {
      clearSlow();
      setSlow(false);
      return;
    }
    return scheduleSlow(() => setSlow(true), VAULT_CARD_SETTLEMENT_SLOW_WARNING_MS);
  }, [transactionPending, scheduleSlow, clearSlow]);

  // Keyboard continuity: once a fresh code is sent, move focus to the OTP field so
  // a keyboard user is not stranded between the email and verification steps.
  useEffect(() => {
    if (otpSent) otpRef.current?.focus();
  }, [otpSent]);

  const resetRecoveredWalletFlow = useCallback(() => {
    setOtpInput("");
    setOtpSent(false);
    setOtpEmail(null);
    setVerifiedEmail(null);
    setRecoveredWalletAddress(null);
    setPaymentSessionActive(false);
    setCardFundingStatus("idle");
    setWrapAmount(0n);
    setWrapStatus("idle");
    setBatchStatus("idle");
    setApprovalStatus("idle");
    setDepositStatus("idle");
    setDepositTxHash(null);
    setShareBalance(null);
    setProofStatus("idle");
    setProofError(null);
    setFlowError(null);
  }, []);

  const handleEmailInputChange = useCallback(
    (nextEmail: string) => {
      setEmailInput(nextEmail);
      setFlowError(null);
      if (
        otpSent ||
        otpEmail !== null ||
        verifiedEmail !== null ||
        recoveredWalletAddress !== null
      ) {
        resetRecoveredWalletFlow();
      }
    },
    [otpEmail, otpSent, recoveredWalletAddress, resetRecoveredWalletFlow, verifiedEmail]
  );

  const handleSendEmailCode = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canSendEmailCode) return;

      const email = emailInput.trim();
      setFlowError(null);
      try {
        await preAuthenticate({
          client,
          strategy: "email",
          email,
        });
        setOtpInput("");
        setOtpEmail(email);
        setVerifiedEmail(null);
        setRecoveredWalletAddress(null);
        setOtpSent(true);
      } catch (error) {
        setFlowError(error instanceof Error ? error.message : "Email code could not be sent.");
      }
    },
    [canSendEmailCode, client, emailInput]
  );

  const handleVerifyEmailWallet = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!canVerifyEmailWallet) return;

      const email = emailInput.trim();
      setFlowError(null);
      try {
        await connect(async () => {
          const wallet = inAppWallet({
            auth: { options: ["email"] },
            ...(supportsCardEndowBatch(chainId)
              ? {
                  executionMode: {
                    mode: "EIP7702",
                    sponsorGas: true,
                  },
                }
              : {}),
            metadata: { name: "Green Goods" },
          });
          const account = await wallet.connect({
            client,
            chain,
            strategy: "email",
            email,
            verificationCode: otpInput.trim(),
          });

          if (!isAddress(account.address)) {
            throw new Error("Email wallet did not return a valid receiver address.");
          }

          const recoveredAddress = account.address as Address;
          const walletAdminAddress = getInAppWalletAdminAddress(wallet);
          setRecoveredWalletAddress(recoveredAddress);
          setBatchStatus(
            supportsCardEndowBatch(chainId) &&
              walletAdminAddress !== null &&
              account.address.toLowerCase() === walletAdminAddress.toLowerCase()
              ? "idle"
              : "unsupported"
          );
          setVerifiedEmail(email);
          return wallet;
        });
      } catch (error) {
        setFlowError(
          error instanceof Error
            ? error.message
            : "Email wallet verification could not be completed."
        );
      }
    },
    [canVerifyEmailWallet, chain, chainId, client, connect, emailInput, otpInput]
  );

  const readShareBalance = useCallback(
    async (expectedFlowKey = flowKey): Promise<bigint | null> => {
      if (!plan) return null;

      const vaultContract = getContract({
        client,
        chain,
        address: plan.receiptExpectation.expectedVaultAddress,
      });
      const result = await readContract({
        contract: vaultContract,
        method: "function balanceOf(address account) view returns (uint256)",
        params: [plan.receiptExpectation.receiverAddress],
      });
      const shares = typeof result === "bigint" ? result : BigInt(String(result ?? "0"));
      if (!isCurrentFlow(expectedFlowKey)) return null;
      setShareBalance(shares);
      return shares;
    },
    [chain, client, flowKey, isCurrentFlow, plan]
  );

  const submitFundingProof = useCallback(
    async (transactionHash: `0x${string}`, shares: bigint, expectedFlowKey = flowKey) => {
      if (!plan || !campaign.vault?.asset || shares <= 0n || !isCurrentFlow(expectedFlowKey)) {
        return;
      }

      setProofStatus("submitting");
      setProofError(null);
      const availabilityKey = buildPublicFundingAvailabilityKey({
        gardenKey: campaign.slug,
        destinationType: "vault",
        destinationAddress: plan.receiptExpectation.expectedVaultAddress,
        fundingIntent: "endow",
        paymentMethod: "card",
        chainId: plan.cardFunding.chainId,
        token: plan.receiptExpectation.expectedTokenAddress,
        provider: "thirdweb",
        sourceRoute: "/vaults",
      });

      try {
        const response = await fetch(
          `${getAgentApiBaseUrl()}${PUBLIC_AGENT_ROUTES.fundingIntentProof}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              gardenId: campaign.slug,
              gardenName: campaign.displayName,
              destinationType: "vault",
              destinationAddress: plan.receiptExpectation.expectedVaultAddress,
              fundingIntent: "endow",
              paymentMethod: "card",
              provider: "thirdweb",
              sourceRoute: "/vaults",
              chainId: plan.cardFunding.chainId,
              token: plan.receiptExpectation.expectedTokenAddress,
              availabilityKey,
              clientRequestId: [
                "card-endow-proof",
                campaign.slug,
                plan.receiptExpectation.receiverAddress,
                transactionHash,
              ].join(":"),
              receiverAddress: plan.receiptExpectation.receiverAddress,
              receiverCustody: "user_owned_recovered_wallet",
              amount: plan.receiptExpectation.expectedAmount,
              transactionHash,
              shareBalance: shares.toString(),
              payerEmail: verifiedEmail ?? undefined,
              locale: "en",
            }),
          }
        );
        const json = (await response.json()) as SubmitFundingIntentProofResponse;
        if (!response.ok || !("ok" in json) || !json.ok) {
          throw new Error(
            "message" in json ? json.message : "Funding proof could not be recorded."
          );
        }
        if (isCurrentFlow(expectedFlowKey)) setProofStatus("recorded");
      } catch (error) {
        if (!isCurrentFlow(expectedFlowKey)) return;
        setProofStatus("error");
        setProofError(
          error instanceof Error ? error.message : "Funding proof could not be recorded."
        );
      }
    },
    [
      campaign.displayName,
      campaign.slug,
      campaign.vault?.asset,
      flowKey,
      isCurrentFlow,
      plan,
      verifiedEmail,
    ]
  );

  // Build the settlement transactions: an optional ETH -> WETH wrap (when the
  // onramp left native ETH in the recovered wallet) followed by the strict
  // approve -> deposit pair. `wethContract` is the canonical WETH token (the vault
  // asset), so `deposit(){value}` wraps and `approve(...)` authorizes the vault to
  // pull WETH. The wrap, when present, must run first.
  const createSettlementTransactions = useCallback(() => {
    if (!plan) return null;

    const wethContract = getContract({
      client,
      chain,
      address: plan.cardFunding.tokenAddress,
    });
    const wrapTransaction =
      wrapAmount > 0n
        ? prepareContractCall({
            contract: wethContract,
            method: "function deposit()",
            params: [],
            value: wrapAmount,
          })
        : null;
    const approveTransaction = prepareContractCall({
      contract: wethContract,
      method: "function approve(address spender, uint256 value)",
      params: [plan.receiptExpectation.expectedVaultAddress, BigInt(plan.cardFunding.amount)],
    });
    const vaultContract = getContract({
      client,
      chain,
      address: plan.receiptExpectation.expectedVaultAddress,
    });
    const depositTransaction = prepareContractCall({
      contract: vaultContract,
      method: "function deposit(uint256 assets, address receiver) returns (uint256)",
      params: [BigInt(plan.cardFunding.amount), plan.receiptExpectation.receiverAddress],
    });

    return {
      batch: wrapTransaction
        ? [wrapTransaction, approveTransaction, depositTransaction]
        : [approveTransaction, depositTransaction],
      wrapTransaction,
      approveTransaction,
      depositTransaction,
    };
  }, [chain, client, plan, wrapAmount]);

  const handleBatchEndowment = useCallback(async () => {
    if (!plan || cardFundingStatus !== "funded" || batchStatus !== "idle") return;

    const settlement = createSettlementTransactions();
    if (!settlement) return;

    const expectedFlowKey = flowKey;
    setFlowError(null);
    try {
      setBatchStatus("pending");
      setApprovalStatus("pending");
      setDepositStatus("pending");
      // The batch is atomic — wrap (if any) + approve + deposit all-or-nothing, so
      // a retry after failure re-runs cleanly without partial-wrap risk.
      const waitOptions = await sendBatchTransaction.mutateAsync([...settlement.batch]);
      const receipt = await waitForReceipt(waitOptions);
      if (receipt.status === "reverted") {
        throw new Error("Batch transaction reverted.");
      }
      const txHash = getTransactionHash(receipt) ?? getTransactionHash(waitOptions);
      if (txHash === null) {
        throw new Error("Batch transaction receipt did not include a transaction hash.");
      }
      if (!isCurrentFlow(expectedFlowKey)) return;
      setBatchStatus("succeeded");
      setApprovalStatus("approved");
      setDepositTxHash(txHash);
      setDepositStatus("deposited");
      const shares = await readShareBalance(expectedFlowKey);
      // txHash is already non-null here — the missing-hash branch above throws.
      if (shares !== null && shares > 0n) {
        await submitFundingProof(txHash, shares, expectedFlowKey);
      }
    } catch {
      if (!isCurrentFlow(expectedFlowKey)) return;
      setBatchStatus("failed");
      setApprovalStatus("idle");
      setDepositStatus("idle");
      setFlowError(
        formatMessage({
          id: "public.vaults.cardEndow.autoDepositFailed",
          defaultMessage:
            "We couldn't finish the endowment automatically. Use the button below to finish it.",
        })
      );
    }
  }, [
    batchStatus,
    cardFundingStatus,
    createSettlementTransactions,
    formatMessage,
    flowKey,
    isCurrentFlow,
    plan,
    readShareBalance,
    sendBatchTransaction,
    submitFundingProof,
  ]);

  useEffect(() => {
    if (
      !plan ||
      cardFundingStatus !== "funded" ||
      batchStatus !== "idle" ||
      depositStatus === "deposited"
    ) {
      return;
    }
    void handleBatchEndowment();
  }, [batchStatus, cardFundingStatus, depositStatus, handleBatchEndowment, plan]);

  // Fallback keeps the current approve -> deposit ordering available inline when
  // batching is unsupported or the smart-account batch fails.
  const handleCompleteEndowment = useCallback(async () => {
    if (!plan || !canCompleteEndowment) return;

    const settlement = createSettlementTransactions();
    if (!settlement) return;
    const { wrapTransaction, approveTransaction, depositTransaction } = settlement;
    const expectedFlowKey = flowKey;
    setFlowError(null);
    try {
      // Wrap ETH -> WETH first, and exactly once: a retry after a later step fails
      // must not re-wrap and over-spend the recovered wallet's ETH.
      if (wrapTransaction && wrapStatus !== "wrapped") {
        setWrapStatus("pending");
        await sendAndConfirmTransaction.mutateAsync(wrapTransaction);
        if (!isCurrentFlow(expectedFlowKey)) return;
        setWrapStatus("wrapped");
      }

      if (approvalStatus !== "approved") {
        setApprovalStatus("pending");
        await sendAndConfirmTransaction.mutateAsync(approveTransaction);
        if (!isCurrentFlow(expectedFlowKey)) return;
        setApprovalStatus("approved");
      }

      setDepositStatus("pending");
      const result = await sendAndConfirmTransaction.mutateAsync(depositTransaction);
      const txHash = getTransactionHash(result);
      if (!isCurrentFlow(expectedFlowKey)) return;
      setDepositTxHash(txHash);
      setDepositStatus("deposited");
      const shares = await readShareBalance(expectedFlowKey);
      if (txHash !== null && shares !== null && shares > 0n) {
        await submitFundingProof(txHash, shares, expectedFlowKey);
      }
    } catch (error) {
      if (!isCurrentFlow(expectedFlowKey)) return;
      // Keep a confirmed wrap/approval so a retry only re-runs what's left.
      setWrapStatus((current) => (current === "pending" ? "idle" : current));
      setApprovalStatus((current) => (current === "pending" ? "idle" : current));
      setDepositStatus((current) => (current === "pending" ? "idle" : current));
      setFlowError(error instanceof Error ? error.message : "Endowment could not be completed.");
    }
  }, [
    approvalStatus,
    canCompleteEndowment,
    createSettlementTransactions,
    flowKey,
    isCurrentFlow,
    plan,
    readShareBalance,
    sendAndConfirmTransaction,
    submitFundingProof,
    wrapStatus,
  ]);

  useEffect(() => {
    if (
      depositTxHash === null ||
      !hasPositiveShares ||
      shareBalance === null ||
      proofStatus !== "idle"
    ) {
      return;
    }
    void submitFundingProof(depositTxHash, shareBalance);
  }, [depositTxHash, hasPositiveShares, proofStatus, shareBalance, submitFundingProof]);

  // Once shares are confirmed, remember ONLY the safe owner metadata so the
  // `/vaults?manage=positions` surface can re-display this card-wallet position
  // when the supporter returns. The confirmed write upserts over any
  // pending-funded entry for the same (wallet, vault). Never caches email, OTP,
  // provider IDs, or receipts.
  useEffect(() => {
    if (!hasPositiveShares || !receiverAddress) return;
    const vaultAddress = campaign.vault?.vaultAddress;
    const chainId = campaign.vault?.chainId;
    if (!vaultAddress || !chainId) return;
    rememberOctantVaultCardWalletPosition({
      recoveredWalletAddress: receiverAddress,
      campaignSlug: campaign.slug,
      vaultAddress,
      chainId,
      status: "confirmed",
    });
  }, [
    hasPositiveShares,
    receiverAddress,
    campaign.slug,
    campaign.vault?.vaultAddress,
    campaign.vault?.chainId,
  ]);

  // Pending-funded recovery tuple — ONLY safe public metadata — so a supporter
  // who drops off between card funding and the finished deposit can resume from
  // `/vaults?manage=positions`. Written as soon as the payment is provably
  // COMPLETED with a valid tuple (funds may still be in transit), refreshed when
  // the covering WETH balance is proven, and upserted to confirmed on shares.
  const rememberPendingFundedRecovery = useCallback(() => {
    const vaultAddress = campaign.vault?.vaultAddress;
    const chainId = campaign.vault?.chainId;
    if (!plan || !receiverAddress || !vaultAddress || !chainId) return;
    rememberOctantVaultCardWalletPosition({
      recoveredWalletAddress: receiverAddress,
      campaignSlug: campaign.slug,
      vaultAddress,
      chainId,
      tokenAddress: plan.cardFunding.tokenAddress,
      expectedAmount: plan.cardFunding.amount,
      status: "pending_funded",
    });
  }, [campaign.slug, campaign.vault?.vaultAddress, campaign.vault?.chainId, plan, receiverAddress]);

  // Provider payment proven (COMPLETED + non-contradicting tuple) — persist the
  // recovery entry even though the WETH may not have landed yet.
  const handlePaymentCompleted = useCallback(() => {
    if (!isCurrentFlow(flowKey)) return;
    rememberPendingFundedRecovery();
  }, [flowKey, isCurrentFlow, rememberPendingFundedRecovery]);

  // Every payment proof gate passed (exact quote + COMPLETED tuple + covering
  // WETH/ETH balance) — store the native-ETH shortfall to wrap during settlement,
  // refresh the recovery entry, and enter Step 3 settlement.
  const handleCardFundingSuccess = useCallback(
    (nextWrapAmount: bigint) => {
      const expectedFlowKey = flowKey;
      if (!isCurrentFlow(expectedFlowKey)) return;
      setFlowError(null);
      setWrapAmount(nextWrapAmount);
      rememberPendingFundedRecovery();
      setCardFundingStatus("funded");
    },
    [flowKey, isCurrentFlow, rememberPendingFundedRecovery]
  );

  // ── Render helpers ─────────────────────────────────────────────────────────
  const canEditCheckout = !checkoutInputsLocked;
  const assetDisplay = getOctantVaultAssetDisplayPolicy(
    plan?.cardFunding.tokenSymbol ?? campaign.vault?.asset?.symbol
  );

  const cardSummaryItems: CheckoutSummaryItem[] = [
    ...summaryItems,
    ...(verifiedEmail
      ? [
          {
            label: formatMessage({
              id: "public.vaults.cardEndow.emailLabel",
              defaultMessage: "Email",
            }),
            value: verifiedEmail,
          },
        ]
      : []),
    ...(receiverAddress
      ? [
          {
            label: formatMessage({
              id: "public.vaults.cardEndow.positionHolder",
              defaultMessage: "Endowment",
            }),
            value: formatMessage({
              id: "public.vaults.cardEndow.positionHolderValue",
              defaultMessage: "Verified email wallet",
            }),
          },
        ]
      : []),
  ];

  const backButton = canEditCheckout ? (
    <button type="button" onClick={onBack} className={CHECKOUT_GHOST_BUTTON}>
      {formatMessage({ id: "public.vaults.checkout.back", defaultMessage: "Back" })}
    </button>
  ) : null;

  // Route facts shown beside the payment CTA — the donor reviews the destination
  // on the same screen where the explicit "open checkout" consent click lives.
  const vaultExplorerUrl = plan
    ? getAddressExplorerUrl(
        campaign.vault?.explorerLink,
        plan.receiptExpectation.expectedVaultAddress
      )
    : null;
  const tokenExplorerUrl = plan
    ? getAddressExplorerUrl(campaign.vault?.explorerLink, plan.cardFunding.tokenAddress)
    : null;
  const planDetails = plan ? (
    <div className="flex flex-col gap-4" data-testid="vault-card-endow-plan-details">
      <p className="text-sm leading-[1.6] text-text-sub-600">
        {formatMessage({
          id: "public.vaults.cardEndow.authorizationOrder",
          defaultMessage: "Your card payment can finish this endowment after checkout succeeds.",
        })}
      </p>
      <CheckoutTransactionDetails
        className="pt-4"
        label={formatMessage({
          id: "public.vaults.checkout.technicalDetails",
          defaultMessage: "Transaction details",
        })}
      >
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.cardEndow.tupleChain",
                defaultMessage: "Ethereum network",
              })}
            </dt>
            <dd className="text-text-sub-600">
              {getEthereumNetworkLabel(plan.cardFunding.chainId, formatMessage)}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.cardEndow.tupleVault",
                defaultMessage: "Octant vault",
              })}
            </dt>
            <dd className="break-all font-mono text-xs text-text-sub-600">
              {vaultExplorerUrl ? (
                <a
                  href={vaultExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                >
                  {plan.receiptExpectation.expectedVaultAddress}
                </a>
              ) : (
                plan.receiptExpectation.expectedVaultAddress
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.cardEndow.tupleToken",
                defaultMessage: "WETH token",
              })}
            </dt>
            <dd className="break-all text-text-sub-600">
              {assetDisplay.technicalSymbol} ·{" "}
              {tokenExplorerUrl ? (
                <a
                  href={tokenExplorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
                >
                  {plan.cardFunding.tokenAddress}
                </a>
              ) : (
                <span className="font-mono text-xs">{plan.cardFunding.tokenAddress}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-text-strong-950">
              {formatMessage({
                id: "public.vaults.cardEndow.checkoutWallet",
                defaultMessage: "Checkout wallet",
              })}
            </dt>
            <dd className="break-all font-mono text-xs text-text-sub-600">
              {plan.receiptExpectation.receiverAddress}
            </dd>
          </div>
        </dl>
      </CheckoutTransactionDetails>
    </div>
  ) : null;

  const errorNotes = (
    <>
      {connectError ? (
        <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {connectError.message}
        </p>
      ) : null}
      {flowError ? (
        <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
          {flowError}
        </p>
      ) : null}
    </>
  );

  // Inline Step 3 fallback: when the EIP-7702 batch is unsupported or failed,
  // the ordered approve -> deposit pair stays available as one explicit action.
  const fallbackTransactionTotal = wrapAmount > 0n ? 3 : 2;
  const fallbackApprovalStep = fallbackTransactionTotal === 3 ? 2 : 1;
  const fallbackDepositStep = fallbackTransactionTotal === 3 ? 3 : 2;
  const fallbackWrapLabel = getVaultCheckoutTransactionLabel(formatMessage, "wrap", 1, 3);
  const fallbackApprovalLabel = getVaultCheckoutTransactionLabel(
    formatMessage,
    "approval",
    fallbackApprovalStep,
    fallbackTransactionTotal
  );
  const fallbackDepositLabel = getVaultCheckoutTransactionLabel(
    formatMessage,
    "deposit",
    fallbackDepositStep,
    fallbackTransactionTotal
  );
  const fallbackButtonLabel =
    wrapStatus === "pending" || (wrapAmount > 0n && wrapStatus !== "wrapped")
      ? fallbackWrapLabel
      : depositStatus === "pending" || approvalStatus === "approved"
        ? fallbackDepositLabel
        : fallbackApprovalLabel;
  const fallbackButton =
    stage === "settle" && fallbackAvailable ? (
      <button
        type="button"
        disabled={!canCompleteEndowment}
        className={CHECKOUT_PRIMARY_BUTTON}
        onClick={handleCompleteEndowment}
      >
        {fallbackButtonLabel}
      </button>
    ) : null;

  const statusBlock = (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-testid="vault-card-endow-status-block"
      className="grid gap-2 rounded-none bg-bg-weak-50 p-4 text-sm"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-strong-950">
          {formatMessage({
            id: "public.vaults.cardEndow.status.payment",
            defaultMessage: "Payment",
          })}
        </span>
        <span className="text-right text-text-sub-600">
          {cardFundingStatus === "funded"
            ? formatMessage({
                id: "public.vaults.cardEndow.status.paymentComplete",
                defaultMessage: "Payment confirmed",
              })
            : formatMessage({
                id: "public.vaults.cardEndow.status.paymentPending",
                defaultMessage: "Waiting for payment",
              })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-strong-950">
          {formatMessage({
            id: "public.vaults.cardEndow.status.deposit",
            defaultMessage: "Endowment",
          })}
        </span>
        <span className="text-right text-text-sub-600">
          {depositStatus === "deposited"
            ? formatMessage({
                id: "public.vaults.cardEndow.status.depositComplete",
                defaultMessage: "Deposit sent",
              })
            : batchStatus === "pending" || depositStatus === "pending"
              ? formatMessage({
                  id: "public.vaults.cardEndow.status.depositing",
                  defaultMessage: "Finishing endowment",
                })
              : cardFundingStatus === "funded" && fallbackAvailable
                ? formatMessage({
                    id: "public.vaults.cardEndow.status.depositFallback",
                    defaultMessage: "Ready to finish",
                  })
                : formatMessage({
                    id: "public.vaults.cardEndow.status.depositWaiting",
                    defaultMessage: "Waiting for payment",
                  })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-strong-950">
          {formatMessage({
            id: "public.vaults.cardEndow.status.shares",
            defaultMessage: "Confirmation",
          })}
        </span>
        <span className="text-right text-text-sub-600">
          {hasPositiveShares
            ? formatMessage({
                id: "public.vaults.cardEndow.status.sharesConfirmed",
                defaultMessage: "Confirmed",
              })
            : depositStatus === "deposited"
              ? formatMessage({
                  id: "public.vaults.cardEndow.status.sharesPending",
                  defaultMessage: "Confirming",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.status.sharesWaiting",
                  defaultMessage: "Waiting to finish",
                })}
        </span>
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-text-strong-950">
          {formatMessage({
            id: "public.vaults.cardEndow.status.receipt",
            defaultMessage: "Receipt",
          })}
        </span>
        <span className="text-right text-text-sub-600">
          {proofStatus === "recorded"
            ? formatMessage({
                id: "public.vaults.cardEndow.status.receiptRecorded",
                defaultMessage: "Receipt recorded",
              })
            : proofStatus === "submitting"
              ? formatMessage({
                  id: "public.vaults.cardEndow.status.receiptRecording",
                  defaultMessage: "Recording receipt",
                })
              : formatMessage({
                  id: "public.vaults.cardEndow.status.receiptWaiting",
                  defaultMessage: "Waiting for confirmation",
                })}
        </span>
      </div>
    </div>
  );

  // ── recover: email + OTP ───────────────────────────────────────────────────
  if (stage === "recover") {
    return (
      <CheckoutScreen
        footer={
          <div className="flex flex-col gap-2">
            <button
              type="submit"
              form={otpSent ? otpFormId : emailFormId}
              disabled={otpSent ? !canVerifyEmailWallet || isConnecting : !canSendEmailCode}
              className={CHECKOUT_PRIMARY_BUTTON}
            >
              {otpSent
                ? formatMessage({
                    id: "public.vaults.cardEndow.verifyWallet",
                    defaultMessage: "Verify email",
                  })
                : formatMessage({
                    id: "public.vaults.cardEndow.sendCode",
                    defaultMessage: "Send email code",
                  })}
            </button>
            {backButton}
          </div>
        }
      >
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-flow">
          <CheckoutStageHeader
            eyebrow={formatMessage({
              id: "public.vaults.cardEndow.stage.recover.eyebrow",
              defaultMessage: "Step 1 of 3",
            })}
            title={formatMessage({
              id: "public.vaults.cardEndow.stage.recover.title",
              defaultMessage: "Verify your email",
            })}
            description={formatMessage({
              id: "public.vaults.cardEndow.stage.recover.description",
              defaultMessage:
                "We'll use your email to create a secure checkout wallet for this endowment.",
            })}
          />
          <CheckoutSummary items={cardSummaryItems} />

          <form id={emailFormId} className="grid gap-2" onSubmit={handleSendEmailCode}>
            <label htmlFor={emailInputId} className={CHECKOUT_FIELD_LABEL}>
              {formatMessage({ id: "public.vaults.cardEndow.emailLabel", defaultMessage: "Email" })}
            </label>
            <p id={emailHelpId} className="text-sm leading-[1.5] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.cardEndow.emailHelp",
                defaultMessage:
                  "Enter the email you want linked to this endowment. You'll use it later to manage or redeem it.",
              })}
            </p>
            <input
              id={emailInputId}
              value={emailInput}
              type="email"
              autoComplete="email"
              aria-describedby={otpSent ? `${emailHelpId} ${emailStatusId}` : emailHelpId}
              className={CHECKOUT_INPUT}
              placeholder="you@example.com"
              onChange={(event) => handleEmailInputChange(event.target.value)}
            />
          </form>

          {/* Mounted before the code is sent so the announcement lands in an
              existing live region; the code-entry form itself appears only after
              a code exists — no locked placeholder field beforehand. */}
          <div id={emailStatusId} aria-live="polite" aria-atomic="true">
            {otpSent && otpEmail ? (
              <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
                {formatMessage(
                  {
                    id: "public.vaults.cardEndow.emailCodeSent",
                    defaultMessage: "Code sent. Check {email} and enter the 6-digit code below.",
                  },
                  { email: otpEmail }
                )}
              </p>
            ) : null}
          </div>

          {otpSent ? (
            <form id={otpFormId} className="grid gap-2" onSubmit={handleVerifyEmailWallet}>
              <label htmlFor={otpInputId} className={CHECKOUT_FIELD_LABEL}>
                {formatMessage({
                  id: "public.vaults.cardEndow.otpLabel",
                  defaultMessage: "Email code",
                })}
              </label>
              <p id={otpHelpId} className="text-sm leading-[1.5] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.otpHelp",
                  defaultMessage: "Enter the 6-digit code from your email.",
                })}
              </p>
              <input
                ref={otpRef}
                id={otpInputId}
                value={otpInput}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-describedby={otpHelpId}
                className={CHECKOUT_INPUT}
                placeholder="123456"
                onChange={(event) => setOtpInput(event.target.value)}
              />
            </form>
          ) : null}

          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── blocked: recovered wallet exists but the manifest plan is not ready ────
  if (stage === "blocked") {
    return (
      <CheckoutScreen footer={backButton}>
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-blocked">
          <CheckoutSummary items={cardSummaryItems} />
          <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
            {formatMessage({
              id: "public.vaults.cardEndow.planBlocked",
              defaultMessage:
                "Card checkout is paused. Confirm the campaign, amount, and verified email before continuing.",
            })}
          </p>
          {errorNotes}
        </div>
      </CheckoutScreen>
    );
  }

  // ── fund: Green Goods-owned card payment panel (headless Bridge.Onramp) ────
  if (stage === "fund" && plan) {
    return (
      <VaultCardPaymentPanel
        client={client}
        plan={plan}
        campaign={campaign}
        summaryItems={cardSummaryItems}
        cardFundingComplete={cardFundingStatus === "funded"}
        statusBlock={statusBlock}
        planDetails={planDetails}
        backButton={backButton}
        onPaymentSessionActiveChange={setPaymentSessionActive}
        onPaymentCompleted={handlePaymentCompleted}
        onCardFundingSuccess={handleCardFundingSuccess}
        errorNotes={errorNotes}
      />
    );
  }

  // ── settle: Step 3 — vault deposit and proof ───────────────────────────────
  // Entered only after every payment proof gate passed. The ordered
  // approve -> deposit batch starts automatically; when batching is
  // unsupported or fails, the inline fallback button finishes the same
  // ordered pair. Errors stay route-local and recoverable.
  if (stage === "settle" && plan) {
    return (
      <CheckoutScreen footer={fallbackButton}>
        <div className="flex flex-col gap-5" data-testid="vault-card-endow-settle">
          <CheckoutStageHeader
            eyebrow={formatMessage({
              id: "public.vaults.cardEndow.stage.settle.eyebrow",
              defaultMessage: "Step 3 of 3",
            })}
            title={formatMessage({
              id: "public.vaults.cardEndow.stage.settle.title",
              defaultMessage: "Finish endowment",
            })}
            description={formatMessage({
              id: "public.vaults.cardEndow.stage.settle.description",
              defaultMessage:
                "Your card payment arrived. Now we'll finish the endowment and confirm it for this campaign.",
            })}
          />
          <CheckoutSummary items={cardSummaryItems} />
          {statusBlock}
          {slow ? (
            <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
              {formatMessage({
                id: "public.vaults.checkout.slow",
                defaultMessage:
                  "Confirmation is taking a little longer. Keep this open to follow the endowment as it finishes.",
              })}
            </p>
          ) : null}
          {errorNotes}
          {planDetails}
        </div>
      </CheckoutScreen>
    );
  }

  // ── done: positive-share proof + funding proof ─────────────────────────────
  const depositTxUrl = getTxExplorerUrl(campaign.vault?.explorerLink, depositTxHash);
  return (
    <CheckoutScreen
      footer={
        <div className="flex flex-col gap-2">
          {hasPositiveShares ? null : (
            <button
              type="button"
              className={CHECKOUT_GHOST_BUTTON}
              onClick={() => void readShareBalance()}
            >
              {formatMessage({
                id: "public.vaults.cardEndow.readShares",
                defaultMessage: "Check confirmation",
              })}
            </button>
          )}
          {onManagePositions && hasPositiveShares ? (
            <button type="button" className={CHECKOUT_PRIMARY_BUTTON} onClick={onManagePositions}>
              {formatMessage({
                id: "public.vaults.checkout.manageEndowments",
                defaultMessage: "Manage Endowments",
              })}
            </button>
          ) : null}
          <button
            type="button"
            className={
              onManagePositions && hasPositiveShares
                ? CHECKOUT_GHOST_BUTTON
                : CHECKOUT_PRIMARY_BUTTON
            }
            onClick={onComplete}
          >
            {formatMessage({ id: "public.vaults.checkout.done", defaultMessage: "Done" })}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-4" data-testid="vault-card-endow-flow">
        <CheckoutStageHeader
          eyebrow={formatMessage({
            id: "public.vaults.cardEndow.stage.done.eyebrow",
            defaultMessage: "Complete",
          })}
          title={formatMessage({
            id: "public.vaults.cardEndow.stage.done.title",
            defaultMessage: "Endowment complete",
          })}
          description={formatMessage({
            id: "public.vaults.cardEndow.stage.done.description",
            defaultMessage: "Your card endowment is confirmed for this campaign.",
          })}
        />
        <CheckoutSummary items={cardSummaryItems} />
        {statusBlock}
        {hasPositiveShares ? (
          <>
            <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage({
                id: "public.vaults.cardEndow.doneLead",
                defaultMessage:
                  "Endowment complete. You can manage or redeem it from Manage Endowments.",
              })}
            </p>
            <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
              {formatMessage(
                {
                  id: "public.vaults.cardEndow.positiveShares",
                  defaultMessage: "Endowment confirmed.",
                },
                { shares: shareBalance?.toString() ?? "0" }
              )}
            </p>
            {proofStatus === "submitting" ? (
              <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
                {formatMessage({
                  id: "public.vaults.cardEndow.proofSubmitting",
                  defaultMessage: "Recording receipt...",
                })}
              </p>
            ) : null}
            {proofStatus === "recorded" ? (
              <p className="rounded-none bg-primary-action/10 p-4 text-sm leading-[1.55] text-primary-base">
                {formatMessage({
                  id: "public.vaults.cardEndow.proofRecorded",
                  defaultMessage: "Receipt recorded.",
                })}
              </p>
            ) : null}
            {proofStatus === "error" ? (
              <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
                {proofError ??
                  formatMessage({
                    id: "public.vaults.cardEndow.proofFailed",
                    defaultMessage: "Receipt could not be recorded.",
                  })}
              </p>
            ) : null}
          </>
        ) : shareBalance !== null ? (
          <p className="rounded-none bg-error-lighter/30 p-4 text-sm leading-[1.55] text-error-base">
            {formatMessage({
              id: "public.vaults.cardEndow.noShares",
              defaultMessage:
                "We couldn't confirm this endowment yet. Refresh or check again in a moment.",
            })}
          </p>
        ) : (
          <p className="rounded-none bg-bg-weak-50 p-4 text-sm leading-[1.55] text-text-sub-600">
            {formatMessage({
              id: "public.vaults.cardEndow.verifyingShares",
              defaultMessage: "Confirming your endowment...",
            })}
          </p>
        )}
        {depositTxUrl ? (
          <a
            href={depositTxUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-semibold text-primary-base underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-action"
          >
            {formatMessage({
              id: "public.vaults.checkout.viewTransaction",
              defaultMessage: "View transaction",
            })}
          </a>
        ) : null}
        {errorNotes}
      </div>
    </CheckoutScreen>
  );
}
