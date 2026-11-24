import { useQuery } from "@tanstack/react-query";
import { gardenJoinRequestKeys } from "../../config/query-keys/garden-join-requests";
import { gardenJoinRequestTransport } from "../../modules/garden-join-requests";
import type { GardenJoinRequestKind } from "../../public-contracts/join-requests";

/** Whether the join-request service is on and takes requests of `kind`. */
export function useGardenJoinRequestAvailability(
  kind: GardenJoinRequestKind = "garden_membership"
): boolean {
  return useGardenJoinRequestAvailabilityState(kind).available;
}

export function useGardenJoinRequestAvailabilityState(
  kind: GardenJoinRequestKind = "garden_membership"
) {
  const query = useQuery({
    queryKey: gardenJoinRequestKeys.availability(),
    queryFn: () => gardenJoinRequestTransport.availability(),
    staleTime: 60_000,
    retry: false,
  });
  return {
    available:
      query.data?.enabled === true &&
      (query.data.supportedKinds ?? ["garden_membership"]).includes(kind),
    isLoading: query.isPending,
    error: query.error,
  };
}
