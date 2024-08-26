import React, { useEffect, useContext } from "react";

type Platform = "ios" | "android" | "windows" | "unknown";

export interface GardenDataProps {
  platform?: Platform;
}

const GardenContext = React.createContext<GardenDataProps>({});

export const useGarden = () => {
  return useContext(GardenContext);
};

export const GardenProvider = ({ children }: { children: React.ReactNode }) => {
  const platform = "android";

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <GardenContext.Provider
      value={{
        platform,
      }}
    >
      {children}
    </GardenContext.Provider>
  );
};
