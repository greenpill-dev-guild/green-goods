import type { Address } from "@green-goods/shared/types/domain";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { useIntl } from "react-intl";
import { AdminChoiceGroup } from "../AdminChoiceGroup";
import { getRoleLabel } from "./gardenUtils";
import { MemberIdentity } from "./MemberIdentity";
import { RoleChip } from "./RoleChip";

/** The member stays fixed; only an additional role is chosen. */
export function MemberRolePicker({
  address,
  roles,
  value,
  onChange,
  disabled,
}: {
  address: Address;
  roles: GardenRole[];
  value: GardenRole | null;
  onChange: (role: GardenRole) => void;
  disabled: boolean;
}) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-4">
      <MemberIdentity address={address} />
      <div className="space-y-2">
        <p className="type-meta text-text-soft">
          {formatMessage({ id: "admin.members.currentRoles" })}
        </p>
        <div className="flex flex-wrap gap-2">
          {roles.map((role) => (
            <RoleChip key={role} role={role} />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <p className="type-body font-semibold text-text-strong">
          {formatMessage({ id: "admin.members.chooseRole" })}
        </p>
        <AdminChoiceGroup
          ariaLabel={formatMessage({ id: "admin.members.chooseRole" })}
          value={value}
          onChange={(role) => onChange(role as GardenRole)}
          columns={2}
          options={GARDEN_ROLE_ORDER.filter((role) => !roles.includes(role)).map((role) => ({
            value: role,
            label: getRoleLabel(role, formatMessage).singular,
            disabled,
          }))}
        />
      </div>
    </div>
  );
}
