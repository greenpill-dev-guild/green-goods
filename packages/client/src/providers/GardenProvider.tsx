import React, { useContext } from "react";
import { useQuery } from "@tanstack/react-query";

export interface GardenDataProps {
  gardens: Garden[];
  gardeners: GardenerCard[];
}

const GardenContext = React.createContext<GardenDataProps>({
  gardens: [],
  gardeners: [],
});

export const useGarden = () => {
  return useContext(GardenContext);
};

export const GardenProvider = ({ children }: { children: React.ReactNode }) => {
  const { data: gardens } = useQuery<Garden[]>({
    queryKey: ["gardens"],
    queryFn: () => [],
  });
  const { data: gardeners } = useQuery<GardenerCard[]>({
    queryKey: ["gardeners"],
    queryFn: () => [],
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
