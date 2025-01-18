import * as react_jsx_runtime from "react/jsx-runtime";
import react__default from "react";
import * as permissionless from "permissionless";
// @ts-ignore
import * as viem__types_account_abstraction_types_userOperation from "viem/_types/account-abstraction/types/userOperation";
import * as viem_account_abstraction from "viem/account-abstraction";
import {
  SmartAccount,
  SendUserOperationParameters,
} from "viem/account-abstraction";
import * as viem from "viem";
import {
  SendTransactionParameters,
  Chain,
  Hash,
  Hex,
  TypedData,
  SignTypedDataParameters,
  EIP1193Provider,
  PublicClient,
  Client,
} from "viem";
import { SmartWalletType } from "@privy-io/js-sdk-core";
import {
  h as SendTransactionModalUIOptions,
  i as SignMessageModalUIOptions,
} from "./types-DN5ihWo1.js";
import "@solana/wallet-adapter-base";
import "@privy-io/public-api";
import "eventemitter3";
import "@metamask/eth-sig-util";
import "@solana/web3.js";

type Call = {
  readonly to?: any;
  readonly value?: any;
  readonly data?: any;
};
declare const signerToSmartAccountClient: ({
  owner,
  smartWalletType,
  chain,
  publicClient,
  bundlerUrl,
  paymasterUrl,
  paymasterContext,
}: {
  owner: EIP1193Provider;
  smartWalletType: SmartWalletType;
  chain: Chain;
  publicClient: PublicClient;
  bundlerUrl: string;
  paymasterUrl?: string;
  paymasterContext?: Record<string, any>;
}) => Promise<
  permissionless.SmartAccountClient<
    viem.HttpTransport,
    Chain,
    object & {
      client: Client;
      entryPoint: {
        abi: readonly [
          {
            readonly inputs: readonly [
              {
                readonly name: "success";
                readonly type: "bool";
              },
              {
                readonly name: "ret";
                readonly type: "bytes";
              },
            ];
            readonly name: "DelegateAndRevert";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "opIndex";
                readonly type: "uint256";
              },
              {
                readonly name: "reason";
                readonly type: "string";
              },
            ];
            readonly name: "FailedOp";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "opIndex";
                readonly type: "uint256";
              },
              {
                readonly name: "reason";
                readonly type: "string";
              },
              {
                readonly name: "inner";
                readonly type: "bytes";
              },
            ];
            readonly name: "FailedOpWithRevert";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "returnData";
                readonly type: "bytes";
              },
            ];
            readonly name: "PostOpReverted";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [];
            readonly name: "ReentrancyGuardReentrantCall";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "sender";
                readonly type: "address";
              },
            ];
            readonly name: "SenderAddressResult";
            readonly type: "error";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "aggregator";
                readonly type: "address";
              },
            ];
            readonly name: "SignatureValidationFailed";
            readonly type: "error";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "userOpHash";
                readonly type: "bytes32";
              },
              {
                readonly indexed: true;
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "factory";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "paymaster";
                readonly type: "address";
              },
            ];
            readonly name: "AccountDeployed";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [];
            readonly name: "BeforeExecution";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "account";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "totalDeposit";
                readonly type: "uint256";
              },
            ];
            readonly name: "Deposited";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "userOpHash";
                readonly type: "bytes32";
              },
              {
                readonly indexed: true;
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "nonce";
                readonly type: "uint256";
              },
              {
                readonly indexed: false;
                readonly name: "revertReason";
                readonly type: "bytes";
              },
            ];
            readonly name: "PostOpRevertReason";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "aggregator";
                readonly type: "address";
              },
            ];
            readonly name: "SignatureAggregatorChanged";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "account";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "totalStaked";
                readonly type: "uint256";
              },
              {
                readonly indexed: false;
                readonly name: "unstakeDelaySec";
                readonly type: "uint256";
              },
            ];
            readonly name: "StakeLocked";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "account";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "withdrawTime";
                readonly type: "uint256";
              },
            ];
            readonly name: "StakeUnlocked";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "account";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "withdrawAddress";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "amount";
                readonly type: "uint256";
              },
            ];
            readonly name: "StakeWithdrawn";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "userOpHash";
                readonly type: "bytes32";
              },
              {
                readonly indexed: true;
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly indexed: true;
                readonly name: "paymaster";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "nonce";
                readonly type: "uint256";
              },
              {
                readonly indexed: false;
                readonly name: "success";
                readonly type: "bool";
              },
              {
                readonly indexed: false;
                readonly name: "actualGasCost";
                readonly type: "uint256";
              },
              {
                readonly indexed: false;
                readonly name: "actualGasUsed";
                readonly type: "uint256";
              },
            ];
            readonly name: "UserOperationEvent";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "userOpHash";
                readonly type: "bytes32";
              },
              {
                readonly indexed: true;
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "nonce";
                readonly type: "uint256";
              },
            ];
            readonly name: "UserOperationPrefundTooLow";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "userOpHash";
                readonly type: "bytes32";
              },
              {
                readonly indexed: true;
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "nonce";
                readonly type: "uint256";
              },
              {
                readonly indexed: false;
                readonly name: "revertReason";
                readonly type: "bytes";
              },
            ];
            readonly name: "UserOperationRevertReason";
            readonly type: "event";
          },
          {
            readonly anonymous: false;
            readonly inputs: readonly [
              {
                readonly indexed: true;
                readonly name: "account";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "withdrawAddress";
                readonly type: "address";
              },
              {
                readonly indexed: false;
                readonly name: "amount";
                readonly type: "uint256";
              },
            ];
            readonly name: "Withdrawn";
            readonly type: "event";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "unstakeDelaySec";
                readonly type: "uint32";
              },
            ];
            readonly name: "addStake";
            readonly outputs: readonly [];
            readonly stateMutability: "payable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "account";
                readonly type: "address";
              },
            ];
            readonly name: "balanceOf";
            readonly outputs: readonly [
              {
                readonly name: "";
                readonly type: "uint256";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "target";
                readonly type: "address";
              },
              {
                readonly name: "data";
                readonly type: "bytes";
              },
            ];
            readonly name: "delegateAndRevert";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "account";
                readonly type: "address";
              },
            ];
            readonly name: "depositTo";
            readonly outputs: readonly [];
            readonly stateMutability: "payable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "";
                readonly type: "address";
              },
            ];
            readonly name: "deposits";
            readonly outputs: readonly [
              {
                readonly name: "deposit";
                readonly type: "uint256";
              },
              {
                readonly name: "staked";
                readonly type: "bool";
              },
              {
                readonly name: "stake";
                readonly type: "uint112";
              },
              {
                readonly name: "unstakeDelaySec";
                readonly type: "uint32";
              },
              {
                readonly name: "withdrawTime";
                readonly type: "uint48";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "account";
                readonly type: "address";
              },
            ];
            readonly name: "getDepositInfo";
            readonly outputs: readonly [
              {
                readonly components: readonly [
                  {
                    readonly name: "deposit";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "staked";
                    readonly type: "bool";
                  },
                  {
                    readonly name: "stake";
                    readonly type: "uint112";
                  },
                  {
                    readonly name: "unstakeDelaySec";
                    readonly type: "uint32";
                  },
                  {
                    readonly name: "withdrawTime";
                    readonly type: "uint48";
                  },
                ];
                readonly name: "info";
                readonly type: "tuple";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "sender";
                readonly type: "address";
              },
              {
                readonly name: "key";
                readonly type: "uint192";
              },
            ];
            readonly name: "getNonce";
            readonly outputs: readonly [
              {
                readonly name: "nonce";
                readonly type: "uint256";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "initCode";
                readonly type: "bytes";
              },
            ];
            readonly name: "getSenderAddress";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly components: readonly [
                  {
                    readonly name: "sender";
                    readonly type: "address";
                  },
                  {
                    readonly name: "nonce";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "initCode";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "callData";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "accountGasLimits";
                    readonly type: "bytes32";
                  },
                  {
                    readonly name: "preVerificationGas";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "gasFees";
                    readonly type: "bytes32";
                  },
                  {
                    readonly name: "paymasterAndData";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "signature";
                    readonly type: "bytes";
                  },
                ];
                readonly name: "userOp";
                readonly type: "tuple";
              },
            ];
            readonly name: "getUserOpHash";
            readonly outputs: readonly [
              {
                readonly name: "";
                readonly type: "bytes32";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly components: readonly [
                  {
                    readonly components: readonly [
                      {
                        readonly name: "sender";
                        readonly type: "address";
                      },
                      {
                        readonly name: "nonce";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "initCode";
                        readonly type: "bytes";
                      },
                      {
                        readonly name: "callData";
                        readonly type: "bytes";
                      },
                      {
                        readonly name: "accountGasLimits";
                        readonly type: "bytes32";
                      },
                      {
                        readonly name: "preVerificationGas";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "gasFees";
                        readonly type: "bytes32";
                      },
                      {
                        readonly name: "paymasterAndData";
                        readonly type: "bytes";
                      },
                      {
                        readonly name: "signature";
                        readonly type: "bytes";
                      },
                    ];
                    readonly name: "userOps";
                    readonly type: "tuple[]";
                  },
                  {
                    readonly name: "aggregator";
                    readonly type: "address";
                  },
                  {
                    readonly name: "signature";
                    readonly type: "bytes";
                  },
                ];
                readonly name: "opsPerAggregator";
                readonly type: "tuple[]";
              },
              {
                readonly name: "beneficiary";
                readonly type: "address";
              },
            ];
            readonly name: "handleAggregatedOps";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly components: readonly [
                  {
                    readonly name: "sender";
                    readonly type: "address";
                  },
                  {
                    readonly name: "nonce";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "initCode";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "callData";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "accountGasLimits";
                    readonly type: "bytes32";
                  },
                  {
                    readonly name: "preVerificationGas";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "gasFees";
                    readonly type: "bytes32";
                  },
                  {
                    readonly name: "paymasterAndData";
                    readonly type: "bytes";
                  },
                  {
                    readonly name: "signature";
                    readonly type: "bytes";
                  },
                ];
                readonly name: "ops";
                readonly type: "tuple[]";
              },
              {
                readonly name: "beneficiary";
                readonly type: "address";
              },
            ];
            readonly name: "handleOps";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "key";
                readonly type: "uint192";
              },
            ];
            readonly name: "incrementNonce";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "callData";
                readonly type: "bytes";
              },
              {
                readonly components: readonly [
                  {
                    readonly components: readonly [
                      {
                        readonly name: "sender";
                        readonly type: "address";
                      },
                      {
                        readonly name: "nonce";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "verificationGasLimit";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "callGasLimit";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "paymasterVerificationGasLimit";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "paymasterPostOpGasLimit";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "preVerificationGas";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "paymaster";
                        readonly type: "address";
                      },
                      {
                        readonly name: "maxFeePerGas";
                        readonly type: "uint256";
                      },
                      {
                        readonly name: "maxPriorityFeePerGas";
                        readonly type: "uint256";
                      },
                    ];
                    readonly name: "mUserOp";
                    readonly type: "tuple";
                  },
                  {
                    readonly name: "userOpHash";
                    readonly type: "bytes32";
                  },
                  {
                    readonly name: "prefund";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "contextOffset";
                    readonly type: "uint256";
                  },
                  {
                    readonly name: "preOpGas";
                    readonly type: "uint256";
                  },
                ];
                readonly name: "opInfo";
                readonly type: "tuple";
              },
              {
                readonly name: "context";
                readonly type: "bytes";
              },
            ];
            readonly name: "innerHandleOp";
            readonly outputs: readonly [
              {
                readonly name: "actualGasCost";
                readonly type: "uint256";
              },
            ];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "";
                readonly type: "address";
              },
              {
                readonly name: "";
                readonly type: "uint192";
              },
            ];
            readonly name: "nonceSequenceNumber";
            readonly outputs: readonly [
              {
                readonly name: "";
                readonly type: "uint256";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "interfaceId";
                readonly type: "bytes4";
              },
            ];
            readonly name: "supportsInterface";
            readonly outputs: readonly [
              {
                readonly name: "";
                readonly type: "bool";
              },
            ];
            readonly stateMutability: "view";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [];
            readonly name: "unlockStake";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "withdrawAddress";
                readonly type: "address";
              },
            ];
            readonly name: "withdrawStake";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly inputs: readonly [
              {
                readonly name: "withdrawAddress";
                readonly type: "address";
              },
              {
                readonly name: "withdrawAmount";
                readonly type: "uint256";
              },
            ];
            readonly name: "withdrawTo";
            readonly outputs: readonly [];
            readonly stateMutability: "nonpayable";
            readonly type: "function";
          },
          {
            readonly stateMutability: "payable";
            readonly type: "receive";
          },
        ];
        address: viem.Address;
        version: "0.7";
      };
      extend?: object | undefined;
      getAddress: () => Promise<viem.Address>;
      decodeCalls?:
        | ((data: Hex) => Promise<
            readonly {
              to: Hex;
              data?: Hex | undefined;
              value?: bigint | undefined;
            }[]
          >)
        | undefined;
      encodeCalls: (
        calls: readonly {
          to: Hex;
          data?: Hex | undefined;
          value?: bigint | undefined;
        }[]
      ) => Promise<Hex>;
      getFactoryArgs: () => Promise<{
        factory?: viem.Address | undefined;
        factoryData?: Hex | undefined;
      }>;
      getNonce?:
        | ((
            parameters?:
              | {
                  key?: bigint | undefined;
                }
              | undefined
          ) => Promise<bigint>)
        | undefined;
      getStubSignature: () => Promise<Hex>;
      nonceKeyManager?: viem.NonceManager | undefined;
      sign: (parameters: { hash: Hash }) => Promise<Hex>;
      signMessage: (parameters: {
        message: viem.SignableMessage;
      }) => Promise<Hex>;
      signTypedData: <
        const typedData extends TypedData | Record<string, unknown>,
        primaryType extends keyof typedData | "EIP712Domain" = keyof typedData,
      >(
        parameters: viem.TypedDataDefinition<typedData, primaryType>
      ) => Promise<Hex>;
      signUserOperation: (
        parameters: viem.UnionPartialBy<
          viem_account_abstraction.UserOperation,
          "sender"
        > & {
          chainId?: number | undefined;
        }
      ) => Promise<Hex>;
      userOperation?:
        | {
            estimateGas?:
              | ((
                  userOperation: viem_account_abstraction.UserOperationRequest
                ) => Promise<
                  | viem.ExactPartial<viem__types_account_abstraction_types_userOperation.EstimateUserOperationGasReturnType>
                  | undefined
                >)
              | undefined;
          }
        | undefined;
    } & {
      address: viem.Address;
      getNonce: NonNullable<
        viem_account_abstraction.SmartAccountImplementation["getNonce"]
      >;
      isDeployed: () => Promise<boolean>;
      type: "smart";
    },
    undefined,
    undefined
  >
>;
type SmartWalletClientType = Omit<
  Awaited<ReturnType<typeof signerToSmartAccountClient>>,
  "sendTransaction" | "signMessage"
> & {
  sendTransaction: (
    input:
      | SendTransactionParameters<Chain, SmartAccount>
      | SendUserOperationParameters<SmartAccount, undefined, Call[]>,
    options?: {
      uiOptions?: SendTransactionModalUIOptions;
    }
  ) => Promise<Hash>;
  signMessage: (
    input: {
      message: string;
    },
    options?: {
      uiOptions?: SignMessageModalUIOptions;
    }
  ) => Promise<Hex>;
  signTypedData: <
    const TTypedData extends
      | TypedData
      | {
          [key: string]: unknown;
        },
    TPrimaryType extends string,
    TAccount extends SmartAccount | undefined = SmartAccount | undefined,
  >(
    input: SignTypedDataParameters<TTypedData, TPrimaryType, TAccount>,
    options?: {
      uiOptions?: SignMessageModalUIOptions;
    }
  ) => Promise<Hex>;
};

interface SmartWalletClientTypeWithSwitchChain extends SmartWalletClientType {
  switchChain: (args: { id: number }) => Promise<void>;
}

interface SmartWalletsInterface {
  client?: SmartWalletClientTypeWithSwitchChain;
}
interface SmartWalletsProviderProps {
  config?: {
    paymasterContext?: Record<string, any>;
  };
  children: react__default.ReactNode;
}
declare const SmartWalletsProvider: ({
  config,
  children,
}: SmartWalletsProviderProps) => react_jsx_runtime.JSX.Element;
declare const useSmartWallets: () => SmartWalletsInterface;

export {
  SmartWalletsProvider,
  type SmartWalletsProviderProps,
  useSmartWallets,
};
