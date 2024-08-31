import React, { useContext } from "react";
import { User } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";

import { getGardenAssessments } from "@/modules/eas";
import { getActions, getGardeners, getGardens } from "@/modules/greengoods";

import { GREEN_GOODS_GARDEN_OPERATOR_WHITELIST } from "@/constants";

export type Gardener = User & { operator: boolean };

export interface GardenDataProps {
  actions: Action[];
  gardens: Garden[];
  gardeners: Gardener[];
}

const GardenContext = React.createContext<GardenDataProps>({
  actions: [],
  gardens: [],
  gardeners: [],
});

export const useGarden = () => {
  return useContext(GardenContext);
};

export const GardenProvider = ({ children }: { children: React.ReactNode }) => {
  // QUERIES
  const { data: actions } = useQuery<Action[]>({
    queryKey: ["actions"],
    queryFn: getActions,
  });

  const { data: gardens } = useQuery<Garden[]>({
    queryKey: ["gardens"],
    queryFn: async () => {
      const gardens = getGardens();
      const assessments = await getGardenAssessments();

      return gardens.map((garden) => {
        garden.gardenAssessments = assessments.filter(
          (assessment) => assessment.gardenAddress === garden.id
        );

        return garden;
      });
    },
  });
  const { data: gardeners } = useQuery<User[]>({
    queryKey: ["gardeners"],
    queryFn: getGardeners,
  });

  return (
    <GardenContext.Provider
      value={{
        actions: actions || [],
        gardens: gardens || [],
        gardeners:
          gardeners?.map((gardener) => {
            return {
              ...gardener,
              operator: GREEN_GOODS_GARDEN_OPERATOR_WHITELIST.includes(
                gardener.email?.address || gardener.phone?.number || ""
              ),
            };
          }) || [],
      }}
    >
      {children}
    </GardenContext.Provider>
  );
};
