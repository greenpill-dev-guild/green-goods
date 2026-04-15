import type { Address } from "../../types/domain";

export const gardenersKeys = {
  all: ["greengoods", "gardeners"] as const,
  byAddress: (address: Address) => ["greengoods", "gardeners", "byAddress", address] as const,
} as const;

export const gardenerProfileKeys = {
  all: ["greengoods", "gardener-profile"] as const,
  byAddress: (address: Address, chainId: number) =>
    ["greengoods", "gardener-profile", address, chainId] as const,
} as const;

export const ensKeys = {
  all: ["greengoods", "ens"] as const,
  name: (address: Address | string) => ["greengoods", "ens", "name", address] as const,
  address: (name: string) => ["greengoods", "ens", "address", name] as const,
  avatar: (address: Address | string) => ["greengoods", "ens", "avatar", address] as const,
  registrationStatus: (slug: string) => ["greengoods", "ens", "registration", slug] as const,
  availability: (slug: string) => ["greengoods", "ens", "availability", slug] as const,
  protocolName: (address: Address | string) =>
    ["greengoods", "ens", "protocolName", address] as const,
  protocolMembership: (address: Address | string) =>
    ["greengoods", "ens", "protocolMembership", address] as const,
} as const;

export const roleKeys = {
  all: ["greengoods", "role"] as const,
  operatorGardens: (address?: Address, chainId?: number) =>
    ["greengoods", "role", "operatorGardens", address, chainId] as const,
  gardenRoles: (gardenId?: string, address?: Address) =>
    ["greengoods", "role", "gardenRoles", gardenId, address] as const,
  hasRole: (gardenId?: string, address?: Address, role?: string) =>
    ["greengoods", "role", "hasRole", gardenId, address, role] as const,
  evaluatorGardens: (address?: Address, gardenIds: string[] = []) =>
    [
      "greengoods",
      "role",
      "evaluatorGardens",
      address,
      JSON.stringify([...gardenIds].sort()),
    ] as const,
  deploymentPermissions: (address?: string, chainId?: number) =>
    ["greengoods", "role", "deploymentPermissions", address, chainId] as const,
  allowlist: (chainId?: number) => ["greengoods", "role", "allowlist", chainId] as const,
} as const;

export const communityKeys = {
  all: ["greengoods", "community"] as const,
  garden: (gardenAddress: string, chainId: number) =>
    ["greengoods", "community", "garden", gardenAddress, chainId] as const,
  pools: (gardenAddress: string, chainId: number) =>
    ["greengoods", "community", "pools", gardenAddress, chainId] as const,
} as const;
