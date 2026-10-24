import { PersonRow } from "@green-goods/shared/components/Cards/PersonRow/PersonRow";
import type { Address } from "@green-goods/shared/types/domain";
import type { GardenRole } from "@green-goods/shared/utils/blockchain/garden-roles";
import { useIntl } from "react-intl";

interface MemberRowProps {
  address: Address;
  roles?: GardenRole[];
  /** Shown under the name when the list mixes gardens (search / flat mode). */
  gardenName?: string;
  /** Garden names the sender and this member both belong to ("Together in …"). */
  sharedGardens?: string[];
  /** Suppress the garden line when a section header already names the garden. */
  hideGarden?: boolean;
  selected?: boolean;
  onSelect: () => void;
}

/** The app's own picture for someone who has no photo, as the profile shows it. */
const DEFAULT_AVATAR = "/images/avatar.png";

/**
 * One person to send to, as a person row (DL-112): their avatar, their name from the shared
 * address display, their highest role as the chip, and the garden that tells two people
 * apart as the row's one detail. The chosen recipient wears the open row's border but reads as
 * pressed: choosing someone to send to is not opening a record.
 */
export function MemberRow({
  address,
  roles = [],
  gardenName,
  sharedGardens,
  hideGarden,
  selected,
  onSelect,
}: MemberRowProps) {
  const { formatMessage } = useIntl();

  // "Gardens you share" wins over a plain garden line; the section header owns the
  // garden when `hideGarden` is set (frontend-design Rule 17 — don't restate it).
  const sharedGardensText = sharedGardens?.length ? sharedGardens.join(", ") : null;
  const contextLine = sharedGardensText
    ? formatMessage({ id: "app.send.recipient.sharedGardens" }, { gardens: sharedGardensText })
    : !hideGarden && gardenName
      ? gardenName
      : null;

  return (
    <PersonRow
      address={address}
      roles={roles}
      fallbackAvatar={DEFAULT_AVATAR}
      details={contextLine ? [contextLine] : undefined}
      pressed={selected}
      onOpen={onSelect}
    />
  );
}
