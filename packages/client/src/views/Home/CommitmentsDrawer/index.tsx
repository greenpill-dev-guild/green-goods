import {
  DEFAULT_CHAIN_ID,
  useCommitmentPools,
  useCommitmentSeries,
  useCommitmentsInbox,
  useGardens,
  usePrimaryAddress,
} from "@green-goods/shared";
import { RiArchiveLine, RiPulseLine } from "@remixicon/react";
import React, { useCallback, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { ModalDrawer, type ModalDrawerTab } from "@/components/Dialogs/ModalDrawer";
import { LiveTab } from "./LiveTab";
import { OverTimeTab } from "./OverTimeTab";

interface CommitmentsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * The member's commitments, in their own sheet.
 *
 * It is not a wallet tab. The wallet holds balances, which are one number each
 * with no lifecycle and nothing waiting on anyone; a commitment is a
 * relationship that moves, needs an act, and belongs to a garden.
 *
 * Tabs split by tense rather than by object, so the container word and the
 * object words are never the same: "Commitments" holds "Live" and "Over time".
 */
export const CommitmentsDrawer: React.FC<CommitmentsDrawerProps> = ({ isOpen, onClose }) => {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState("live");
  const chainId = DEFAULT_CHAIN_ID;
  const viewer = usePrimaryAddress();

  const inbox = useCommitmentsInbox({ chainId, viewer: viewer ?? undefined });
  const { pools } = useCommitmentPools({ chainId });
  const { data: gardens = [] } = useGardens();
  const { series } = useCommitmentSeries({ chainId, holder: viewer ?? undefined });
  const navigate = useNavigate();

  // The sheet sits beside the garden outlet rather than above a route of its
  // own, so opening a commitment has to put the sheet away first or it would
  // stay drawn over the very screen it just opened.
  const openCommitment = useCallback(
    (gardenAddress: string, commitmentId: bigint) => {
      onClose();
      navigate(`/home/${gardenAddress}/commitments/${commitmentId.toString()}`);
    },
    [onClose, navigate]
  );

  const tabs: ModalDrawerTab[] = [
    {
      id: "live",
      label: formatMessage({ id: "app.commitments.tab.live" }),
      icon: <RiPulseLine />,
      count: inbox.liveActCount,
    },
    {
      id: "over-time",
      label: formatMessage({ id: "app.commitments.tab.overTime" }),
      icon: <RiArchiveLine />,
      count: inbox.settledActCount,
    },
  ];

  return (
    <ModalDrawer
      isOpen={isOpen}
      onClose={onClose}
      header={{
        title: formatMessage({ id: "app.commitments.title" }),
        description: formatMessage({ id: "app.commitments.subtitle" }),
      }}
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      contentClassName="flex min-h-0 flex-col overflow-hidden p-0"
      maxHeight="95vh"
    >
      {activeTab === "live" && (
        <LiveTab inbox={inbox} pools={pools} gardens={gardens} onOpenCommitment={openCommitment} />
      )}
      {activeTab === "over-time" && (
        <OverTimeTab
          inbox={inbox}
          pools={pools}
          gardens={gardens}
          series={series}
          onOpenCommitment={openCommitment}
        />
      )}
    </ModalDrawer>
  );
};
