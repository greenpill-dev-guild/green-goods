import {
  ErrorBoundary,
  GARDEN_ROLE_ORDER,
  GARDEN_ROLE_I18N_KEYS,
  getRoleColorClasses,
  type Address,
  type GardenRole,
} from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiMedalLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AddressDisplay } from "@/components/AddressDisplay";

const roleIcons = {
  owner: RiShieldCheckLine,
  operator: RiUserLine,
  evaluator: RiCheckboxCircleLine,
  gardener: RiUserLine,
  funder: RiMedalLine,
  community: RiUserLine,
} as const;

interface GardenRolesPanelProps {
  roleMembers: Record<GardenRole, Address[]>;
  canManageRoles: boolean;
  isLoading: boolean;
  onOpenAddMember: (role: GardenRole) => void;
  onOpenMembersModal: (role: GardenRole) => void;
  onRemoveMember: (address: Address, role: GardenRole) => void;
}

export const GardenRolesPanel: React.FC<GardenRolesPanelProps> = ({
  roleMembers,
  canManageRoles,
  isLoading,
  onOpenAddMember,
  onOpenMembersModal,
  onRemoveMember,
}) => {
  const { formatMessage } = useIntl();

  const getRoleLabel = (role: GardenRole) => ({
    singular: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].singular }),
    plural: formatMessage({ id: GARDEN_ROLE_I18N_KEYS[role].plural }),
  });

  return (
    <section className="grid-area-roles">
      <ErrorBoundary context="GardenDetail.Roles">
        <div className="grid gap-4 sm:grid-cols-2">
          {GARDEN_ROLE_ORDER.map((role) => {
            const members = roleMembers[role];
            const roleLabel = getRoleLabel(role);
            const colors = getRoleColorClasses(role);
            const Icon = roleIcons[role];

            return (
              <aside
                key={role}
                className="rounded-lg border border-stroke-soft bg-bg-white shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 border-b border-stroke-soft p-4 sm:p-6">
                  <h3 className="min-w-0 truncate text-base font-medium text-text-strong sm:text-lg">
                    {roleLabel.plural}
                  </h3>
                  {canManageRoles && (
                    <button
                      onClick={() => onOpenAddMember(role)}
                      className="inline-flex min-h-[44px] flex-shrink-0 items-center whitespace-nowrap rounded-md bg-bg-weak border border-stroke-sub px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft active:scale-95 sm:min-h-0 sm:py-1.5"
                      aria-label={formatMessage(
                        { id: "app.admin.roles.add" },
                        { role: roleLabel.singular }
                      )}
                      type="button"
                    >
                      <RiUserAddLine className="mr-1 h-4 w-4" />
                      {formatMessage({ id: "app.garden.admin.add" })}
                    </button>
                  )}
                </div>
                <div className="p-4 sm:p-6">
                  {members.length === 0 ? (
                    <p className="py-4 text-center text-sm text-text-soft">
                      {formatMessage({ id: "app.admin.roles.empty" }, { role: roleLabel.plural })}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2 sm:space-y-3">
                        {members.slice(0, 3).map((member: string, index: number) => (
                          <div
                            key={`${member}-${index}`}
                            className="flex items-center justify-between gap-2 rounded-md bg-bg-weak p-2.5 sm:p-3"
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
                              <div
                                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${colors.iconBg} sm:h-9 sm:w-9`}
                              >
                                <Icon className={`h-4 w-4 ${colors.iconText}`} />
                              </div>
                              <AddressDisplay address={member} className="min-w-0 flex-1" />
                            </div>
                            {canManageRoles && (
                              <button
                                onClick={() => onRemoveMember(member, role)}
                                disabled={isLoading}
                                className="flex h-9 w-9 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20 sm:min-h-0 sm:min-w-0"
                                aria-label={formatMessage(
                                  { id: "app.admin.roles.remove" },
                                  { role: roleLabel.singular }
                                )}
                                type="button"
                              >
                                <RiDeleteBinLine className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {members.length > 3 && (
                        <button
                          type="button"
                          onClick={() => onOpenMembersModal(role)}
                          className="mt-3 w-full rounded-md border border-stroke-sub bg-bg-white px-3 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-weak active:scale-95"
                        >
                          {formatMessage(
                            { id: "app.garden.admin.viewAllCount" },
                            { count: members.length }
                          )}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </aside>
            );
          })}
        </div>
      </ErrorBoundary>
    </section>
  );
};
