import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  ContractFunctionZeroDataError,
} from "viem";

/**
 * The chain answered, but the contract had no value to give: nothing is deployed at the address,
 * or it has no such read, or it refused the read. A contract from before a read was added answers
 * this way. Any other failure means the read never reached the chain.
 */
export function isUnansweredContractRead(error: unknown): boolean {
  return (
    error instanceof ContractFunctionExecutionError &&
    (error.cause instanceof ContractFunctionZeroDataError ||
      error.cause instanceof ContractFunctionRevertedError)
  );
}
