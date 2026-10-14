import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { isAddress } from "viem";
import { isGardenPubliclyReachable } from "../../../config/garden-visibility";
import { gardenJoinRequestKeys } from "../../../config/query-keys/garden-join-requests";
import { gardensKeys } from "../../../config/query-keys/garden";
import { roleKeys } from "../../../config/query-keys/identity";
import { derivePublicGardenSlug } from "../../../public-contracts/garden-slug";
import type { GardenJoinRequestedVia } from "../../../public-contracts/join-requests";
import type { Address, Garden } from "../../../types/domain";
import { useAuth } from "../../auth/useAuth";
import { usePrimaryAddress } from "../../auth/usePrimaryAddress";
import { useGardens } from "../../blockchain/useBaseLists";
import { useCurrentChain } from "../../blockchain/useChainConfig";
import { useEnsName } from "../../blockchain/useEnsName";
import { useGardenJoinRequestActivity } from "../../garden/useGardenJoinRequestActivity";
import {
  useGardenJoinRequestAvailabilityState,
  useGardenJoinRequests,
} from "../../garden/useGardenJoinRequests";

/** Resolve a known garden, never navigate to or fetch a pasted URL. */
export function parseStewardGardenTarget(
  input: string,
  gardens: Garden[],
  chainId: number
): Garden | null {
  const value = input.trim();
  const reachable = gardens.filter(
    (garden) => garden.chainId === chainId && isGardenPubliclyReachable(garden)
  );
  if (isAddress(value, { strict: false }))
    return reachable.find((garden) => garden.id.toLowerCase() === value.toLowerCase()) ?? null;
  try {
    const url = new URL(value);
    const host = url.hostname;
    if (
      !["http:", "https:"].includes(url.protocol) ||
      !(
        host === "greengoods.app" ||
        host.endsWith(".greengoods.app") ||
        ["localhost", "127.0.0.1", "[::1]"].includes(host)
      )
    )
      return null;
    if (url.searchParams.has("chainId") && Number(url.searchParams.get("chainId")) !== chainId)
      return null;
    const address =
      url.searchParams.get("gardenId") ??
      url.pathname.match(/\/(?:garden|gardens)\/(0x[0-9a-fA-F]{40})(?:\/|$)/)?.[1];
    if (address && isAddress(address, { strict: false }))
      return reachable.find((garden) => garden.id.toLowerCase() === address.toLowerCase()) ?? null;
    const slug = url.pathname.match(/^\/sites\/([^/]+)\/?$/)?.[1];
    return slug
      ? (reachable.find(
          (garden) => derivePublicGardenSlug(garden.name, garden.id) === decodeURIComponent(slug)
        ) ?? null)
      : null;
  } catch {
    return null;
  }
}

/** Presentation only; signed authorization and role checks remain in the request capability. */
export function useStewardAccessRequestController(
  requestedVia: Extract<GardenJoinRequestedVia, "admin_access" | "account_profile">
) {
  const client = useQueryClient();
  const chainId = useCurrentChain();
  const accountAddress = usePrimaryAddress() as Address | null;
  const { authMode } = useAuth();
  const { data: ensName } = useEnsName(accountAddress);
  const catalog = useGardens(chainId);
  const gardens = catalog.data ?? [];
  const availability = useGardenJoinRequestAvailabilityState("steward_access");
  const available = availability.available;
  const targetKey = useMemo(
    () =>
      gardenJoinRequestKeys.target(
        chainId,
        accountAddress ?? "none",
        "steward_access",
        authMode ?? "none"
      ),
    [chainId, accountAddress, authMode]
  );
  const identity = targetKey.join(":");
  const previousIdentity = useRef({ identity, key: targetKey });
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "review">("choose");
  const [search, setSearch] = useState("");
  const [note, setNote] = useState("");
  const selected = useQuery<Address | null>({
    queryKey: targetKey,
    queryFn: async () => null,
    enabled: false,
    initialData: null,
    gcTime: 5 * 60_000,
  });
  const selectedGarden =
    gardens.find(
      (garden) =>
        garden.chainId === chainId &&
        garden.id.toLowerCase() === selected.data?.toLowerCase() &&
        isGardenPubliclyReachable(garden)
    ) ?? null;
  const targetScope = `${identity}:${selected.data ?? "none"}`;
  const previousTarget = useRef(targetScope);
  useLayoutEffect(() => {
    if (previousTarget.current !== targetScope) {
      previousTarget.current = targetScope;
      setNote("");
      setSearch("");
      setStep(selectedGarden ? "review" : "choose");
    }
  }, [targetScope, selectedGarden]);
  const join = useGardenJoinRequests(selectedGarden?.id as Address | undefined, {
    kind: "steward_access",
  });
  const feedback = useGardenJoinRequestActivity(join.scopeKey);
  useLayoutEffect(() => {
    if (previousIdentity.current.identity !== identity) {
      client.removeQueries({ queryKey: previousIdentity.current.key, exact: true });
      previousIdentity.current = { identity, key: targetKey };
      setOpen(false);
      setStep("choose");
      setSearch("");
      setNote("");
    }
  }, [client, identity, targetKey]);
  useEffect(() => {
    if (join.request?.kind === "steward_access" && join.request.state === "welcomed") {
      void client.invalidateQueries({ queryKey: gardensKeys.byChain(chainId) });
      void client.invalidateQueries({ queryKey: roleKeys.all });
    }
  }, [client, chainId, join.request?.kind, join.request?.state]);
  const directTarget = parseStewardGardenTarget(search, gardens, chainId);
  const isLinkOrAddress = /^(?:https?:\/\/|0x)/i.test(search.trim());
  const candidates = directTarget
    ? [directTarget]
    : isLinkOrAddress
      ? []
      : gardens.filter(
          (garden) =>
            garden.chainId === chainId &&
            isGardenPubliclyReachable(garden) &&
            `${garden.name} ${garden.location}`
              .toLocaleLowerCase()
              .includes(search.trim().toLocaleLowerCase())
        );
  const busy =
    feedback.activity !== null || join.mutationState.isLoading || join.statusState.isLoading;
  return {
    accountAddress,
    available,
    busy,
    open,
    setOpen(next: boolean) {
      if (next && selectedGarden) setStep("review");
      setOpen(next);
    },
    step,
    setStep,
    search,
    setSearch,
    note,
    setNote,
    serviceLoading: availability.isLoading,
    serviceError: availability.error,
    retryAvailability: () =>
      client.invalidateQueries({ queryKey: gardenJoinRequestKeys.availability() }),
    selectedGarden,
    candidates,
    invalidLink: isLinkOrAddress && !directTarget,
    catalogLoading: catalog.isLoading,
    catalogError: catalog.isError,
    reloadGardens: catalog.refetch,
    request: join.request,
    hasCheckedStatus: join.hasCheckedStatus,
    outcomeUnknown: join.outcomeUnknown,
    canRefreshStatus: join.canRefreshStatus,
    error: join.mutationState.error ?? join.statusState.error,
    activity: feedback.activity,
    selectGarden(garden: Garden) {
      client.setQueryData(targetKey, garden.id as Address);
      setStep("review");
      setNote("");
    },
    async send() {
      if (
        !available ||
        !selectedGarden ||
        !accountAddress ||
        busy ||
        join.outcomeUnknown ||
        (join.request && !join.request.canAskAgain)
      )
        return;
      const result = await feedback.run("sending", () =>
        join.submitRequest({
          displayName: ensName ?? accountAddress,
          requestedVia,
          note: note.trim() || undefined,
        })
      );
      if (result) setNote("");
    },
    async check() {
      if (available && selectedGarden && !busy)
        await feedback.run("checking", () => join.checkStatus());
    },
    async withdraw() {
      if (available && join.request?.state === "pending" && !busy)
        await feedback.run("withdrawing", () => join.withdrawRequest());
    },
  };
}

export type StewardAccessRequestController = ReturnType<typeof useStewardAccessRequestController>;
