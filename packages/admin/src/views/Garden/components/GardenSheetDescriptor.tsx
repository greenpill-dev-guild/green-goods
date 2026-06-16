import { type LeftSheetConfig, useLeftSheetConfig } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AddMemberSheet } from "@/components/Garden/AddMemberSheet";
import HypercertDetail from "@/views/Garden/HypercertDetail";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  closeTo: string;
  /** Header "Add member" action state (controller-owned, view-independent). */
  addMemberOpen: boolean;
  onCloseAddMember: () => void;
  /** Garden token address — write target for the add-member sheet. */
  gardenAddress: string | undefined;
}

/**
 * Declares the Garden workspace's left sheet. Both flows funnel through one
 * `useLeftSheetConfig` call (only one left sheet can be open at a time):
 * - Hypercert detail is route-backed (deep-linkable) → close navigates to `closeTo`.
 * - Add member is state-backed (controller `addMemberOpen`) → close clears state.
 *   Rendering it here, at the always-mounted shell, lets the header action open
 *   it in ONE click from any Garden view instead of navigating-then-acting.
 */
export function GardenSheetDescriptor({
  hypercertId,
  closeTo,
  addMemberOpen,
  onCloseAddMember,
  gardenAddress,
}: GardenSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();

  const config = useMemo<LeftSheetConfig | null>(() => {
    if (hypercertId) {
      return {
        title: formatMessage({ id: "app.hypercerts.detail.title", defaultMessage: "Hypercert" }),
        content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
        onClose: () => navigate(closeTo),
      };
    }

    if (addMemberOpen && gardenAddress) {
      return {
        title: formatMessage({
          id: "cockpit.garden.action.addMember",
          defaultMessage: "Add member",
        }),
        content: <AddMemberSheet gardenAddress={gardenAddress} onClose={onCloseAddMember} />,
        onClose: onCloseAddMember,
        width: "wide",
      };
    }

    return null;
  }, [
    addMemberOpen,
    closeTo,
    formatMessage,
    gardenAddress,
    hypercertId,
    navigate,
    onCloseAddMember,
  ]);

  useLeftSheetConfig(config);

  return null;
}
