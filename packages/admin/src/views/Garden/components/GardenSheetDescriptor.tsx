import type { Address } from "@green-goods/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { AddMemberSheet } from "@/components/Garden/AddMemberSheet";
import { type LeftSheetConfig, useLeftSheetConfig } from "@/components/Layout";
import HypercertDetail from "@/views/Garden/HypercertDetail";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  closeTo: string;
  /** Header "Add member" action state (controller-owned, view-independent). */
  addMemberOpen: boolean;
  onCloseAddMember: () => void;
  /** Garden token address — write target for the add-member sheet. */
  gardenAddress: Address | undefined;
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
  const [addMemberGardenAddress, setAddMemberGardenAddress] = useState<Address | undefined>();
  const [addMemberSubmitting, setAddMemberSubmitting] = useState(false);

  useEffect(() => {
    if (!addMemberOpen) {
      setAddMemberGardenAddress(undefined);
      setAddMemberSubmitting(false);
      return;
    }

    if (!addMemberGardenAddress && gardenAddress) {
      setAddMemberGardenAddress(gardenAddress);
    }
  }, [addMemberGardenAddress, addMemberOpen, gardenAddress]);

  useEffect(() => {
    if (!addMemberOpen || !addMemberGardenAddress || addMemberSubmitting) return;
    if (!gardenAddress) {
      onCloseAddMember();
      return;
    }
    if (addMemberGardenAddress.toLowerCase() === gardenAddress.toLowerCase()) return;
    onCloseAddMember();
  }, [addMemberGardenAddress, addMemberOpen, addMemberSubmitting, gardenAddress, onCloseAddMember]);

  const handleShellCloseAddMember = useCallback(() => {
    if (addMemberSubmitting) return;
    onCloseAddMember();
  }, [addMemberSubmitting, onCloseAddMember]);

  const config = useMemo<LeftSheetConfig | null>(() => {
    const activeAddMemberGardenAddress = addMemberOpen
      ? (addMemberGardenAddress ?? gardenAddress)
      : undefined;

    if (activeAddMemberGardenAddress) {
      return {
        title: formatMessage({
          id: "cockpit.garden.action.addMember",
          defaultMessage: "Add member",
        }),
        content: (
          <AddMemberSheet
            key={activeAddMemberGardenAddress}
            gardenAddress={activeAddMemberGardenAddress}
            onClose={onCloseAddMember}
            onRequestClose={handleShellCloseAddMember}
            onSubmittingChange={setAddMemberSubmitting}
          />
        ),
        onClose: handleShellCloseAddMember,
        preventClose: addMemberSubmitting,
        size: "lg",
        tone: "garden",
      };
    }

    if (hypercertId) {
      return {
        title: formatMessage({ id: "app.hypercerts.detail.title", defaultMessage: "Hypercert" }),
        content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
        onClose: () => navigate(closeTo),
        size: "lg",
        tone: "garden",
      };
    }

    return null;
  }, [
    addMemberOpen,
    addMemberGardenAddress,
    addMemberSubmitting,
    closeTo,
    formatMessage,
    gardenAddress,
    handleShellCloseAddMember,
    hypercertId,
    navigate,
    onCloseAddMember,
  ]);

  useLeftSheetConfig(config);

  return null;
}
