import { Button } from "@green-goods/shared/components/Button";
import { IconButton } from "@green-goods/shared/components/IconButton";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
} from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiAddLine, RiClipboardLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { AdminSelect, AdminTextField } from "../AdminTextField";
import { AddMembersEntryStatus, type AddMembersEntryStatusProps } from "./AddMembersEntryStatus";

interface AddMembersEntryFieldProps {
  value: string;
  onChange: (value: string) => void;
  onRoleChange: (role: GardenRole) => void;
  onPaste: () => void;
  onStage: () => void;
  disabled: boolean;
  stageDisabled: boolean;
  invalid: boolean;
  error?: string;
  status: AddMembersEntryStatusProps;
}

/** One list entry: identify the person, choose their role, then stage it. */
export function AddMembersEntryField({
  value,
  onChange,
  onRoleChange,
  onPaste,
  onStage,
  disabled,
  stageDisabled,
  invalid,
  error,
  status,
}: AddMembersEntryFieldProps) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <AdminTextField
          id="member-address"
          className="min-w-0 flex-1"
          label={formatMessage({ id: "app.admin.roles.addressLabel" })}
          error={error}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={formatMessage({ id: "admin.addMember.placeholder" })}
          disabled={disabled}
          inputProps={{ "aria-invalid": invalid, "aria-describedby": status.id }}
        />
        <div className="pt-5.5">
          <IconButton
            size="md"
            onClick={onPaste}
            disabled={disabled}
            aria-label={formatMessage({ id: "admin.addMember.paste" })}
            title={formatMessage({ id: "admin.addMember.paste" })}
            icon={<RiClipboardLine />}
          />
        </div>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
        <AdminSelect
          id="member-role"
          className="min-w-0"
          label={formatMessage({ id: "app.admin.roles.roleLabel" })}
          value={status.selectedRole}
          onChange={(event) => onRoleChange(event.target.value as GardenRole)}
          disabled={disabled}
        >
          {GARDEN_ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {formatMessage({ id: `app.roles.${role}` })}
            </option>
          ))}
        </AdminSelect>
        <div className="pt-5.5">
          <Button
            type="button"
            emphasis="secondary"
            size="md"
            onClick={onStage}
            disabled={disabled || stageDisabled}
            leadingIcon={<RiAddLine aria-hidden="true" />}
          >
            {formatMessage({ id: "admin.addMember.addToList" })}
          </Button>
        </div>
      </div>
      <AddMembersEntryStatus {...status} />
    </div>
  );
}
