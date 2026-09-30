import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type { PoolConsoleController } from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useEnsNames } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import { useCommitmentActivity } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useSettlementAccount } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import {
  displayBucketOf,
  selectRewardEdit,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { goodDollarWeiToUsdCents } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Address } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import type { PoolCommitmentGroup } from "../poolCommitmentRows";
import { cycleName } from "../poolPresentation";
import { exactTime } from "../poolTime";
import { AddToGroupDialog } from "./AddToGroupDialog";
import { EditRewardDialog } from "./EditRewardDialog";
import { GroupInspector } from "./GroupInspector";
import { groupSetAt } from "./groupInspectorModel";
import { groupReward, groupTerms } from "./groupTerms";
import { SeedMoreDialog } from "./SeedMoreDialog";

/** How far back the inspector reads the pool's activity for its dates. */
const ACTIVITY_WINDOW = 500;

export interface GroupDialogsProps {
  pool: PoolConsoleController;
  group: PoolCommitmentGroup;
  title: string;
  isProtocol: boolean;
  onClose: () => void;
  onOpenCommitment: (commitment: CommitmentReadModel) => void;
  /** Start a new group in the Seed flow, from this group's terms. */
  onSeedNew: (from: CommitmentReadModel) => void;
}

type GroupStep = "inspect" | "seed-more" | "add" | "edit-reward";

/**
 * The group inspector and where it leads (PRD-1022 D4, D14): Seed More Like
 * This, which adds to the group or starts a new one, and Edit Reward while no
 * copy is kept. Each dialog closes back to the inspector, which says what
 * changed.
 */
export function GroupDialogs({
  pool,
  group,
  title,
  isProtocol,
  onClose,
  onOpenCommitment,
  onSeedNew,
}: GroupDialogsProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [step, setStep] = useState<GroupStep>("inspect");
  const { chainId, garden, viewer } = pool;
  const [first] = group.children;
  const activity = useCommitmentActivity({ chainId, poolId: pool.poolId, limit: ACTIVITY_WINDOW });
  const price = useGoodDollarPrice();
  const settlement = useSettlementAccount({ chainId, garden });
  const inProgress = group.children.filter(
    (child) => displayBucketOf(child.onchainState) === "inProgress"
  );
  const takers = inProgress.flatMap((child) => (child.counterparty ? [child.counterparty] : []));
  const ensNames = useEnsNames(takers);
  if (!first) return null;

  const metadata = first.metadataCID ? (pool.titles.get(first.metadataCID.trim()) ?? null) : null;
  const reward = groupReward(group.children, metadata);
  const terms = groupTerms({
    intl,
    children: group.children,
    metadata,
    reward,
    price: price.state,
    setAt: groupSetAt(group.children, activity.events),
    now: Date.now(),
  });
  const unsent = pool.queuedGroupCopies.get(group.displayGroupId)?.length ?? 0;
  const edit = selectRewardEdit(group.children, { unsent });
  const canEditReward = reward.currentWei !== null && edit.open;
  const cycle = pool.cycles.find((row) => row.cycleId === first.cycleId);
  const dueMs = Number(first.dueDate ?? 0n) * 1000;
  const template =
    group.children.find((child) => displayBucketOf(child.onchainState) === "available") ?? first;
  const rewardCents =
    reward.currentWei === null
      ? null
      : (reward.centsAsSet ??
        (price.state.status === "ready"
          ? goodDollarWeiToUsdCents(reward.currentWei, price.state.price)
          : null));
  const addRefusal =
    dueMs <= Date.now()
      ? ("expired" as const)
      : viewer && first.creator?.toLowerCase() === viewer.toLowerCase()
        ? null
        : ("not-creator" as const);
  const done = (message: string) => {
    toastService.success({ title: message });
    setStep("inspect");
  };

  return (
    <>
      <GroupInspector
        open={step === "inspect"}
        onClose={onClose}
        group={group}
        title={title}
        cycleName={cycle ? cycleName(cycle, pool.cycleNames, formatMessage) : null}
        chainId={chainId}
        terms={terms}
        rewarded={reward.currentWei !== null}
        canEditReward={canEditReward}
        events={activity.events}
        waitingOnYou={pool.waitingOnYou}
        onOpenCommitment={onOpenCommitment}
        onSeedMore={() => setStep("seed-more")}
        onEditReward={() => setStep("edit-reward")}
      />
      <SeedMoreDialog
        open={step === "seed-more"}
        onClose={() => setStep("inspect")}
        onContinue={(choice) => (choice === "add" ? setStep("add") : onSeedNew(first))}
        title={title}
        due={dueMs > 0 ? exactTime(intl, dueMs) : "—"}
        addRefusal={addRefusal}
      />
      {step === "add" ? (
        <AddToGroupDialog
          open
          onClose={() => setStep("inspect")}
          onBack={() => setStep("seed-more")}
          onAdded={(count) =>
            done(
              formatMessage(
                {
                  id: "cockpit.garden.pool.group.added",
                  defaultMessage:
                    "{count, plural, one {Added # promise to this group} other {Added # promises to this group}}",
                },
                { count }
              )
            )
          }
          chainId={chainId}
          garden={garden}
          isProtocol={isProtocol}
          owner={viewer ?? null}
          group={{
            displayGroupId: group.displayGroupId,
            dueDate: first.dueDate ?? 0n,
            templateCommitmentId: template.commitmentId,
            metadata: metadata ?? { version: 1, title },
            gardenAddress: garden,
          }}
          title={title}
          counts={group.counts}
          terms={terms}
          rewardCents={rewardCents}
        />
      ) : null}
      {step === "edit-reward" && canEditReward && reward.currentWei !== null ? (
        <EditRewardDialog
          open
          onClose={() => setStep("inspect")}
          onChanged={(count) =>
            done(
              formatMessage(
                {
                  id: "cockpit.garden.pool.group.rewardChangedToast",
                  defaultMessage:
                    "{count, plural, one {Reward changed for # promise} other {Reward changed for # promises}}",
                },
                { count }
              )
            )
          }
          chainId={chainId}
          garden={garden}
          isProtocol={isProtocol}
          title={title}
          available={edit.open ? edit.targets.map((child) => child.commitmentId) : []}
          takenBy={takers.map((who: Address) =>
            formatEnsAddressName(who, ensNames.get(who.toLowerCase()))
          )}
          currentWei={reward.currentWei}
          currentCentsAsSet={reward.centsAsSet}
          settlementActive={Boolean(settlement.detail?.account?.active)}
        />
      ) : null}
    </>
  );
}
