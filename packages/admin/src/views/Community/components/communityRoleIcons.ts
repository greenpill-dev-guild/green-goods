import type { GardenRole } from "@green-goods/shared";
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
  operator: RiUserLine,
  evaluator: RiCheckboxCircleLine,
  gardener: RiSeedlingLine,
  funder: RiMoneyDollarCircleLine,
  community: RiGroupLine,
} as const satisfies Record<GardenRole, React.ComponentType<{ className?: string }>>;
