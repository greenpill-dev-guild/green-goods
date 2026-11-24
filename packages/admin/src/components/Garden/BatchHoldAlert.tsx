import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";

/**
 * A send whose outcome nobody can say yet. What it sent stays locked until the
 * person checks again and it has landed, or they choose to move on, which they
 * can do only from values they have seen.
 */
export function BatchHoldAlert({
  title,
  body,
  hasUnreadValues,
  isSettling,
  isSaving,
  onCheckAgain,
  onMoveOn,
  children,
}: {
  title: string;
  body: string;
  /** The last read could not see everything this send wrote. */
  hasUnreadValues: boolean;
  isSettling: boolean;
  /** Another send is in flight; settling waits for it. */
  isSaving: boolean;
  onCheckAgain: () => void;
  onMoveOn: () => void;
  /** What the chain holds now, when that belongs in the alert. */
  children?: ReactNode;
}) {
  const { formatMessage } = useIntl();
  return (
    <Alert
      variant="warning"
      // Stacked, so a long value truncates at the alert's edge.
      layout="stacked"
      title={title}
      action={
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onCheckAgain}
            disabled={isSaving}
            loading={isSettling}
          >
            {formatMessage({
              id: "app.garden.settings.hold.checkAgain",
              defaultMessage: "Check Again",
            })}
          </Button>
          <Button
            type="button"
            emphasis="tertiary"
            size="sm"
            onClick={onMoveOn}
            disabled={isSaving || isSettling || hasUnreadValues}
          >
            {formatMessage({ id: "app.garden.settings.hold.moveOn", defaultMessage: "Move On" })}
          </Button>
        </div>
      }
    >
      <p>{body}</p>
      {children}
      {hasUnreadValues ? (
        <p className="mt-2">
          {formatMessage({
            id: "app.garden.settings.hold.unread",
            defaultMessage: "Some values couldn’t be read just now. Check again to move on.",
          })}
        </p>
      ) : null}
    </Alert>
  );
}
