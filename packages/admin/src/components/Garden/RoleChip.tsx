import {
  type GardenRole,
  getRoleColorClasses,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { useIntl } from "react-intl";
import { getRoleLabel } from "./gardenUtils";

/**
 * A garden role as the membership dialogs show it: the role's colour pair
 * around its singular name. The name always carries the meaning, so colour is
 * never the only signal.
 */
export function RoleChip({ role }: { role: GardenRole }) {
  const { formatMessage } = useIntl();
  const colors = getRoleColorClasses(role);
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 label-xs ${colors.iconBg} ${colors.iconText}`}
    >
      {getRoleLabel(role, formatMessage).singular}
    </span>
  );
}
