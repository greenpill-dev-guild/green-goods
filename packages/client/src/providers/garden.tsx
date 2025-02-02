import React, { useContext } from "react";
import { useQuery } from "@tanstack/react-query";

import { getGardenAssessments, getWorks } from "@/modules/eas";
import { getActions, getGardens, getGardeners } from "@/modules/greengoods";

import { useUser } from "./user";
import { useWork } from "./work";

interface GardenDataProps {
  isOperator: boolean;
  garden?: Garden;
  gardeners: GardenerCard[];
  error?: Error | null;
}

interface GardensDataProps {
  actions: Action[];
  gardens: Garden[];
  gardenersMap: Map<string, GardenerCard>;
}

export const useGarden = (id: string): GardenDataProps => {
  const { gardens, gardenersMap } = useGardens();
  const { workApprovalMap } = useWork();
  const { eoa, smartAccountAddress } = useUser();

  const { data: garden, error } = useQuery<
    Garden,
    Error,
    Garden,
    [string, string]
  >({
    _optimisticResults: "optimistic",
    initialData: gardens.find((garden) => garden.id === id),
    queryKey: ["gardens", id],
    queryFn: async ({ queryKey }) => {
      const [_, id] = queryKey;
      const garden = gardens.find((garden) => garden.id === id);

      if (!garden) throw new Error("Garden not found");

      const assessments = await getGardenAssessments(id);
      const works: Work[] = (await getWorks(id)).map((work) => {
        const workApproval = workApprovalMap[work.id];

        return {
          ...work,
          status:
            workApproval ?
              workApproval.approved ?
                "approved"
              : "rejected"
            : "pending",
        };
      });

      return { ...garden, assessments, works };
    },
  });

  return {
    isOperator:
      !!garden?.operators.includes(eoa?.address!) ||
      !!garden?.operators.includes(smartAccountAddress!),
    garden,
    gardeners:
      garden?.gardeners.reduce<GardenerCard[]>((acc, id) => {
        const user = gardenersMap.get(id);
        if (user) acc.push(user);
        else acc.push({ id, account: id, registeredAt: new Date() });
        return acc;
      }, []) ?? [],
    error,
  };
};

const GardensContext = React.createContext<GardensDataProps>({
  actions: [],
  gardens: [],
  gardenersMap: new Map(),
});

export const useGardens = () => {
  return useContext(GardensContext);
};

export const GardensProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // QUERIES
  const { data: actions } = useQuery<Action[]>({
    queryKey: ["actions"],
    queryFn: getActions,
  });

  const { data: gardens } = useQuery<Garden[]>({
    queryKey: ["gardens"],
    queryFn: getGardens,
  });
  const { data: gardeners } = useQuery<GardenerCard[]>({
    queryKey: ["gardeners"],
    queryFn: getGardeners,
  });

  return (
    <GardensContext.Provider
      value={{
        actions: actions || [],
        gardens: gardens || [],
        gardenersMap: new Map(
          gardeners?.map((gardener) => [gardener.id, gardener]) || []
        ),
      }}
    >
      {children}
    </GardensContext.Provider>
  );
};
