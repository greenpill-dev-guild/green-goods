import { useMutation, useQueryClient } from "@tanstack/react-query";
import { readContract, waitForTransactionReceipt } from "@wagmi/core";
import { useCallback, useMemo, useRef } from "react";
import { useIntl } from "react-intl";
import { parseEventLogs, type Hex } from "viem";
import { useReadContract, useReadContracts } from "wagmi";
import { toastService } from "../../components/toast";
import { getWagmiConfig } from "../../config/appkit";
import {
  INDEXER_LAG_SCHEDULE_MS,
  queryInvalidation,
  queryKeys,
  STALE_TIME_MEDIUM,
} from "../../config/query-keys";
import { logger } from "../../modules/app/logger";
import type {
  CampaignCookieJar,
  CookieJarDepositParams,
  CookieJarWithdrawParams,
  CreateCampaignCookieJarParams,
  SyncCampaignCookieJarAllowlistParams,
} from "../../types/cookie-jar";
import type { Address } from "../../types/domain";
import {
  buildCampaignCookieJarMetadata,
  parseCampaignCookieJarMetadata,
} from "../../utils/cookie-jar-campaign";
import {
  COOKIE_JAR_ABI,
  COOKIE_JAR_FACTORY_ABI,
  ERC20_ALLOWANCE_ABI,
  ERC20_DECIMALS_ABI,
  ERC20_SYMBOL_ABI,
} from "../../utils/blockchain/abis";
import { ZERO_ADDRESS } from "../../utils/blockchain/vaults";
import { createMutationErrorHandler } from "../../utils/errors/mutation-error-handler";
import { useUser } from "../auth/useUser";
import { useCurrentChain } from "../blockchain/useChainConfig";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useProgressiveInvalidation } from "../utils/useTimeout";
import { useCookieJarFactoryAddress } from "./useCookieJarFactoryAddress";

const ERC20_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

const BASE_FIELD_COUNT = 13;
const FACTORY_DEFAULT_FEE_SENTINEL = 2n ** 256n - 1n;

type TxErrorMode = "toast" | "inline" | "auto";

interface CookieJarMutationOptions {
  errorMode?: TxErrorMode;
}

interface UseCampaignCookieJarOptions {
  enabled?: boolean;
}

function shouldShowErrorToast(mode: TxErrorMode = "auto"): boolean {
  return mode !== "inline";
}

function isCanonicalTxHash(hash: string): hash is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(hash);
}

function mapAccessType(value: unknown): CampaignCookieJar["accessType"] {
  if (value === 0 || value === 0n) return "allowlist";
  if (value === 1 || value === 1n) return "erc721";
  if (value === 2 || value === 2n) return "erc1155";
  return "unknown";
}

function mapWithdrawalType(value: unknown): CampaignCookieJar["withdrawalType"] {
  if (value === 0 || value === 0n) return "fixed";
  if (value === 1 || value === 1n) return "variable";
  return "unknown";
}

function buildDisabledMultiTokenConfig() {
  return {
    enabled: false,
    maxSlippagePercent: 0n,
    minSwapAmount: 0n,
    defaultFee: 0,
  };
}

function emptyNftRequirement() {
  return {
    nftContract: ZERO_ADDRESS as Address,
    tokenId: 0n,
    minBalance: 0n,
    isPoapEventGate: false,
  };
}

function campaignInvalidationKeys(
  jarAddress: Address,
  userAddress: Address | undefined,
  chainId: number
) {
  return queryInvalidation.onCampaignCookieJarChanged(jarAddress, userAddress, chainId);
}

export function useCampaignCookieJar(
  jarAddress?: Address,
  options: UseCampaignCookieJarOptions = {}
) {
  const { primaryAddress } = useUser();
  const enabled = options.enabled ?? true;
  const normalizedJar = jarAddress?.toLowerCase() as Address | undefined;
  const normalizedUser = primaryAddress?.toLowerCase() as Address | undefined;
  const factory = useCookieJarFactoryAddress({ enabled: enabled && !!normalizedJar });

  const jarContracts = useMemo(() => {
    if (!normalizedJar) return [];

    const baseContracts = [
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "CURRENCY" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "currencyHeldByJar" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "maxWithdrawal" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "withdrawalInterval" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "fixedAmount" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "WITHDRAWAL_OPTION" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "ACCESS_TYPE" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "ONE_TIME_WITHDRAWAL" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "STRICT_PURPOSE" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "paused" as const },
      {
        address: normalizedJar,
        abi: COOKIE_JAR_ABI,
        functionName: "EMERGENCY_WITHDRAWAL_ENABLED" as const,
      },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "MIN_DEPOSIT" as const },
      { address: normalizedJar, abi: COOKIE_JAR_ABI, functionName: "getAllowlist" as const },
    ];

    if (!normalizedUser) return baseContracts;

    return [
      ...baseContracts,
      {
        address: normalizedJar,
        abi: COOKIE_JAR_ABI,
        functionName: "lastWithdrawalTime" as const,
        args: [normalizedUser],
      },
      {
        address: normalizedJar,
        abi: COOKIE_JAR_ABI,
        functionName: "totalWithdrawn" as const,
        args: [normalizedUser],
      },
    ];
  }, [normalizedJar, normalizedUser]);

  const detailsQuery = useReadContracts({
    contracts: jarContracts,
    allowFailure: true,
    query: {
      enabled: enabled && !!normalizedJar,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const currency = detailsQuery.data?.[0]?.result as Address | undefined;

  const tokenQuery = useReadContracts({
    contracts: currency
      ? [
          { address: currency, abi: ERC20_DECIMALS_ABI, functionName: "decimals" as const },
          { address: currency, abi: ERC20_SYMBOL_ABI, functionName: "symbol" as const },
        ]
      : [],
    allowFailure: true,
    query: {
      enabled: enabled && !!currency,
      staleTime: STALE_TIME_MEDIUM,
    },
  });

  const metadataQuery = useReadContract({
    address: factory.factoryAddress,
    abi: COOKIE_JAR_FACTORY_ABI,
    functionName: "getMetadata",
    args: normalizedJar ? [normalizedJar] : undefined,
    query: {
      enabled: enabled && !!normalizedJar && !!factory.factoryAddress,
      staleTime: STALE_TIME_MEDIUM,
      retry: false,
    },
  });

  const jar = useMemo<CampaignCookieJar | null>(() => {
    const results = detailsQuery.data;
    if (!normalizedJar || !results) return null;

    const balance = results[1]?.result as bigint | undefined;
    if (!currency || balance === undefined) return null;

    const allowlist = ((results[12]?.result as Address[] | undefined) ?? []).map(
      (address) => address.toLowerCase() as Address
    );
    const accessType = mapAccessType(results[6]?.result);
    const withdrawalType = mapWithdrawalType(results[5]?.result);
    const fixedAmount = (results[4]?.result as bigint | undefined) ?? 0n;
    const maxWithdrawal = (results[2]?.result as bigint | undefined) ?? 0n;
    const withdrawalInterval = (results[3]?.result as bigint | undefined) ?? 0n;
    const lastWithdrawalTime =
      normalizedUser && results.length > BASE_FIELD_COUNT
        ? ((results[BASE_FIELD_COUNT]?.result as bigint | undefined) ?? 0n)
        : 0n;
    const totalWithdrawn =
      normalizedUser && results.length > BASE_FIELD_COUNT + 1
        ? ((results[BASE_FIELD_COUNT + 1]?.result as bigint | undefined) ?? 0n)
        : 0n;
    const rawMetadata = (metadataQuery.data as string | undefined) ?? "";
    const metadata = parseCampaignCookieJarMetadata(rawMetadata);
    const decimals = (tokenQuery.data?.[0]?.result as number | undefined) ?? 18;
    const symbol = (tokenQuery.data?.[1]?.result as string | undefined) ?? "TOKEN";
    const oneTimeWithdrawal = (results[7]?.result as boolean | undefined) ?? false;
    const isPaused = (results[9]?.result as boolean | undefined) ?? false;
    const now = Math.floor(Date.now() / 1000);
    const nextClaimAt =
      withdrawalInterval > 0n && lastWithdrawalTime > 0n
        ? Number(lastWithdrawalTime + withdrawalInterval)
        : null;
    const cooldownReady = !nextClaimAt || nextClaimAt <= now;
    const isEligible = Boolean(
      normalizedUser &&
        (accessType === "allowlist"
          ? allowlist.some((address) => address.toLowerCase() === normalizedUser)
          : accessType !== "unknown")
    );
    const claimAmount = withdrawalType === "fixed" ? fixedAmount : maxWithdrawal;

    return {
      jarAddress: normalizedJar,
      assetAddress: currency,
      balance,
      currency,
      decimals,
      symbol,
      maxWithdrawal,
      withdrawalInterval,
      minDeposit: (results[11]?.result as bigint | undefined) ?? 0n,
      isPaused,
      emergencyWithdrawalEnabled: (results[10]?.result as boolean | undefined) ?? false,
      metadata,
      rawMetadata,
      accessType,
      withdrawalType,
      fixedAmount,
      oneTimeWithdrawal,
      strictPurpose: (results[8]?.result as boolean | undefined) ?? false,
      allowlist,
      isEligible,
      lastWithdrawalTime,
      totalWithdrawn,
      canClaimNow:
        Boolean(normalizedUser) &&
        isEligible &&
        !isPaused &&
        claimAmount > 0n &&
        balance >= claimAmount &&
        (!oneTimeWithdrawal || totalWithdrawn === 0n) &&
        cooldownReady,
      nextClaimAt: cooldownReady ? null : nextClaimAt,
    };
  }, [
    currency,
    detailsQuery.data,
    metadataQuery.data,
    normalizedJar,
    normalizedUser,
    tokenQuery.data,
  ]);

  const detailErrorCount = useMemo(
    () => (detailsQuery.data ?? []).filter((result) => result?.status !== "success").length,
    [detailsQuery.data]
  );

  return {
    jar,
    factoryAddress: factory.factoryAddress,
    moduleConfigured: factory.moduleConfigured,
    isLoading:
      factory.isLoading ||
      detailsQuery.isLoading ||
      tokenQuery.isLoading ||
      metadataQuery.isLoading,
    error: detailsQuery.error || tokenQuery.error || metadataQuery.error || factory.error,
    detailErrorCount,
    hasDetailReadFailure: detailErrorCount > 0,
  };
}

export function useCreateCampaignCookieJar(options: CookieJarMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useCreateCampaignCookieJar",
    toastContext: "campaign cookie jar creation",
  });

  return useMutation({
    mutationFn: async (params: CreateCampaignCookieJarParams) => {
      const metadata = JSON.stringify(
        buildCampaignCookieJarMetadata({
          title: params.title,
          slug: params.slug,
          sourceGardens: params.sourceGardens,
          extraAllowlist: params.extraAllowlist,
          chainId,
        })
      );
      const multiTokenConfig = buildDisabledMultiTokenConfig();
      const hash = await sendContractTx({
        address: params.factoryAddress,
        abi: COOKIE_JAR_FACTORY_ABI,
        functionName: "createCookieJar",
        args: [
          {
            jarOwner: params.jarOwner,
            supportedCurrency: params.tokenAddress,
            feeCollector: ZERO_ADDRESS as Address,
            accessType: 0,
            withdrawalOption: params.withdrawalType === "fixed" ? 0 : 1,
            strictPurpose: params.strictPurpose,
            emergencyWithdrawalEnabled: false,
            oneTimeWithdrawal: params.oneTimeWithdrawal,
            fixedAmount: params.fixedAmount,
            maxWithdrawal: params.maxWithdrawal,
            withdrawalInterval: params.withdrawalInterval,
            minDeposit: params.minDeposit,
            feePercentageOnDeposit: FACTORY_DEFAULT_FEE_SENTINEL,
            maxWithdrawalPerPeriod: 0n,
            metadata,
            multiTokenConfig,
          },
          {
            allowlist: params.allowlist,
            nftRequirement: emptyNftRequirement(),
          },
          multiTokenConfig,
        ],
      });

      let jarAddress: Address | undefined;
      if (isCanonicalTxHash(hash)) {
        try {
          const receipt = await waitForTransactionReceipt(getWagmiConfig(), { hash });
          const logs = parseEventLogs({
            abi: COOKIE_JAR_FACTORY_ABI,
            eventName: "JarCreated",
            logs: receipt.logs,
          });
          jarAddress = logs[0]?.args.jarAddress as Address | undefined;
        } catch (error) {
          logger.warn("[CampaignCookieJar] Could not parse created jar event", { error });
        }
      }

      return { hash, jarAddress, metadata };
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.campaignCookieJar.create.title" }),
        message: formatMessage({ id: "app.campaignCookieJar.create.pending" }),
      });
      return { toastId };
    },
    onSuccess: (result, _params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.campaignCookieJar.create.title" }),
        message: formatMessage({ id: "app.campaignCookieJar.create.success" }),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.cookieJar.all });
      if (result.jarAddress) {
        campaignInvalidationKeys(result.jarAddress, primaryAddress ?? undefined, chainId).forEach(
          (queryKey) => queryClient.invalidateQueries({ queryKey })
        );
      }
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          factoryAddress: params?.factoryAddress,
          tokenAddress: params?.tokenAddress,
          allowlistCount: params?.allowlist.length,
        },
        showToast: showErrorToast,
      });
    },
  });
}

export function useCampaignCookieJarDeposit(options: CookieJarMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const activeToastId = useRef<string | undefined>(undefined);
  const lastParamsRef = useRef<{ jarAddress: string }>({ jarAddress: "" });
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useCampaignCookieJarDeposit",
    toastContext: "campaign cookie jar deposit",
  });
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      if (!lastParamsRef.current.jarAddress) return;
      campaignInvalidationKeys(
        lastParamsRef.current.jarAddress as Address,
        primaryAddress ?? undefined,
        chainId
      ).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }, [chainId, primaryAddress, queryClient]),
    INDEXER_LAG_SCHEDULE_MS
  );

  return useMutation({
    mutationFn: async (params: CookieJarDepositParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      try {
        const balanceResult = await readContract(getWagmiConfig(), {
          address: params.assetAddress,
          abi: ERC20_BALANCE_ABI,
          functionName: "balanceOf",
          args: [primaryAddress as Address],
        });
        const balance = typeof balanceResult === "bigint" ? balanceResult : 0n;
        if (balance < params.amount) {
          throw new Error("Insufficient token balance for deposit");
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes("Insufficient token balance")) {
          throw error;
        }
        logger.warn("[CampaignCookieJarDeposit] Balance check failed, proceeding anyway", {
          error,
        });
      }

      let allowance: bigint;
      try {
        const allowanceResult = await readContract(getWagmiConfig(), {
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "allowance",
          args: [primaryAddress as Address, params.jarAddress],
        });
        allowance = typeof allowanceResult === "bigint" ? allowanceResult : 0n;
      } catch {
        allowance = 0n;
      }

      if (allowance < params.amount) {
        await sendContractTx({
          address: params.assetAddress,
          abi: ERC20_ALLOWANCE_ABI,
          functionName: "approve",
          args: [params.jarAddress, params.amount],
        });
      }

      if (activeToastId.current) {
        toastService.loading({
          id: activeToastId.current,
          title: formatMessage({ id: "app.cookieJar.deposit" }),
          message: formatMessage({ id: "app.cookieJar.depositing" }),
        });
      }

      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "deposit",
        args: [params.amount],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.deposit" }),
        message: formatMessage({ id: "app.cookieJar.approving" }),
      });
      activeToastId.current = toastId;
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.deposit" }),
        message: formatMessage({ id: "app.cookieJar.depositSuccess" }),
      });
      lastParamsRef.current = { jarAddress: params.jarAddress };
      campaignInvalidationKeys(params.jarAddress, primaryAddress ?? undefined, chainId).forEach(
        (queryKey) => queryClient.invalidateQueries({ queryKey })
      );
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          jarAddress: params?.jarAddress,
          assetAddress: params?.assetAddress,
        },
        showToast: showErrorToast,
      });
    },
  });
}

export function useCampaignCookieJarWithdraw(options: CookieJarMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const lastParamsRef = useRef<{ jarAddress: string }>({ jarAddress: "" });
  const handleError = createMutationErrorHandler({
    source: "useCampaignCookieJarWithdraw",
    toastContext: "campaign cookie jar withdraw",
  });
  const { start: scheduleFollowUp } = useProgressiveInvalidation(
    useCallback(() => {
      if (!lastParamsRef.current.jarAddress) return;
      campaignInvalidationKeys(
        lastParamsRef.current.jarAddress as Address,
        primaryAddress ?? undefined,
        chainId
      ).forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    }, [chainId, primaryAddress, queryClient]),
    INDEXER_LAG_SCHEDULE_MS
  );

  return useMutation({
    mutationFn: async (params: CookieJarWithdrawParams) => {
      if (!primaryAddress) {
        throw new Error("Connected account required");
      }

      return sendContractTx({
        address: params.jarAddress,
        abi: COOKIE_JAR_ABI,
        functionName: "withdraw",
        args: [params.amount, params.purpose],
      });
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.cookieJar.withdraw" }),
        message: formatMessage({ id: "app.cookieJar.withdrawing" }),
      });
      return { toastId };
    },
    onSuccess: (_txHash, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.cookieJar.withdraw" }),
        message: formatMessage({ id: "app.cookieJar.withdrawSuccess" }),
      });
      lastParamsRef.current = { jarAddress: params.jarAddress };
      campaignInvalidationKeys(params.jarAddress, primaryAddress ?? undefined, chainId).forEach(
        (queryKey) => queryClient.invalidateQueries({ queryKey })
      );
      scheduleFollowUp();
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          jarAddress: params?.jarAddress,
        },
        showToast: showErrorToast,
      });
    },
  });
}

export function useSyncCampaignCookieJarAllowlist(options: CookieJarMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useSyncCampaignCookieJarAllowlist",
    toastContext: "campaign cookie jar allowlist sync",
  });

  return useMutation({
    mutationFn: async (params: SyncCampaignCookieJarAllowlistParams) => {
      const hashes: Hex[] = [];
      if (params.grant.length > 0) {
        const grantHash = await sendContractTx({
          address: params.jarAddress,
          abi: COOKIE_JAR_ABI,
          functionName: "grantJarAllowlistRole",
          args: [params.grant],
        });
        hashes.push(grantHash);
      }
      if (params.revoke.length > 0) {
        const revokeHash = await sendContractTx({
          address: params.jarAddress,
          abi: COOKIE_JAR_ABI,
          functionName: "revokeJarAllowlistRole",
          args: [params.revoke],
        });
        hashes.push(revokeHash);
      }
      return { hashes };
    },
    onMutate: () => {
      const toastId = toastService.loading({
        title: formatMessage({ id: "app.campaignCookieJar.sync.title" }),
        message: formatMessage({ id: "app.campaignCookieJar.sync.pending" }),
      });
      return { toastId };
    },
    onSuccess: (_result, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      toastService.success({
        title: formatMessage({ id: "app.campaignCookieJar.sync.title" }),
        message: formatMessage({ id: "app.campaignCookieJar.sync.success" }),
      });
      campaignInvalidationKeys(params.jarAddress, primaryAddress ?? undefined, chainId).forEach(
        (queryKey) => queryClient.invalidateQueries({ queryKey })
      );
    },
    onError: (error, params, context) => {
      if (context?.toastId) toastService.dismiss(context.toastId);
      handleError(error, {
        metadata: {
          jarAddress: params?.jarAddress,
          grantCount: params?.grant.length,
          revokeCount: params?.revoke.length,
        },
        showToast: showErrorToast,
      });
    },
  });
}

export function useUpdateCampaignCookieJarMetadata(options: CookieJarMutationOptions = {}) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const chainId = useCurrentChain();
  const { primaryAddress } = useUser();
  const sendContractTx = useContractTxSender();
  const showErrorToast = shouldShowErrorToast(options.errorMode);
  const handleError = createMutationErrorHandler({
    source: "useUpdateCampaignCookieJarMetadata",
    toastContext: "campaign cookie jar metadata update",
  });

  return useMutation({
    mutationFn: async (params: {
      factoryAddress: Address;
      jarAddress: Address;
      metadata: string;
    }) =>
      sendContractTx({
        address: params.factoryAddress,
        abi: COOKIE_JAR_FACTORY_ABI,
        functionName: "updateMetadata",
        args: [params.jarAddress, params.metadata],
      }),
    onSuccess: (_txHash, params) => {
      campaignInvalidationKeys(params.jarAddress, primaryAddress ?? undefined, chainId).forEach(
        (queryKey) => queryClient.invalidateQueries({ queryKey })
      );
      toastService.success({
        title: formatMessage({ id: "app.campaignCookieJar.metadata.title" }),
        message: formatMessage({ id: "app.campaignCookieJar.metadata.success" }),
      });
    },
    onError: (error, params) => {
      handleError(error, {
        metadata: {
          factoryAddress: params?.factoryAddress,
          jarAddress: params?.jarAddress,
        },
        showToast: showErrorToast,
      });
    },
  });
}
