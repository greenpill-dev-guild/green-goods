import { getContract } from "viem";

import { abi } from "../abis/EAS.json";

import { useSmartAccount } from "./SmartAccountProvider";

const useWork = () => {
  const { smartAccountClient } = useSmartAccount();

  const easContract = getContract({
    address: "0x6d3dC0Fe5351087E3Af3bDe8eB3F7350ed894fc3",
    abi,
    client: smartAccountClient,
  });

  function uploadWork() {
    // easContract.write.
    console.log("uploadWork");
  }
};
