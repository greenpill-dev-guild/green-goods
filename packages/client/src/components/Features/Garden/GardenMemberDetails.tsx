import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { ImageWithFallback } from "@green-goods/shared/components/Display/ImageWithFallback";
import {
  GardenContributionDate,
  type gardenContributionDetail,
} from "@green-goods/shared/components/GardenContributionDate";
import { GardenMembershipDates } from "@green-goods/shared/components/GardenMembershipDates";
import { IconButton } from "@green-goods/shared/components/IconButton";
import { useResolvedProfileAvatar } from "@green-goods/shared/hooks/profile/useProfileAvatar";
import type { Address, GardenMemberHistory } from "@green-goods/shared/types/domain";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { formatRoleList, type GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { RiFileCopyLine, RiUserLine } from "@remixicon/react";
import { useIntl } from "react-intl";

type Contribution = Parameters<typeof gardenContributionDetail>[0];

interface GardenMemberDetailsProps {
  account: Address;
  /** The member's current roles, highest first. */
  roles: readonly GardenRole[];
  /** The surface's own picture for someone with no photo. */
  fallbackAvatar: string;
  chainId: number;
  /**
   * Contact details the member shared. No source fills them today; the sheet shows them when
   * one does (an email sign-in, for one).
   */
  email?: string;
  phone?: string;
  history?: GardenMemberHistory;
  historyLoading: boolean;
  historyError: boolean;
  /** Only for the garden's owners and stewards (DL-187). */
  contribution?: Contribution;
  canViewContribution: boolean;
  onCopy: (value: string) => void;
}

/**
 * One member's details in their sheet, under their name as its title. It reads top down: who they
 * are (their photo and their roles in words), then everything a reader can copy in one list (their
 * address, then any contacts they shared), then their history in a second list.
 */
export function GardenMemberDetails({
  account,
  roles,
  fallbackAvatar,
  chainId,
  email,
  phone,
  history,
  historyLoading,
  historyError,
  contribution,
  canViewContribution,
  onCopy,
}: GardenMemberDetailsProps) {
  const intl = useIntl();
  const avatar = useResolvedProfileAvatar(account, fallbackAvatar, chainId);
  const isPhoto = Boolean(avatar.avatarUri) && avatar.avatarUri !== fallbackAvatar;
  const copyable = [
    {
      key: "address",
      label: intl.formatMessage({ id: "app.garden.gardeners.address" }),
      shown: formatAddress(account),
      value: account,
      copyLabel: intl.formatMessage({ id: "app.common.copyAddress" }),
      mono: true,
    },
    email
      ? {
          key: "email",
          label: intl.formatMessage({ id: "app.garden.gardeners.email" }),
          shown: email,
          value: email,
          copyLabel: intl.formatMessage({ id: "app.garden.gardeners.copyEmail" }),
          mono: false,
        }
      : null,
    phone
      ? {
          key: "phone",
          label: intl.formatMessage({ id: "app.garden.gardeners.phone" }),
          shown: phone,
          value: phone,
          copyLabel: intl.formatMessage({ id: "app.garden.gardeners.copyPhone" }),
          mono: false,
        }
      : null,
  ].filter((row) => row !== null);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <span
          className="relative block size-20 shrink-0 overflow-hidden rounded-full bg-bg-soft-200"
          aria-hidden="true"
          data-testid="member-photo"
        >
          <ImageWithFallback
            src={avatar.avatarUri ?? fallbackAvatar}
            alt=""
            fallbackIcon={RiUserLine}
            backgroundFallback={
              isPhoto ? (
                <img
                  src={fallbackAvatar}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : undefined
            }
            className="absolute inset-0 h-full w-full object-cover"
            fallbackClassName="absolute inset-0 h-full w-full"
          />
        </span>
        {roles.length ? (
          <p className="type-body font-medium text-text-strong-950">
            {formatRoleList(roles, intl)}
          </p>
        ) : null}
      </div>

      {/* Everything a reader can copy sits together, each row with its own copy. */}
      <FactList frame="inset">
        {copyable.map((row) => (
          <FactRow
            key={row.key}
            label={row.label}
            value={
              <span className={row.mono ? "block truncate font-mono" : "block truncate"}>
                {row.shown}
              </span>
            }
            valueTitle={row.value}
            action={
              <IconButton
                type="button"
                emphasis="tertiary"
                size="compact"
                icon={<RiFileCopyLine className="h-4 w-4" aria-hidden="true" />}
                aria-label={row.copyLabel}
                title={row.copyLabel}
                onClick={() => onCopy(row.value)}
              />
            }
          />
        ))}
      </FactList>

      <GardenMembershipDates
        history={history}
        roles={roles}
        isLoading={historyLoading}
        isError={historyError}
      >
        {canViewContribution ? <GardenContributionDate contribution={contribution} row /> : null}
      </GardenMembershipDates>
    </div>
  );
}
