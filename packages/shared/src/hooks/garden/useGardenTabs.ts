import { useCallback, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { GOVERNANCE_ENABLED } from "../../config/app";
import type { Address, Garden } from "../../types/domain";
import { useUser } from "../auth/useUser";
import { useConvictionStrategies } from "../conviction/useConvictionStrategies";
import { useHasRole } from "../roles/useHasRole";
import { useGardenVaults } from "../vault/useGardenVaults";
import { useVaultDeposits } from "../vault/useVaultDeposits";

export enum GardenTab {
  Work = "work",
  Pool = "pool",
  Insights = "insights",
  Gardeners = "gardeners",
}

/** Manages garden view tabs while preserving scroll position per section. */
export const useGardenTabs = () => {
  const [activeTab, setActiveTab] = useState<GardenTab>(GardenTab.Work);
  const [scrollPositions, setScrollPositions] = useState({
    [GardenTab.Work]: 0,
    [GardenTab.Pool]: 0,
    [GardenTab.Insights]: 0,
    [GardenTab.Gardeners]: 0,
  });

  // Individual refs for each tab's scrollable container
  const workRef = useRef<HTMLUListElement>(null);
  const poolRef = useRef<HTMLUListElement>(null);
  const reportsRef = useRef<HTMLUListElement>(null);
  const gardenersRef = useRef<HTMLUListElement>(null);

  // Create tabRefs object using individual refs
  const tabRefs = useRef({
    [GardenTab.Work]: workRef,
    [GardenTab.Pool]: poolRef,
    [GardenTab.Insights]: reportsRef,
    [GardenTab.Gardeners]: gardenersRef,
  }).current;

  // Save scroll position on scroll event for the active tab
  const handleScroll = useCallback(
    (tab: GardenTab) => (event: React.UIEvent<HTMLUListElement, UIEvent>) => {
      setScrollPositions((prev) => ({
        ...prev,
        [tab]: event.currentTarget.scrollTop,
      }));
    },
    []
  );

  // Restore scroll position when switching tabs
  const restoreScrollPosition = useCallback(() => {
    const currentRef = tabRefs[activeTab].current;
    if (currentRef) {
      currentRef.scrollTop = scrollPositions[activeTab];
    }
  }, [activeTab, scrollPositions, tabRefs]);

  return {
    activeTab,
    setActiveTab,
    scrollPositions,
    tabRefs,
    handleScroll,
    restoreScrollPosition,
  };
};

/** Which of a garden's gated entry points the signed-in account has (`useGardenAccess`). */
export interface GardenAccess {
  /**
   * Approves work and sees what waits for review: a steward on the garden's record, or an
   * evaluator the chain confirms.
   */
  canReview: boolean;
  /** Answers join requests from the Gardeners section: a steward or an owner on the record. */
  canManageRequests: boolean;
  /** The account holds shares in one of the garden's vaults. */
  hasEndowmentDeposits: boolean;
  /** Endowment opens: the garden has a vault, and the account reviews or has deposited. */
  showEndowment: boolean;
  /** Governance opens: its flag is on, a strategy is configured, and the account reviews. */
  showGovernance: boolean;
}

const NO_VAULTS: unknown[] = [];
const NO_DEPOSITS: Array<{ shares: bigint }> = [];

/**
 * Which of a garden's gated entry points the signed-in account has (eval A5). The garden's own
 * page gates its banner actions and the Gardeners queue on these answers, and Home's About rows
 * and the section sheets over it read the same ones (DL-128), so a row over Home never shows
 * what the page would not. Each answer is an act's existing predicate: reviewing is the work
 * page's (a steward on the record, or an evaluator on chain), requests are the queue's (stewards
 * and owners), Endowment is its sheet's (a vault, and a reviewer or a depositor), and Governance
 * its flag's. Nothing here writes, and a signed-out reader gets none of them.
 */
export function useGardenAccess(garden: Garden): GardenAccess {
  const { primaryAddress } = useUser();
  const gardenAddress = isAddress(garden.id) ? (garden.id as Address) : undefined;
  const { vaults = NO_VAULTS } = useGardenVaults(garden.id as Address, {
    enabled: Boolean(garden.id),
  });
  const { deposits = NO_DEPOSITS } = useVaultDeposits(garden.id as Address, {
    userAddress: primaryAddress ?? undefined,
    enabled: Boolean(garden.id && primaryAddress),
  });
  const { hasRole: canReviewOnChain } = useHasRole(
    garden.id as Address,
    primaryAddress as Address | undefined,
    "evaluator"
  );
  const { strategies } = useConvictionStrategies(gardenAddress, {
    enabled: GOVERNANCE_ENABLED && Boolean(gardenAddress),
  });

  const { stewards, owners } = garden;
  const hasVault = vaults.length > 0;
  const hasStrategy = strategies.length > 0;
  return useMemo(() => {
    const account = primaryAddress?.toLowerCase();
    const holds = (list: readonly string[] | undefined) =>
      Boolean(account) && (list ?? []).some((address) => address.toLowerCase() === account);
    const canReview = holds(stewards) || Boolean(account && canReviewOnChain);
    const hasEndowmentDeposits =
      Boolean(account) && deposits.some((deposit) => deposit.shares > 0n);
    return {
      canReview,
      canManageRequests: holds(stewards) || holds(owners),
      hasEndowmentDeposits,
      showEndowment: hasVault && (canReview || hasEndowmentDeposits),
      showGovernance: GOVERNANCE_ENABLED && hasStrategy && canReview,
    };
  }, [primaryAddress, stewards, owners, canReviewOnChain, deposits, hasVault, hasStrategy]);
}
