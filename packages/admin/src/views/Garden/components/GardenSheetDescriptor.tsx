import { type Address, useCurrentChain } from "@green-goods/shared";
import { useMemo } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { type LeftSheetConfig, useLeftSheetConfig } from "@/components/Layout";
import HypercertDetail from "@/views/Garden/HypercertDetail";
import { CommitmentDialogPanel } from "@/views/Garden/Pool/CommitmentDialog";
import { SeedCommitmentDialog } from "@/views/Garden/Pool/Seed";

interface GardenSheetDescriptorProps {
  hypercertId: string | undefined;
  closeTo: string;
  /** `/garden/pool/seed`: the seeding console, a flow dialog over the Pool tab. */
  poolSeedOpen?: boolean;
  /** `/garden/pool/:commitmentId`: one commitment in the left inspector. */
  poolCommitmentId?: string;
  poolCloseTo?: string;
  gardenAddress?: Address | string;
}

/**
 * Declares the Garden workspace's left sheet: hypercert detail or a pool
 * commitment, both route-backed (deep-linkable) — close navigates to the
 * owning tab. The seeding console is a flow dialog rendered beside it.
 * Membership flows no longer live here; Manage Members / Add Members are
 * community-owned dialogs at /community/members.
 */
export function GardenSheetDescriptor({
  hypercertId,
  closeTo,
  poolSeedOpen = false,
  poolCommitmentId,
  poolCloseTo,
  gardenAddress,
}: GardenSheetDescriptorProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const chainId = useCurrentChain();

  const config = useMemo<LeftSheetConfig | null>(() => {
    if (hypercertId) {
      return {
        title: formatMessage({ id: "app.hypercerts.detail.title", defaultMessage: "Hypercert" }),
        content: <HypercertDetail layout="sheet" hypercertId={hypercertId} />,
        onClose: () => navigate(closeTo),
        size: "lg",
        tone: "garden",
      };
    }

    if (poolCommitmentId && gardenAddress && poolCloseTo) {
      return {
        title: formatMessage({
          id: "cockpit.garden.pool.commitment.title",
          defaultMessage: "Commitment",
        }),
        content: (
          <CommitmentDialogPanel
            chainId={chainId}
            garden={gardenAddress as Address}
            commitmentId={poolCommitmentId}
            tone="garden"
          />
        ),
        onClose: () => navigate(poolCloseTo),
        size: "lg",
        tone: "garden",
      };
    }

    return null;
  }, [
    chainId,
    closeTo,
    formatMessage,
    gardenAddress,
    hypercertId,
    navigate,
    poolCloseTo,
    poolCommitmentId,
  ]);

  useLeftSheetConfig(config);

  if (poolSeedOpen && gardenAddress && poolCloseTo) {
    return (
      <SeedCommitmentDialog
        open
        chainId={chainId}
        garden={gardenAddress as Address}
        onClose={() => navigate(poolCloseTo)}
      />
    );
  }

  return null;
}
