import { useQuery } from "@tanstack/react-query";
import React, { useContext, useMemo } from "react";
import { fetchBadges, type Badge } from "@/modules/badges";
import { useUser } from "@/providers/user";

interface BadgesContextValue {
  badges: Badge[];
  isLoading: boolean;
  error?: unknown;
  refetch: () => void;
  greenpill: Badge | undefined;
}

const BadgesContext = React.createContext<BadgesContextValue>({
  badges: [],
  isLoading: false,
  refetch: () => {},
  greenpill: undefined,
});

export const useBadges = () => useContext(BadgesContext);

export const BadgesProvider = ({ children }: { children: React.ReactNode }) => {
  const { smartAccountAddress } = useUser();
  const {
    data: badges,
    isLoading,
    error,
    refetch,
  } = useQuery<Badge[]>({
    queryKey: ["badges", smartAccountAddress],
    queryFn: () => fetchBadges(smartAccountAddress || undefined),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    enabled: true,
  });

  const greenpill = useMemo(() => (badges || []).find((b) => b.key === "greenpill"), [badges]);

  return (
    <BadgesContext.Provider
      value={{
        badges: badges || [],
        isLoading,
        error,
        refetch: () => {
          void refetch();
        },
        greenpill,
      }}
    >
      {children}
    </BadgesContext.Provider>
  );
};
