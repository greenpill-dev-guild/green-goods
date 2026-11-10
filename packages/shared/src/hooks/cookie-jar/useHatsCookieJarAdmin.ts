import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
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
import type { CookieJar } from "../../types/cookie-jar";
import { COOKIE_JAR_ABI, COOKIE_JAR_MODULE_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { getNetworkContracts } from "../../utils/blockchain/contracts";
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
  const pendingRef = useRef<TxResult | undefined>(undefined);
  const [submission, setSubmission] = useState<TxResult>();
  const signing = useRef(false);
  const recordSubmission = (result: TxResult | undefined) => {
    pendingRef.current = result;
    setSubmission(result);
  };
  const handleError = createMutationErrorHandler({
    source: "useHatsCookieJarAdmin",
    toastContext: "cookie jar Hats administration",
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
      throw new Error("The active jar or your Hat permission changed");

    if ("recipient" in action) {
      const currentPolicy = await client.readContract({
        address,
        abi: HATS_JAR_ABI,
        functionName: "policy",
      });
      if (currentPolicy[3].toLowerCase() !== action.recipient.toLowerCase())
        throw new Error("The recovery recipient changed");
    }
    if (action.functionName === "proposePolicy" || action.functionName === "cancelPolicy") {
      const currentHash = await client.readContract({
        address,
        abi: HATS_JAR_ABI,
        functionName: "pendingPolicyHash",
      });
      const expectedHash = action.functionName === "cancelPolicy" ? action.pendingHash : zeroHash;
      if (currentHash !== expectedHash) throw new Error("The pending policy changed");
    }

    const call = {
      address,
      account,
      abi: HATS_JAR_ABI,
      functionName: action.functionName,
      args: action.args,
    };
    await client.simulateContract(call);
    const result = await sendCheckpointedCall(
      sender,
      { ...call, chainId },
      recordSubmission,
      () => recordSubmission(undefined),
      { assertOwnership: () => sender.assertOwnership?.(account, chainId) }
    );
    recordSubmission(result.confirmation === "pending" ? result : undefined);
    return result;
  };
  const mutation = useMutation({
    mutationFn: async (action: HatsCookieJarAction) => {
      if (signing.current || pendingRef.current)
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
    onError: (error) => handleError(error),
  });
  const confirmation = useMutation({
    mutationFn: async () => {
      const transaction = pendingRef.current;
      if (!sender || !client || !transaction || signing.current) return;
      const outcome = await reconcileTransaction(sender, transaction, (hash) =>
        client.getTransactionReceipt({ hash })
      );
      if (outcome.status === "unresolved" || pendingRef.current !== transaction) return;
      recordSubmission(undefined);
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
