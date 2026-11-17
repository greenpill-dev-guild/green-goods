import { useQuery } from "@tanstack/react-query";
import { gardensKeys } from "../../config/query-keys/garden";
import {
  getGardenMemberContributions,
  type GardenMemberContribution,
} from "../../modules/data/garden-member-contributions";
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
