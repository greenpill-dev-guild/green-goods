import { Button } from "@green-goods/shared/components/Button";
import type {
  CommitmentMetadataV1,
  CommitmentReadModel,
} from "@green-goods/shared/commitment-pooling";
import { usePromiseGroupOf } from "@green-goods/shared/hooks/client-ui/pool/usePromiseGroups";
import type { Address } from "@green-goods/shared/types/domain";
import { RiStackLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { Link } from "react-router-dom";

export interface PromiseGroupLineProps {
  /** Published promises in the group, this one included. */
  count: number;
  /** The reader took this one up, so it is theirs to finish on its own. */
  yours: boolean;
  /** Where See the Group goes, relative to this promise's page, naming this copy. */
  to: string;
}

/**
 * One line on a copy's page (PRD-1029 c5): it is one of several separate
 * promises, and the reader's is confirmed on its own, with the way back to
 * the group.
 */
export function PromiseGroupLine({ count, yours, to }: PromiseGroupLineProps) {
  const { formatMessage } = useIntl();
  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-sub-600"
      data-component="PromiseGroupLine"
    >
      <RiStackLine className="h-4 w-4 shrink-0 text-text-soft-400" aria-hidden="true" />
      <p className="min-w-0 flex-1">
        {formatMessage(
          { id: yours ? "app.pool.group.copyLineYours" : "app.pool.group.copyLine" },
          { count }
        )}
      </p>
      <Button asChild emphasis="tertiary" size="sm">
        <Link to={to} relative="path">
          {formatMessage({ id: "app.pool.group.seeGroup" })}
        </Link>
      </Button>
    </div>
  );
}

/** The line, for a promise whose metadata names a group the app can read as one. */
export function PromiseGroupNote(props: {
  chainId: number;
  commitment: CommitmentReadModel;
  metadata: CommitmentMetadataV1 | null;
  viewer: Address | null;
}) {
  const group = usePromiseGroupOf(props);
  if (!group) return null;
  return (
    <PromiseGroupLine
      count={group.count}
      yours={group.yours}
      to={`../group/${encodeURIComponent(group.displayGroupId)}?copy=${props.commitment.commitmentId.toString()}`}
    />
  );
}
