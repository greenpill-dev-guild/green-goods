import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { useIntl } from "react-intl";
import { AdminSelect } from "../AdminTextField";

/** Only the roles the current actor can grant appear in this picker. */
export function MemberRoleSelect({
  roles,
  value,
  onChange,
  disabled,
  className,
}: {
  roles: readonly GardenRole[];
  value: GardenRole;
  onChange: (role: GardenRole) => void;
  disabled: boolean;
  className?: string;
}) {
  const { formatMessage } = useIntl();
  return (
    <AdminSelect
      id="member-role"
      className={className}
      label={formatMessage({ id: "app.admin.roles.roleLabel", defaultMessage: "Role" })}
      value={value}
      onChange={(event) => {
        const role = event.target.value as GardenRole;
        if (roles.includes(role)) onChange(role);
      }}
      disabled={disabled || roles.length === 0}
    >
      {roles.map((role) => (
        <option key={role} value={role}>
          {formatMessage({ id: `app.roles.${role}` })}
        </option>
      ))}
    </AdminSelect>
  );
}
