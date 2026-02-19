import type { Address } from "./domain";

export interface CookieJar {
  jarAddress: Address;
  gardenAddress: Address;
  assetAddress: Address;
  balance: bigint;
  currency: Address;
  decimals: number;
  maxWithdrawal: bigint;
  withdrawalInterval: bigint;
  isPaused: boolean;
  emergencyWithdrawalEnabled: boolean;
}

export interface CookieJarWithdrawParams {
  jarAddress: Address;
  amount: bigint;
  purpose: string;
}

export interface CookieJarDepositParams {
  jarAddress: Address;
  amount: bigint;
  assetAddress: Address;
}

export interface CookieJarAdminParams {
  jarAddress: Address;
}

export interface CookieJarUpdateMaxWithdrawalParams {
  jarAddress: Address;
  maxWithdrawal: bigint;
}

export interface CookieJarUpdateIntervalParams {
  jarAddress: Address;
  withdrawalInterval: bigint;
}

export interface CookieJarEmergencyWithdrawParams {
  jarAddress: Address;
  tokenAddress: Address;
  amount: bigint;
}
