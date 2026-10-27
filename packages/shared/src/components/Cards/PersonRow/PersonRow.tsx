/**
 * PersonRow — one person in a list, the same on the installed app and the cockpit.
 *
 * A person is an item row led by their avatar: their profile photo, the surface's own picture
 * or a person glyph when they have none, and nothing while the photo is looked up. The title
 * is their name as the shared address display resolves it (their Green Goods name, then their
 * ENS name, then the name the list holds for them, then a short address), so a person reads the
 * same in every list. The row's one pill is their highest role, or the state of what they are
 * listed for when that is not a role (a booking), and the detail line holds the list's one count.
 *
 * @module components/Cards/PersonRow
 */
import * as React from "react";
import { useIntl } from "react-intl";
import { DEFAULT_CHAIN_ID } from "../../../config/default-chain";
import { useResolvedProfileAvatar } from "../../../hooks/profile/useProfileAvatar";
import type { Address } from "../../../types/domain";
import {
  GARDEN_ROLE_ORDER,
  type GardenRole,
  getRoleLabel,
} from "../../../utils/blockchain/garden-roles";
import { AddressDisplay } from "../../AddressDisplay";
import { ItemRow, type ItemRowProps } from "../ItemRow/ItemRow";

export interface PersonRowProps extends Omit<ItemRowProps, "lead" | "title" | "status"> {
  address: Address;
  /** The roles the person holds, in any order; the row shows the highest as its one chip. */
  roles?: readonly GardenRole[];
  /** What to call someone who has published no name, in place of their short address. */
  fallbackName?: string;
  /** The surface's own picture for someone with no photo; without one the avatar shows a glyph. */
  fallbackAvatar?: string;
  /** The chain the person's profile photo is read from. */
  chainId?: number;
  /**
   * The state of what the person is listed for, when that is not a role: a booking on a
   * member's service, for one. It is then the row's one pill, in place of the role.
   */
  status?: ItemRowProps["status"];
}

export const PersonRow = React.forwardRef<HTMLElement, PersonRowProps>(function PersonRow(
  { address, roles, fallbackName, fallbackAvatar, chainId = DEFAULT_CHAIN_ID, status, ...row },
  ref
) {
  const { formatMessage } = useIntl();
  // A list's rows read their photos together, on the batch route (ProfileAvatarReadOptions).
  const avatar = useResolvedProfileAvatar(address, fallbackAvatar, chainId, { list: true });
  // GARDEN_ROLE_ORDER runs from the most to the least responsibility.
  const role = roles ? GARDEN_ROLE_ORDER.find((candidate) => roles.includes(candidate)) : undefined;
  const pill =
    status ??
    (role
      ? { label: getRoleLabel(role, formatMessage).singular, tone: "neutral" as const }
      : undefined);

  // Its Green Goods name, too, is read with the list's other rows, in one batch.
  return (
    <AddressDisplay address={address} fallbackLabel={fallbackName} list>
      {(name) => (
        <ItemRow
          {...row}
          ref={ref}
          lead={{ kind: "avatar", src: avatar.avatarUri, loading: avatar.isLoading }}
          title={name}
          status={pill}
        />
      )}
    </AddressDisplay>
  );
});

PersonRow.displayName = "PersonRow";
