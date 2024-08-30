import React, { useContext } from "react";
import { User } from "@privy-io/react-auth";
import { useQuery } from "@tanstack/react-query";
import { getGardeners, getGardens } from "@/modules/greengoods";

export interface GardenDataProps {
  gardens: GardenCard[];
  gardeners: User[];
}

const GardenContext = React.createContext<GardenDataProps>({
  gardens: [],
  gardeners: [],
});

export const useGarden = () => {
  return useContext(GardenContext);
};

export const GardenProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: gardens } = useQuery<GardenCard[]>({
    queryKey: ["gardens"],
    queryFn: getGardens,
  });
  const { data: gardeners } = useQuery<User[]>({
    queryKey: ["gardeners"],
    queryFn: getGardeners,
  });

  return (
    <GardenContext.Provider
      value={{
        gardens: gardens || [],
        gardeners: gardeners || [],
      }}
    >
      {children}
    </GardenContext.Provider>
  );
};
