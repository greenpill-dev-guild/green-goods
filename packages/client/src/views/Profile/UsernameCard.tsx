import { Button } from "@green-goods/shared/components/Button";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { UsernameCardState } from "@green-goods/shared/hooks/client-ui/profile/useUsernameController";
import { RiAtLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { Card } from "@/components/Cards";
import { Avatar } from "@/components/Display";
import { usernameCardWords } from "./usernameCardWords";

export interface UsernameCardProps {
  card: Exclude<UsernameCardState, { kind: "loading" }>;
  isOnline: boolean;
  /** The name field, shown while the card asks for a name. */
  field?: ReactNode;
  /** The typed name can be claimed: valid, free, and not already being claimed. */
  canClaim: boolean;
  isCheckingStatus: boolean;
  /** Where Get Help leads: support, as today. */
  helpHref: string;
  onClaimTyped: () => void;
  onClaim: (slug: string) => void;
  onCheckStatus: () => void;
  onChangeUsername: () => void;
  onChooseAnother: () => void;
  onOpenGardens: () => void;
}

/**
 * The Account tab's Username card (PRD-1026): the tab's own row, a 40px icon
 * beside the name with one text chip and one sentence (D7), then any field
 * and the card's acts at full width under it, like Logout. Every state comes
 * from `selectUsernameCard` and its words from `usernameCardWords`; this lays
 * them out and offers each state's acts. The name wraps rather than
 * truncating, because people must read it exactly (p11).
 */
export function UsernameCard({
  card,
  isOnline,
  field,
  canClaim,
  isCheckingStatus,
  helpHref,
  onClaimTyped,
  onClaim,
  onCheckStatus,
  onChangeUsername,
  onChooseAnother,
  onOpenGardens,
}: UsernameCardProps) {
  const { formatMessage } = useIntl();
  const { title, chip, sentence } = usernameCardWords(card, isOnline, formatMessage);

  const checkStatus = (
    <Button
      type="button"
      emphasis="secondary"
      onClick={onCheckStatus}
      disabled={!isOnline}
      loading={isOnline && isCheckingStatus}
      className="w-full"
    >
      {isOnline
        ? formatMessage({ id: "app.profile.username.checkStatus", defaultMessage: "Check Status" })
        : formatMessage({
            id: "app.profile.username.goOnlineToCheck",
            defaultMessage: "Go Online to Check",
          })}
    </Button>
  );

  let actions: ReactNode = null;
  switch (card.kind) {
    case "ready":
      actions = (
        <Button type="button" emphasis="secondary" onClick={onChangeUsername} className="w-full">
          {formatMessage({ id: "app.profile.username.change", defaultMessage: "Change Username" })}
        </Button>
      );
      break;
    case "setting-up":
    case "releasing":
    case "unknown":
      // No change starts from a status nobody could read (D10).
      actions = checkStatus;
      break;
    case "taking-longer":
      actions = (
        <>
          {checkStatus}
          <Button asChild emphasis="secondary" className="w-full">
            <a href={helpHref} target="_blank" rel="noopener noreferrer">
              {formatMessage({ id: "app.profile.username.getHelp", defaultMessage: "Get Help" })}
            </a>
          </Button>
        </>
      );
      break;
    case "claimable":
      actions = (
        <>
          <Button
            type="button"
            onClick={() => onClaim(card.to)}
            disabled={!isOnline}
            className="w-full"
          >
            {formatMessage(
              { id: "app.profile.username.claimNamed", defaultMessage: "Claim {name}" },
              { name: card.to }
            )}
          </Button>
          <Button type="button" emphasis="secondary" onClick={onChooseAnother} className="w-full">
            {formatMessage({
              id: "app.profile.username.chooseAnother",
              defaultMessage: "Choose Another",
            })}
          </Button>
        </>
      );
      break;
    case "locked":
      actions = (
        <Button type="button" emphasis="secondary" onClick={onOpenGardens} className="w-full">
          {formatMessage({ id: "app.profile.discoverGardens", defaultMessage: "Open Gardens" })}
        </Button>
      );
      break;
    case "choose":
      actions = (
        <Button
          type="button"
          onClick={onClaimTyped}
          disabled={!isOnline || !canClaim}
          className="w-full"
        >
          {isOnline
            ? formatMessage({ id: "app.profile.claimButton", defaultMessage: "Claim Name" })
            : formatMessage({
                id: "app.profile.claimOffline",
                defaultMessage: "Go Online to Claim",
              })}
        </Button>
      );
      break;
    case "checking":
    case "claiming":
      // Nothing to act on until the check or the claim answers.
      break;
  }

  return (
    <Card>
      <div
        className="flex w-full flex-col gap-3"
        data-component="UsernameCard"
        data-state={card.kind}
      >
        <div className="flex items-start gap-3">
          <Avatar>
            <RiAtLine className="h-4 w-4 text-primary" aria-hidden="true" />
          </Avatar>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 text-sm font-medium text-text-strong-950 [overflow-wrap:anywhere]">
                {title}
              </span>
              {chip ? (
                <StatusBadge size="xs" variant={chip.tone} showIcon={false} className="shrink-0">
                  {chip.text}
                </StatusBadge>
              ) : null}
            </div>
            <p className="text-xs text-text-sub-600">{sentence}</p>
          </div>
        </div>
        {card.kind === "choose" ? field : null}
        {actions ? <div className="flex flex-col gap-2">{actions}</div> : null}
      </div>
    </Card>
  );
}
