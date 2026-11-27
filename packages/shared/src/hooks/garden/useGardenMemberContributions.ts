import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { gardensKeys } from "../../config/query-keys/garden";
import {
  getGardenMemberContributions,
  type GardenMemberContribution,
} from "../../modules/data/garden-member-contributions";
import {
  type GardenMemberReadiness,
  getGardenMemberReadiness,
} from "../../modules/data/garden-member-readiness";
import type { Address, Garden } from "../../types/domain";
import { isAddressInList } from "../../utils/blockchain/address";
import { usePrimaryAddress } from "../auth/usePrimaryAddress";

/** These public facts are displayed only to this garden's stewards and owners. */
export function useGardenMemberContributions({
  garden,
  accounts,
  enabled = true,
}: {
  garden?: Pick<Garden, "id" | "chainId" | "owners" | "stewards">;
  accounts: readonly Address[];
  enabled?: boolean;
}) {
  const viewer = usePrimaryAddress();
  const canView = Boolean(
    garden && (isAddressInList(viewer, garden.owners) || isAddressInList(viewer, garden.stewards))
  );
  const members = [...new Set(accounts.map((account) => account.toLowerCase() as Address))].sort();
  const active = canView && enabled && members.length > 0;
  const query = useQuery({
    queryKey: gardensKeys.memberContributions(garden?.id, members, garden?.chainId),
    queryFn: ({ signal }) => {
      if (!garden || !active) throw new Error("Contribution scope unavailable");
      return getGardenMemberContributions(
        { garden: garden.id as Address, accounts: members, chainId: garden.chainId },
        undefined,
        signal
      );
    },
    enabled: active,
    staleTime: 30_000,
    retry: false,
  });
  // `enabled: false` alone still exposes cached data after a role or garden switch.
  const byAccount: Record<string, GardenMemberContribution> = {};
  if (active) {
    for (const account of members)
      byAccount[account] = query.isError
        ? { status: "unavailable" }
        : (query.data?.[account] ?? { status: "loading" });
  }
  return { canView, byAccount };
}

/**
 * One member's readiness (`modules/data/garden-member-readiness`). A local alias rather than a
 * re-export: Storybook's module mock reads a re-export as a runtime import and fails on a type.
 */
export type MemberReadiness = GardenMemberReadiness;

/**
 * Each member's readiness in the garden: joined only, sent work, or had work approved, with
 * the evidence for it (PRD-1537). Read only for the garden's stewards and owners, as the
 * contribution dates are, and only while the Gardeners list shows readiness.
 */
export function useGardenMemberReadiness({
  garden,
  accounts,
  enabled = true,
}: {
  garden?: Pick<Garden, "id" | "chainId" | "owners" | "stewards">;
  accounts: readonly Address[];
  enabled?: boolean;
}) {
  const viewer = usePrimaryAddress();
  const canView = Boolean(
    garden && (isAddressInList(viewer, garden.owners) || isAddressInList(viewer, garden.stewards))
  );
  const members = [...new Set(accounts.map((account) => account.toLowerCase() as Address))].sort();
  const active = canView && enabled && members.length > 0;
  const query = useQuery({
    queryKey: gardensKeys.memberReadiness(garden?.id, members, garden?.chainId),
    queryFn: ({ signal }) => {
      if (!garden || !active) throw new Error("Readiness scope unavailable");
      return getGardenMemberReadiness(
        { garden: garden.id as Address, accounts: members, chainId: garden.chainId },
        undefined,
        signal
      );
    },
    enabled: active,
    staleTime: 30_000,
    retry: false,
  });
  const memberKey = members.join(",");
  // One object per answer, so the list's filters and counts recompute only when it changes.
  const byAccount = useMemo(() => {
    const entries: Record<string, MemberReadiness> = {};
    if (!active) return entries;
    for (const account of memberKey.split(","))
      entries[account] = query.isError
        ? { status: "unavailable" }
        : (query.data?.[account] ?? { status: "loading" });
    return entries;
  }, [active, memberKey, query.data, query.isError]);
  return { canView, byAccount };
}
