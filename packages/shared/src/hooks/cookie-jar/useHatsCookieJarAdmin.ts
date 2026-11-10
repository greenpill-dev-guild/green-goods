import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { useIntl } from "react-intl";
import { type Address, type Hex, keccak256, parseAbi, toHex, zeroAddress, zeroHash } from "viem";
import { usePublicClient, useReadContracts } from "wagmi";
import { toastService } from "../../components/toast";
import { queryInvalidation } from "../../config/query-keys/invalidation";
import {
  reconcileTransaction,
  sendCheckpointedCall,
} from "../../modules/transactions/confirmation";
import { type TxResult, TransactionRevertedError } from "../../modules/transactions/types";
import {
  hatsJarSubmissionKey,
  useHatsJarSubmissionStore,
} from "../../stores/useHatsJarSubmissionStore";
import type { CookieJar } from "../../types/cookie-jar";
import { COOKIE_JAR_ABI, COOKIE_JAR_MODULE_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
import { JarReviewChangedError } from "../../utils/errors/hats-cookie-jar-errors";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useTransactionSender } from "../blockchain/useTransactionSender";

const FAMILY = keccak256(toHex("GREEN_GOODS_GARDEN_COOKIE_JAR"));
const HATS_JAR_ABI = parseAbi([
  "function FAMILY() view returns (bytes32)",
  "function VERSION() view returns (uint256)",
  "function isOperator(address account) view returns (bool)",
  "function isOwner(address account) view returns (bool)",
  "function policy() view returns (uint256 maxClaimCeiling, uint256 minCooldown, uint256 dailyBudget, address recoveryRecipient)",
  "function pendingPolicy() view returns (uint256 maxClaimCeiling, uint256 minCooldown, uint256 dailyBudget, address recoveryRecipient)",
  "function pendingPolicyAt() view returns (uint256)",
  "function pendingPolicyHash() view returns (bytes32)",
  "function setOperationalLimits(uint256 claimLimit, uint256 cooldown)",
  "function pause()",
  "function unpause()",
  "function proposePolicy((uint256 maxClaimCeiling, uint256 minCooldown, uint256 dailyBudget, address recoveryRecipient) nextPolicy)",
  "function cancelPolicy()",
  "function executePolicy(bytes32 expectedPolicyHash)",
  "function emergencyWithdraw(uint256 amount)",
  "function recoverSurplus(address token, uint256 amount)",
  "error NotOwner()",
  "error NotOperator()",
  "error InvalidPolicy()",
  "error InvalidOperationalLimits()",
  "error PolicyNotReady(uint256 readyAt)",
  "error UnexpectedPolicy()",
  "error ProposerNoLongerOwner()",
  "error InsufficientCredit()",
  "error InsufficientSurplus()",
]);
const REGISTRY_ABI = parseAbi(["function hatsJarFactory() view returns (address)"]);
const FACTORY_ABI = parseAbi(["function isFactoryJar(address jar) view returns (bool)"]);

type JarPolicy = {
  maxClaimCeiling: bigint;
  minCooldown: bigint;
  dailyBudget: bigint;
  recoveryRecipient: Address;
};

export type HatsCookieJarAction =
  | { functionName: "setOperationalLimits"; args: readonly [bigint, bigint] }
  | { functionName: "pause" | "unpause"; args: readonly [] }
  | { functionName: "cancelPolicy"; args: readonly []; pendingHash: Hex }
  | { functionName: "proposePolicy"; args: readonly [JarPolicy] }
  | { functionName: "executePolicy"; args: readonly [Hex] }
  | { functionName: "emergencyWithdraw"; args: readonly [bigint]; recipient: Address }
  | { functionName: "recoverSurplus"; args: readonly [Address, bigint]; recipient: Address };

const isOperatorAction = (action: HatsCookieJarAction) =>
  action.functionName === "pause" || action.functionName === "setOperationalLimits";

/** The pending policy hash a policy action was reviewed against; a proposal needs none pending. */
function reviewedPendingHash(action: HatsCookieJarAction): Hex | undefined {
  switch (action.functionName) {
    case "proposePolicy":
      return zeroHash;
    case "cancelPolicy":
      return action.pendingHash;
    case "executePolicy":
      return action.args[0];
    default:
      return undefined;
  }
}

function unpackPolicy([maxClaimCeiling, minCooldown, dailyBudget, recoveryRecipient]: readonly [
  bigint,
  bigint,
  bigint,
  Address,
]): JarPolicy {
  return { maxClaimCeiling, minCooldown, dailyBudget, recoveryRecipient };
}

export function useHatsCookieJarAdmin(jar: CookieJar) {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const registry = getNetworkContracts(chainId).cookieJarModule;
  const address = jar.jarAddress;
  const account = usePrimaryAddress();
  const sender = useTransactionSender();
  const client = usePublicClient({ chainId });
  const queryClient = useQueryClient();
  // An accepted send is kept per tab session, so a reload or remount cannot reopen the writes.
  const scope = account ? hatsJarSubmissionKey(account, chainId, address) : undefined;
  const submission = useHatsJarSubmissionStore((state) =>
    scope ? state.pending[scope] : undefined
  );
  const signing = useRef(false);
  const handleError = createMutationErrorHandler({
    source: "useHatsCookieJarAdmin",
    toastContext: "cookie jar Hats administration",
    formatMessage,
    getFallbackTitle: () => formatMessage({ id: "app.txFeedback.failed.title" }),
    getFallbackMessage: () => formatMessage({ id: "app.errors.blockchain.unknown.message" }),
  });
  const target = { address, chainId, abi: HATS_JAR_ABI } as const;

  const profile = useReadContracts({
    contracts: [
      { ...target, functionName: "FAMILY" },
      { ...target, functionName: "VERSION" },
      { ...target, abi: COOKIE_JAR_ABI, functionName: "hasRole", args: [zeroHash, zeroAddress] },
    ],
    allowFailure: true,
  });
  const profileData = profile.isError ? undefined : profile.data;
  const family = profileData?.[0]?.result;
  const kind =
    family === FAMILY
      ? profileData?.[1]?.result === 1n
        ? "hats"
        : "unknown"
      : family === undefined && profileData?.[2]?.status === "success"
        ? "legacy"
        : "unknown";

  const state = useReadContracts({
    contracts: [
      { ...target, functionName: "isOperator", args: [account ?? zeroAddress] },
      { ...target, functionName: "isOwner", args: [account ?? zeroAddress] },
      { ...target, functionName: "policy" },
      { ...target, functionName: "pendingPolicy" },
      { ...target, functionName: "pendingPolicyAt" },
      { ...target, functionName: "pendingPolicyHash" },
    ],
    allowFailure: false,
    query: { enabled: kind === "hats", refetchInterval: 15_000 },
  });
  const data = state.isError ? undefined : state.data;
  const policy = data && unpackPolicy(data[2]);
  const pending =
    data && data[5] !== zeroHash
      ? { policy: unpackPolicy(data[3]), readyAt: data[4], hash: data[5] }
      : undefined;

  const refresh = async () => {
    await Promise.all([
      state.refetch(),
      ...queryInvalidation
        .onCookieJarAdminAction(jar.gardenAddress, address, chainId)
        .map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    ]);
  };
  const send = async (action: HatsCookieJarAction) => {
    if (!sender || !client || !account || !registry || kind !== "hats")
      throw new Error("Hats jar signing is unavailable");
    const [activeJar, factory, authorized] = await Promise.all([
      client.readContract({
        address: registry,
        abi: COOKIE_JAR_MODULE_ABI,
        functionName: "getGardenJar",
        args: [jar.gardenAddress, jar.assetAddress],
      }),
      client.readContract({
        address: registry,
        abi: REGISTRY_ABI,
        functionName: "hatsJarFactory",
      }),
      client.readContract({
        address,
        abi: HATS_JAR_ABI,
        functionName: isOperatorAction(action) ? "isOperator" : "isOwner",
        args: [account],
      }),
    ]);
    if (
      activeJar.toLowerCase() !== address.toLowerCase() ||
      !authorized ||
      !(await client.readContract({
        address: factory,
        abi: FACTORY_ABI,
        functionName: "isFactoryJar",
        args: [address],
      }))
    )
      throw new JarReviewChangedError("jarOrHat");

    if ("recipient" in action) {
      const currentPolicy = await client.readContract({
        address,
        abi: HATS_JAR_ABI,
        functionName: "policy",
      });
      if (currentPolicy[3].toLowerCase() !== action.recipient.toLowerCase())
        throw new JarReviewChangedError("recipient");
    }
    const expectedHash = reviewedPendingHash(action);
    if (expectedHash !== undefined) {
      const currentHash = await client.readContract({
        address,
        abi: HATS_JAR_ABI,
        functionName: "pendingPolicyHash",
      });
      if (currentHash !== expectedHash) throw new JarReviewChangedError("pendingPolicy");
    }

    const call = {
      address,
      account,
      abi: HATS_JAR_ABI,
      functionName: action.functionName,
      args: action.args,
    };
    await client.simulateContract(call);
    const key = hatsJarSubmissionKey(account, chainId, address);
    const submissions = useHatsJarSubmissionStore.getState();
    // Forget only this send's record, never one that took its place.
    const forget = (sent: TxResult) => {
      const held = useHatsJarSubmissionStore.getState().pending[key];
      if (held?.hash === (sent.broadcastReference?.hash ?? sent.hash)) submissions.clear(key);
    };
    const result = await sendCheckpointedCall(
      sender,
      { ...call, chainId },
      (checkpoint) => submissions.record(key, checkpoint),
      forget,
      { assertOwnership: () => sender.assertOwnership?.(account, chainId) }
    );
    if (result.confirmation === "pending") submissions.record(key, result);
    else forget(result);
    return result;
  };
  const mutation = useMutation({
    mutationFn: async (action: HatsCookieJarAction) => {
      if (signing.current || (scope && useHatsJarSubmissionStore.getState().pending[scope]))
        throw new Error("A jar transaction is already pending");
      signing.current = true;
      try {
        return await send(action);
      } finally {
        signing.current = false;
      }
    },
    onSuccess: async (result) => {
      if (result.confirmation === "pending") return;
      await refresh();
      toastService.success({ title: formatMessage({ id: "app.cookieJar.hats.submitted" }) });
    },
    onError: (error) => {
      handleError(error);
      // A refused review reopens with the jar's current policy, recipient and Hats.
      void refresh();
    },
  });
  const confirmation = useMutation({
    mutationFn: async () => {
      const submissions = useHatsJarSubmissionStore.getState();
      const transaction = scope ? submissions.pending[scope] : undefined;
      if (!sender || !client || !scope || !transaction || signing.current) return;
      const outcome = await reconcileTransaction(sender, transaction, (hash) =>
        client.getTransactionReceipt({ hash })
      );
      if (
        outcome.status === "unresolved" ||
        useHatsJarSubmissionStore.getState().pending[scope] !== transaction
      )
        return;
      submissions.clear(scope);
      await refresh();
      if (outcome.status === "reverted") throw new TransactionRevertedError(transaction.hash);
    },
    onError: (error) => handleError(error),
  });

  return {
    kind,
    policy,
    pending,
    canOperate: Boolean(sender && account && !submission && data?.[0]),
    canGovern: Boolean(sender && account && !submission && data?.[1]),
    mutation,
    submission,
    confirmation,
  };
}
