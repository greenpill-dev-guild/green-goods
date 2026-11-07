import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import type { useGardenCommitmentController } from "@green-goods/shared/hooks/client-ui/commitment/useGardenCommitmentController";
import type { Address } from "@green-goods/shared/types/domain";
import { useIntl } from "react-intl";
import { CommitmentIdentity, type CommitmentIdentityProps } from "./CommitmentIdentity";
import { CommitmentPlace } from "./CommitmentPlace";

interface TakeUpReviewSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  controller: ReturnType<typeof useGardenCommitmentController>;
  identity: Pick<
    CommitmentIdentityProps,
    "commitment" | "contributors" | "band" | "units" | "stewards"
  >;
  heading: string;
  canConfirm: boolean;
}

/** Review the ordinary take-up before the controller admits its claim to the queue. */
export function TakeUpReviewSheet({
  open,
  onOpenChange,
  controller,
  identity,
  heading,
  canConfirm,
}: TakeUpReviewSheetProps) {
  const { formatMessage } = useIntl();
  const isPending = controller.isQueueing || controller.isSending;
  return (
    <DialogShell
      open={open}
      onOpenChange={onOpenChange}
      preventClose={isPending}
      title={formatMessage({ id: "app.commitment.takeUp.review.title" })}
      description={formatMessage({ id: "app.commitment.takeUp.review.body" })}
      sheetSize="full"
      actions={{
        primary: {
          label: formatMessage({ id: "app.common.confirm" }),
          loading: isPending,
          disabled: controller.queue.hasPendingJob || !canConfirm,
          onClick: () => {
            if (isPending || controller.queue.hasPendingJob || !canConfirm) return;
            void controller.acts
              .claimPersonal()
              .then(() => onOpenChange(false))
              .catch(() => undefined);
          },
        },
        secondary: {
          label: formatMessage({ id: "app.common.cancel" }),
          disabled: isPending,
          onClick: () => onOpenChange(false),
        },
      }}
    >
      <div className="space-y-4">
        <h3 className="type-title-md">{heading}</h3>
        <CommitmentPlace
          showGardenAddressWhenUnknown
          chainId={controller.chainId}
          commitment={identity.commitment}
          garden={controller.pool?.garden ?? (controller.routeGarden as Address | undefined)}
        />
        <CommitmentIdentity
          {...identity}
          seat={controller.seat}
          metadata={controller.metadata}
          joinable={false}
          viewer={controller.viewer}
        />
      </div>
    </DialogShell>
  );
}
