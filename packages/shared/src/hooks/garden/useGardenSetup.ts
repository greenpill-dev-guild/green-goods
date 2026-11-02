/**
 * What a garden's creation should have set up, read from the chain rather than the indexer so it
 * answers the moment a garden exists. Minting sets all of it up, but each part is best effort: a
 * module that fails does not stop the garden, so a part can be missing afterwards.
 *
 * @module hooks/garden/useGardenSetup
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { parseAbi, zeroAddress } from "viem";
import { logger } from "../../modules/app/logger";
import { gardensKeys } from "../../config/query-keys/garden";
import type { Address } from "../../types/domain";
import { GARDENS_MODULE_ABI } from "../../utils/blockchain/abis/conviction";
import { COOKIE_JAR_MODULE_ABI } from "../../utils/blockchain/abis/cookie-jar";
import { OCTANT_MODULE_ABI } from "../../utils/blockchain/abis/octant";
import { isUnansweredContractRead } from "../../utils/blockchain/contract-reads";
import {
  CommitmentPoolingModuleABI,
  createClients,
  GardenTokenABI,
  getNetworkContracts,
  GreenGoodsENSABI,
} from "../../utils/blockchain/contracts";
import { useToastAction } from "../app/useToastAction";
import { useContractTxSender } from "../blockchain/useContractTxSender";
import { useCurrentChain } from "../blockchain/useChainConfig";

const GARDEN_SETUP_ABI = parseAbi([
  "function slug() view returns (string)",
  "function supportedAssetList(uint256) view returns (address)",
  "function supportedAssets(address) view returns (address)",
  "function createVaultForAsset(address garden, address asset) returns (address)",
]);

/** What a mint starts on Gnosis and Celo. Older tokens have none of these reads. */
const CROSS_CHAIN_SETUP_ABI = parseAbi([
  "function token() view returns (uint256, address, uint256)",
  "function firstUpgradeableTokenId() view returns (uint80)",
  "function stewardSafeBootstrap() view returns (address)",
  "function settlementAccountBootstrap() view returns (address)",
  "function stewardObserver(address garden) view returns (address)",
  "function settlementAccountOf(address garden) view returns ((uint64 chainId, address account, bool active, address[3] recoveryOwners, address rolesModifier, bytes32 roleKey, bytes32 allowanceKey, bytes32 permissionsConfigHash, bytes32 recoveryConfigHash, uint8 recoveryThreshold))",
]);

/** No chain lists this many vault assets, and the list has no length to ask for. */
const MAX_VAULT_ASSETS = 5;
const GARDEN_NAME_TYPE = 1;

export type GardenSetupStepId =
  | "name"
  | "community"
  | "pools"
  | "vaults"
  | "jars"
  | "commitmentPool"
  | "stewardSafe"
  | "settlement";

/**
 * Who can finish a missing part: `self` from this screen, `team` only through the Green Goods team,
 * `waiting` once the Green Goods name fund can pay for it.
 */
export type GardenSetupFix = "self" | "team" | "waiting";

export interface GardenSetupStep {
  id: GardenSetupStepId;
  /**
   * A read that failed is `unknown`, never `missing`: the garden may well be fine. A `pending` part
   * arrives on its own, with nothing for anyone here to do.
   */
  status: "done" | "missing" | "pending" | "unknown";
  fix: GardenSetupFix;
  /** What a pending part waits on: a Green Goods update, or a message between chains. */
  pendingOn?: "update" | "delivery";
}

export interface GardenSetup {
  steps: GardenSetupStep[];
  /** A part is missing, so someone has something to finish. */
  needsAttention: boolean;
  /** A part is still to come on its own. */
  hasPending: boolean;
  /** The garden's chosen web name, for saying which name is waiting. */
  slug: string;
  isLoading: boolean;
  finishing: GardenSetupStepId | null;
  finish: (step: GardenSetupStepId) => Promise<void>;
}

interface GardenSetupState {
  slug: string;
  steps: GardenSetupStep[];
  missingVaultAsset: Address | null;
}

async function readGardenSetup(garden: Address, chainId: number): Promise<GardenSetupState> {
  const { publicClient } = createClients(chainId);
  const contracts = getNetworkContracts(chainId);
  const read = async <T>(address: Address, abi: unknown, functionName: string, args: unknown[]) => {
    try {
      return (await publicClient.readContract({ address, abi, functionName, args } as never)) as T;
    } catch (error) {
      // A failed read leaves its part unknown. A contract from before a read answers without a
      // value, which is expected; any other failure means the read never reached the chain.
      if (!isUnansweredContractRead(error))
        logger.warn("Garden setup read failed", { source: "useGardenSetup", functionName, error });
      return undefined;
    }
  };

  const [
    slug,
    ownedName,
    community,
    signalPools,
    jars,
    poolId,
    reserve,
    accountToken,
    firstUpgradeableTokenId,
    stewardSafeBootstrap,
    settlementBootstrap,
    stewardObserver,
  ] = await Promise.all([
    read<string>(garden, GARDEN_SETUP_ABI, "slug", []),
    read<string>(contracts.greenGoodsENS, GreenGoodsENSABI, "ownerToSlug", [garden]),
    read<Address>(contracts.gardensModule, GARDENS_MODULE_ABI, "getGardenCommunity", [garden]),
    read<readonly Address[]>(contracts.gardensModule, GARDENS_MODULE_ABI, "getGardenSignalPools", [
      garden,
    ]),
    read<readonly Address[]>(contracts.cookieJarModule, COOKIE_JAR_MODULE_ABI, "getGardenJars", [
      garden,
    ]),
    read<bigint>(contracts.commitmentPoolingModule, CommitmentPoolingModuleABI, "getPoolByGarden", [
      garden,
    ]),
    // A token from before the reserve has no such read, and so nothing to pay a name with.
    read<bigint>(contracts.gardenToken, GardenTokenABI, "gardenNameReserve", []),
    read<readonly [bigint, Address, bigint]>(garden, CROSS_CHAIN_SETUP_ABI, "token", []),
    read<bigint>(contracts.gardenToken, CROSS_CHAIN_SETUP_ABI, "firstUpgradeableTokenId", []),
    read<Address>(contracts.gardenToken, CROSS_CHAIN_SETUP_ABI, "stewardSafeBootstrap", []),
    read<Address>(contracts.gardenToken, CROSS_CHAIN_SETUP_ABI, "settlementAccountBootstrap", []),
    read<Address>(contracts.hatsModule, CROSS_CHAIN_SETUP_ABI, "stewardObserver", [garden]),
  ]);

  // Gardens minted before upgradeable accounts were set up by hand, so the card leaves these off.
  const tokenId = accountToken?.[2];
  const mintedWithCrossChainSetup =
    tokenId !== undefined &&
    firstUpgradeableTokenId !== undefined &&
    tokenId >= firstUpgradeableTokenId;
  const settlementAccount =
    mintedWithCrossChainSetup && settlementBootstrap && settlementBootstrap !== zeroAddress
      ? await read<{ account: Address; active: boolean }>(
          contracts.settlementModule,
          CROSS_CHAIN_SETUP_ABI,
          "settlementAccountOf",
          [garden]
        )
      : undefined;

  const fee = slug
    ? await read<bigint>(contracts.greenGoodsENS, GreenGoodsENSABI, "getRegistrationFee", [
        slug,
        garden,
        GARDEN_NAME_TYPE,
      ])
    : undefined;

  const listed = await Promise.all(
    Array.from({ length: MAX_VAULT_ASSETS }, (_, index) =>
      read<Address>(contracts.octantModule, GARDEN_SETUP_ABI, "supportedAssetList", [BigInt(index)])
    )
  );
  const assets = listed.filter((asset): asset is Address => Boolean(asset));
  const vaults = await Promise.all(
    assets.map(async (asset) => ({
      asset,
      strategy: await read<Address>(contracts.octantModule, GARDEN_SETUP_ABI, "supportedAssets", [
        asset,
      ]),
      vault: await read<Address>(contracts.octantModule, OCTANT_MODULE_ABI, "getVaultForAsset", [
        garden,
        asset,
      ]),
    }))
  );
  const activeVaults = vaults.filter(({ strategy }) => strategy && strategy !== zeroAddress);
  const missingVaultAsset = activeVaults.find(({ vault }) => vault === zeroAddress)?.asset ?? null;

  const answered = <T>(value: T | undefined, done: (value: T) => boolean) =>
    value === undefined ? "unknown" : done(value) ? "done" : "missing";

  return {
    slug: slug ?? "",
    missingVaultAsset,
    steps: [
      {
        id: "name",
        // A garden created without a web name wants none.
        status: slug === "" ? "done" : answered(ownedName, (name) => name.length > 0),
        fix: fee !== undefined && reserve !== undefined && reserve >= fee ? "self" : "waiting",
      },
      {
        id: "community",
        status: answered(community, (address) => address !== zeroAddress),
        fix: "team",
      },
      {
        id: "pools",
        status: answered(signalPools, (pools) => pools.length > 0),
        fix: "self",
      },
      {
        id: "vaults",
        status:
          activeVaults.length === 0 ||
          activeVaults.some(({ vault, strategy }) => vault === undefined || strategy === undefined)
            ? "unknown"
            : missingVaultAsset
              ? "missing"
              : "done",
        fix: "self",
      },
      {
        id: "jars",
        status: answered(jars, (gardenJars) => gardenJars.length > 0),
        fix: "team",
      },
      {
        id: "commitmentPool",
        status: answered(poolId, (id) => id > 0n),
        fix: "team",
      },
      ...(mintedWithCrossChainSetup && stewardSafeBootstrap && stewardSafeBootstrap !== zeroAddress
        ? [stewardSafeStep(stewardObserver)]
        : []),
      ...(mintedWithCrossChainSetup
        ? [settlementStep(settlementBootstrap, settlementAccount)]
        : []),
    ],
  };
}

/** The observer is Arbitrum's record that the mint sent the Safe's request to Gnosis. */
function stewardSafeStep(observer: Address | undefined): GardenSetupStep {
  const status = observer === undefined ? "unknown" : observer === zeroAddress ? "missing" : "done";
  return { id: "stewardSafe", status, fix: "team" };
}

/**
 * No mint opens a settlement account until the token has a settlement bootstrap. After that, the
 * account is registered at mint and turns active once Celo confirms it.
 */
function settlementStep(
  bootstrap: Address | undefined,
  account: { account: Address; active: boolean } | undefined
): GardenSetupStep {
  const step = { id: "settlement", fix: "team" } as const;
  if (bootstrap === undefined) return { ...step, status: "unknown" };
  if (bootstrap === zeroAddress) return { ...step, status: "pending", pendingOn: "update" };
  if (account === undefined) return { ...step, status: "unknown" };
  if (account.active) return { ...step, status: "done" };
  return account.account === zeroAddress
    ? { ...step, status: "missing" }
    : { ...step, status: "pending", pendingOn: "delivery" };
}

/** Reads the setup only for someone who could act on it. */
export function useGardenSetup(garden: Address | undefined, canManage: boolean): GardenSetup {
  const { formatMessage } = useIntl();
  const chainId = useCurrentChain();
  const queryClient = useQueryClient();
  const sendContractTx = useContractTxSender();
  const { executeWithToast } = useToastAction();
  const [finishing, setFinishing] = useState<GardenSetupStepId | null>(null);

  const queryKey = gardensKeys.setup(garden ?? "", chainId);
  const query = useQuery({
    queryKey,
    queryFn: () => readGardenSetup(garden as Address, chainId),
    enabled: Boolean(garden) && canManage,
    staleTime: 60_000,
    retry: false,
  });
  const state = query.data;

  const finish = useCallback(
    async (step: GardenSetupStepId) => {
      if (!garden || !state) return;
      const contracts = getNetworkContracts(chainId);
      const call =
        step === "name"
          ? {
              address: contracts.gardenToken,
              abi: GardenTokenABI,
              functionName: "registerGardenName",
              args: [garden],
            }
          : step === "pools"
            ? {
                address: contracts.gardensModule,
                abi: GARDENS_MODULE_ABI,
                functionName: "createGardenPools",
                args: [garden],
              }
            : step === "vaults" && state.missingVaultAsset
              ? {
                  address: contracts.octantModule,
                  abi: GARDEN_SETUP_ABI,
                  functionName: "createVaultForAsset",
                  args: [garden, state.missingVaultAsset],
                }
              : null;
      if (!call) return;

      setFinishing(step);
      try {
        await executeWithToast(() => sendContractTx(call as never), {
          loadingMessage: formatMessage({ id: "cockpit.garden.setup.working" }),
          successMessage: formatMessage({ id: "cockpit.garden.setup.done" }),
          errorMessage: formatMessage({ id: "cockpit.garden.setup.failed" }),
          context: "garden setup",
        });
        await queryClient.invalidateQueries({ queryKey });
      } catch (error) {
        logger.warn("Garden setup step was not sent", { source: "useGardenSetup", step, error });
      } finally {
        setFinishing(null);
      }
    },
    [chainId, executeWithToast, formatMessage, garden, queryClient, queryKey, sendContractTx, state]
  );

  return useMemo(
    () => ({
      steps: state?.steps ?? [],
      needsAttention: Boolean(state?.steps.some((step) => step.status === "missing")),
      hasPending: Boolean(state?.steps.some((step) => step.status === "pending")),
      slug: state?.slug ?? "",
      isLoading: query.isLoading,
      finishing,
      finish,
    }),
    [finish, finishing, query.isLoading, state]
  );
}
