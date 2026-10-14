import type { Abi } from "viem";
import type { Address } from "../../types/domain";

export type GardenUpdateValue = string | boolean | bigint;

export interface UpdateGardenCommand {
  gardenAddress: Address;
  functionName: string;
  value: GardenUpdateValue;
  abi: Abi;
}

export interface UpdateGardenPorts {
  sender: (call: {
    address: Address;
    abi: Abi;
    functionName: string;
    args: [GardenUpdateValue];
  }) => Promise<`0x${string}`>;
}

export function updateGarden(
  command: UpdateGardenCommand,
  ports: UpdateGardenPorts
): Promise<`0x${string}`> {
  return ports.sender({
    address: command.gardenAddress,
    abi: command.abi,
    functionName: command.functionName,
    args: [command.value],
  });
}
