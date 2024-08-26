// import { getContract } from "viem";
import React, { useEffect, useContext } from "react";

// import { useSmartAccount } from "./SmartAccountProvider";

type Platform = "ios" | "android" | "windows" | "unknown";

export interface WorkDataProps {
  platform?: Platform;
  uploadWork?: () => void;
}

const WorkContext = React.createContext<WorkDataProps>({});

export const useWork = () => {
  return useContext(WorkContext);
};

export const WorkProvider = ({ children }: { children: React.ReactNode }) => {
  const platform = "android";

  // const { smartAccountClient } = useSmartAccount();

  // const easContract = getContract({
  //   address: "0x6d3dC0Fe5351087E3Af3bDe8eB3F7350ed894fc3",
  //   abi: [],
  //   client: smartAccountClient,
  // });

  function uploadWork() {
    // easContract.write.
    console.log("uploadWork");
  }

  useEffect(() => {
    return () => {};
  }, []);

  return (
    <WorkContext.Provider
      value={{
        platform,
        uploadWork,
      }}
    >
      {children}
    </WorkContext.Provider>
  );
};
