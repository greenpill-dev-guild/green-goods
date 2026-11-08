import { DEFAULT_CHAIN_ID } from "@green-goods/shared/config/default-chain";
import { queryKeys } from "@green-goods/shared/config/query-keys/registry";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { QueryKey } from "@tanstack/react-query";
import type { MemberPerson } from "./manageRoles";

export const RIOLAB = "0x1111111111111111111111111111111111111111" as Address;
export const ANA = "0x2222222222222222222222222222222222222222" as Address;
export const KWAME = "0x3333333333333333333333333333333333333333" as Address;
export const CHIDI = "0x4444444444444444444444444444444444444444" as Address;
export const TOMI = "0x5555555555555555555555555555555555555555" as Address;
export const NEIGHBOR = "0x6666666666666666666666666666666666666666" as Address;
export const NEWCOMER = "0x7777777777777777777777777777777777777777" as Address;

/** Rio Rainforest Lab: an owner with every role, two stewards, evaluators, and people with no name. */
const PEOPLE: (MemberPerson & { protocolName?: string; ensName?: string; photo?: boolean })[] = [
  {
    address: RIOLAB,
    roles: ["owner", "steward", "evaluator", "gardener"],
    protocolName: "riolab.greengoods.eth",
    photo: true,
  },
  { address: ANA, roles: ["steward", "evaluator", "gardener"], ensName: "ana-souza.eth" },
  { address: KWAME, roles: ["steward", "evaluator", "gardener"], ensName: "kwame-mensah.eth" },
  {
    address: CHIDI,
    roles: ["evaluator", "gardener"],
    protocolName: "chidinma.greengoods.eth",
    photo: true,
  },
  { address: TOMI, roles: ["evaluator", "gardener", "funder"], ensName: "tomi.eth" },
  { address: NEIGHBOR, roles: ["community"] },
  { address: NEWCOMER, roles: ["gardener"] },
];

export const manageRolesPeople: MemberPerson[] = PEOPLE.map(({ address, roles }) => ({
  address,
  roles,
}));

export const manageRolesRoster = Object.fromEntries(
  (["owner", "steward", "evaluator", "gardener", "funder", "community"] as GardenRole[]).map(
    (role) => [role, PEOPLE.filter((person) => person.roles.includes(role)).map((p) => p.address)]
  )
) as Record<GardenRole, Address[]>;

export const personOf = (address: Address) =>
  manageRolesPeople.find((person) => person.address === address) as MemberPerson;

/** Query cache seeds for each person's names and photo, so no story reads the network. */
export function manageRolesIdentity(photo: string): (readonly [QueryKey, unknown])[] {
  return PEOPLE.flatMap((person) => [
    [queryKeys.ens.name(person.address), person.ensName ?? null] as const,
    [queryKeys.ens.protocolName(person.address), person.protocolName ?? null] as const,
    [queryKeys.ens.avatar(person.address), person.photo ? photo : null] as const,
    [queryKeys.ens.passkeyName(DEFAULT_CHAIN_ID, person.address), null] as const,
    [queryKeys.profileAvatars.record(DEFAULT_CHAIN_ID, person.address), null] as const,
  ]);
}
