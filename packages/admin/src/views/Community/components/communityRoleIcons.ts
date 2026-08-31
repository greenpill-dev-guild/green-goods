import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import {
  RiCheckboxCircleLine,
  RiGroupLine,
  RiMoneyDollarCircleLine,
  RiSeedlingLine,
  RiShieldCheckLine,
  RiUserLine,
} from "@remixicon/react";

export const communityRoleIcons = {
  owner: RiShieldCheckLine,
  steward: RiUserLine,
  evaluator: RiCheckboxCircleLine,
  gardener: RiSeedlingLine,
  funder: RiMoneyDollarCircleLine,
  community: RiGroupLine,
} as const satisfies Record<GardenRole, React.ComponentType<{ className?: string }>>;
