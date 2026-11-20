import { SETTLEMENT_ENABLED } from "@green-goods/shared/config/app";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import type {
  PoolConsoleController,
  VoucherConsoleView,
} from "@green-goods/shared/hooks/admin-ui/pool/controller.types";
import { useEnsNames } from "@green-goods/shared/hooks/blockchain/useEnsName";
import { useGoodDollarPrice } from "@green-goods/shared/hooks/blockchain/useGoodDollarPrice";
import { useCommitmentActivity } from "@green-goods/shared/hooks/commitment-pooling/useCommitmentPooling";
import { useSettlementAccount } from "@green-goods/shared/hooks/commitment-pooling/useSettlementQueries";
import { useSeedTrayRoom } from "@green-goods/shared/hooks/admin-ui/pool/useSeedTray";
import {
  displayBucketOf,
  selectConfirmerEdit,
  selectRewardEdit,
} from "@green-goods/shared/modules/commitment-pooling/display-groups";
import type {
  IssuerSafeThreshold,
  VoucherBooking,
} from "@green-goods/shared/modules/commitment-pooling/pool-console";
import type { CommitmentReadModel } from "@green-goods/shared/modules/commitment-pooling/types-core";
import { goodDollarWeiToUsdCents } from "@green-goods/shared/modules/wallet/good-dollar-price";
import type { Address } from "@green-goods/shared/types/domain";
import { useState } from "react";
import { useIntl } from "react-intl";
import { formatEnsAddressName } from "@/components/EnsAddressText";
import type { PoolCommitmentGroup } from "../poolCommitmentRows";
import { cycleName } from "../poolPresentation";
import { exactTime } from "../poolTime";
import { VoucherProposeReturnDialog } from "../VoucherProposeReturnDialog";
import { VoucherRowAct } from "../VoucherRowAct";
import { voucherBookingOptionalAct } from "../voucherPresentation";
import { AddToGroupDialog } from "./AddToGroupDialog";
import { addToGroupRefusal } from "./addToGroupStatus";
import { EditConfirmersDialog } from "./EditConfirmersDialog";
import { EditRewardDialog } from "./EditRewardDialog";
import { GroupInspector } from "./GroupInspector";
import { groupSetAt } from "./groupInspectorModel";
import { confirmerRulesAgree, groupReward, groupTerms } from "./groupTerms";
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
  /** The voucher bookings on the copies: a booked copy offers its optional return here. */
  vouchers?: Pick<VoucherConsoleView, "bookingFor" | "acts">;
  /** The issuer Safe's signature rule, read from the Safe, for that return's dialog. */
  safe?: IssuerSafeThreshold;
}

type GroupStep =
  | "inspect"
  | "seed-more"
  | "add"
  | "edit-reward"
  | "edit-confirmers"
  | "propose-return";

/**
 * The group inspector and where it leads (PRD-1022 D4, D14): Seed More Like
 * This, which adds to the group or starts a new one, Edit Reward while no
 * copy is kept, and Edit Confirmers while any copy is untaken. A copy whose
 * voucher booking still runs offers its optional return beside its row
 * (DL-195): the group's row stays folded, so this is where it is reached.
 * Each dialog closes back to the inspector, which says what changed.
 */
export function GroupDialogs({
  pool,
  group,
  title,
  isProtocol,
  onClose,
  onOpenCommitment,
  onSeedNew,
  vouchers,
  safe,
}: GroupDialogsProps) {
  const intl = useIntl();
  const { formatMessage } = intl;
  const [step, setStep] = useState<GroupStep>("inspect");
  // The return being proposed follows its booking as the read has it now.
  const [proposing, setProposing] = useState<VoucherBooking | null>(null);
  const proposingNow = proposing ? vouchers?.bookingFor(proposing.commitmentId) : undefined;
  const actDisabled = !pool.isOnline || pool.isActing;
  const optionalReturn = (commitment: CommitmentReadModel) => {
    const booking = vouchers?.bookingFor(commitment.commitmentId);
    if (!booking || !vouchers || voucherBookingOptionalAct(booking) === null) return null;
    return (
      <VoucherRowAct
        variant="row"
        booking={booking}
        act="propose"
        disabled={actDisabled}
        onOpen={() => {
          setProposing(booking);
          setStep("propose-return");
        }}
        onRetry={vouchers.acts.retryTransfer}
      />
    );
  };
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
  // Offers count against their maker from the moment they're made.
  const room = useSeedTrayRoom({
    chainId,
    poolId: pool.poolId,
    cap: pool.pool?.providerOpenCommitmentCap,
    viewer,
    pendingCreates: pool.pendingCreates,
  });
  if (!first) return null;

  const metadata = first.metadataCID ? (pool.titles.get(first.metadataCID.trim()) ?? null) : null;
  const reward = groupReward(group.children, pool.titles);
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
  const canEditReward = SETTLEMENT_ENABLED && reward.currentWei !== null && edit.open;
  const confirmerEdit = selectConfirmerEdit(group.children, { unsent });
  const cycle = pool.cycles.find((row) => row.cycleId === first.cycleId);
  const dueMs = Number(first.dueDate ?? 0n) * 1000;
  const template =
    group.children.find((child) => displayBucketOf(child.onchainState) === "available") ?? first;
  const templateMetadata = template.metadataCID
    ? (pool.titles.get(template.metadataCID.trim()) ?? null)
    : null;
  const rewardCents =
    reward.currentWei === null
      ? null
      : (reward.centsAsSet ??
        (price.state.status === "ready"
          ? goodDollarWeiToUsdCents(reward.currentWei, price.state.price)
          : null));
  const addRefusal = addToGroupRefusal({
    first,
    poolState: pool.pool?.state,
    cycle,
    viewer,
    now: Date.now(),
  });
  // An edit whose copies were all taken meanwhile has nothing left to change, and a return whose
  // booking left the read has nothing left to propose: back to the inspector.
  const shown =
    (step === "edit-reward" && !canEditReward) ||
    (step === "edit-confirmers" && !confirmerEdit.open) ||
    (step === "propose-return" && !proposingNow)
      ? "inspect"
      : step;
  const done = (message: string) => {
    toastService.success({ title: message });
    setStep("inspect");
  };

  return (
    <>
      <GroupInspector
        open={shown === "inspect"}
        onClose={onClose}
        group={group}
        title={title}
        cycleName={cycle ? cycleName(cycle, pool.cycleNames, formatMessage) : null}
        chainId={chainId}
        terms={terms}
        rewarded={reward.currentWei !== null}
        canEditReward={canEditReward}
        canSeedMore={
          SETTLEMENT_ENABLED ||
          !group.children.some((child) => child.considerationRail === "CELO_SETTLEMENT")
        }
        events={activity.events}
        waitingOnYou={pool.waitingOnYou}
        onOpenCommitment={onOpenCommitment}
        onSeedMore={() => setStep("seed-more")}
        onEditReward={() => setStep("edit-reward")}
        canEditConfirmers={confirmerEdit.open}
        isOnline={pool.isOnline}
        onEditConfirmers={() => setStep("edit-confirmers")}
        actFor={vouchers ? optionalReturn : undefined}
      />
      {vouchers ? (
        <VoucherProposeReturnDialog
          booking={shown === "propose-return" ? (proposingNow ?? null) : null}
          title={title}
          safe={safe}
          disabled={actDisabled}
          onClose={() => {
            setProposing(null);
            setStep("inspect");
          }}
          onPropose={vouchers.acts.proposeReturn}
        />
      ) : null}
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
                  id: "hub.garden.pool.group.added",
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
            metadata: templateMetadata ?? { version: 1, title },
            gardenAddress: garden,
          }}
          title={title}
          counts={group.counts}
          terms={terms}
          rewardCents={rewardCents}
          offerRoom={first.direction === "OFFER" ? room : null}
        />
      ) : null}
      {shown === "edit-reward" && reward.currentWei !== null ? (
        <EditRewardDialog
          open
          onClose={() => setStep("inspect")}
          onChanged={(count) =>
            done(
              formatMessage(
                {
                  id: "hub.garden.pool.group.rewardChangedToast",
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
          availableRewards={reward.available}
          takenBy={takers.map((who: Address) =>
            formatEnsAddressName(who, ensNames.get(who.toLowerCase()))
          )}
          takenRewards={reward.taken}
          currentWei={reward.currentWei}
          currentCentsAsSet={reward.centsAsSet}
          settlementActive={Boolean(settlement.detail?.account?.active)}
        />
      ) : null}
      {shown === "edit-confirmers" && confirmerEdit.open ? (
        <EditConfirmersDialog
          open
          onClose={() => setStep("inspect")}
          onChanged={(count) =>
            done(
              formatMessage(
                {
                  id: "hub.garden.pool.group.confirmersChangedToast",
                  defaultMessage:
                    "{count, plural, one {Confirmers changed for # promise} other {Confirmers changed for # promises}}",
                },
                { count }
              )
            )
          }
          chainId={chainId}
          garden={garden}
          isProtocol={isProtocol}
          title={title}
          available={confirmerEdit.targets.map((child) => ({
            commitmentId: child.commitmentId,
            // Grouped copies always carry it (`hasKnownDisplayTerms`).
            protocolFallbackEnabled: child.protocolFallbackEnabled === true,
          }))}
          current={confirmerEdit.targets[0]}
          mixed={!confirmerRulesAgree(confirmerEdit.targets)}
          direction={first.direction}
          taken={group.counts.inProgress + group.counts.kept}
        />
      ) : null}
    </>
  );
}
