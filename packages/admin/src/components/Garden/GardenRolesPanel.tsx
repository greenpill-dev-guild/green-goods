import {
  type Address,
  ErrorBoundary,
  GARDEN_ROLE_ORDER,
  type GardenRole,
  getRoleColorClasses,
} from "@green-goods/shared";
import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiLoader4Line,
  RiMedalLine,
  RiShieldCheckLine,
  RiUserAddLine,
  RiUserLine,
} from "@remixicon/react";
import { useIntl } from "react-intl";
import { AddressDisplay } from "@/components/AddressDisplay";
import { getRoleLabel } from "@/components/Garden/gardenUtils";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";

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

  const getLabel = (role: GardenRole) => getRoleLabel(role, formatMessage);

  return (
    <section>
      <ErrorBoundary context="GardenDetail.Roles">
        <div className="grid gap-4 sm:grid-cols-2">
          {GARDEN_ROLE_ORDER.map((role) => {
            const members = roleMembers[role];
            const roleLabel = getLabel(role);
            const colors = getRoleColorClasses(role);
            const Icon = roleIcons[role];

            return (
              <Card key={role}>
                <Card.Header>
                  <h3 className="min-w-0 truncate label-md text-text-strong sm:text-lg">
                    {roleLabel.plural}
                  </h3>
                  {canManageRoles && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenAddMember(role)}
                      aria-label={formatMessage(
                        { id: "app.admin.roles.add" },
                        { role: roleLabel.singular }
                      )}
                    >
                      <RiUserAddLine className="mr-1 h-4 w-4" />
                      {formatMessage({ id: "app.garden.admin.add" })}
                    </Button>
                  )}
                </Card.Header>
                <Card.Body>
                  {members.length === 0 ? (
                    <EmptyState
                      icon={<Icon className="h-6 w-6" />}
                      title={formatMessage(
                        { id: "app.admin.roles.empty" },
                        { role: roleLabel.plural }
                      )}
                    />
                  ) : (
                    <>
                      <div className="space-y-2 sm:space-y-3">
                        {members.slice(0, 3).map((member: string, index: number) => (
                          <div
                            key={`${member}-${index}`}
                            className="flex items-center justify-between gap-3 rounded-lg bg-bg-weak p-2.5 sm:p-3"
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
                                className="ml-2 flex h-9 w-9 min-h-[44px] min-w-[44px] flex-shrink-0 items-center justify-center rounded border-l border-stroke-soft pl-3 text-error-base transition hover:bg-error-lighter active:scale-95 disabled:opacity-50/20 sm:min-h-0 sm:min-w-0"
                                aria-label={formatMessage(
                                  { id: "app.admin.roles.remove" },
                                  { role: roleLabel.singular }
                                )}
                                type="button"
                              >
                                {isLoading ? (
                                  <RiLoader4Line className="h-4 w-4 animate-spin text-error-base" />
                                ) : (
                                  <RiDeleteBinLine className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                      {members.length > 3 && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-3 w-full"
                          onClick={() => onOpenMembersModal(role)}
                        >
                          {formatMessage(
                            { id: "app.garden.admin.viewAllCount" },
                            { count: members.length }
                          )}
                        </Button>
                      )}
                    </>
                  )}
                </Card.Body>
              </Card>
            );
          })}
        </div>
      </ErrorBoundary>
    </section>
  );
};
