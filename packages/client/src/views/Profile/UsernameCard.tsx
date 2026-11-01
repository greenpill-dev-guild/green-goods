import { Button } from "@green-goods/shared/components/Button";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import type { UsernameCardState } from "@green-goods/shared/hooks/client-ui/profile/useUsernameController";
import { RiAtLine } from "@remixicon/react";
import type { ReactNode } from "react";
import { useIntl } from "react-intl";
import { SETTING_ACT_WIDTH } from "./settingControls";
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
 * The Account tab's Username (PRD-1026, DL-152): one fact row, the name with one text chip and
 * one sentence (D7), and the state's acts in the right slot, one above the other when it has two.
 * While the card asks for a name, the field opens under the row in the same frame. Every state
 * comes from `selectUsernameCard` and its words from `usernameCardWords`; this lays them out and
 * offers each state's acts. The name wraps rather than truncating, because people must read it
 * exactly (p11).
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
      size="sm"
      onClick={onCheckStatus}
      disabled={!isOnline}
      loading={isOnline && isCheckingStatus}
      className={SETTING_ACT_WIDTH}
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
        // The section's title says what changes, so the slot's short word does; a screen
        // reader hears the whole act.
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          onClick={onChangeUsername}
          aria-label={formatMessage({
            id: "app.profile.username.change",
            defaultMessage: "Change Username",
          })}
          className={SETTING_ACT_WIDTH}
        >
          {formatMessage({ id: "app.profile.username.changeShort", defaultMessage: "Change" })}
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
          <Button asChild emphasis="secondary" size="sm" className={SETTING_ACT_WIDTH}>
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
            size="sm"
            onClick={() => onClaim(card.to)}
            disabled={!isOnline}
            className={SETTING_ACT_WIDTH}
          >
            {formatMessage(
              { id: "app.profile.username.claimNamed", defaultMessage: "Claim {name}" },
              { name: card.to }
            )}
          </Button>
          <Button
            type="button"
            emphasis="secondary"
            size="sm"
            onClick={onChooseAnother}
            className={SETTING_ACT_WIDTH}
          >
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
        <Button
          type="button"
          emphasis="secondary"
          size="sm"
          onClick={onOpenGardens}
          className={SETTING_ACT_WIDTH}
        >
          {formatMessage({ id: "app.profile.discoverGardens", defaultMessage: "Open Gardens" })}
        </Button>
      );
      break;
    case "choose":
      actions = (
        <Button
          type="button"
          size="sm"
          onClick={onClaimTyped}
          disabled={!isOnline || !canClaim}
          className={SETTING_ACT_WIDTH}
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
    <div className="gg-card" data-component="UsernameCard" data-state={card.kind}>
      <FactList frame="inset" className="px-3.5">
        <FactRow
          icon={<RiAtLine className="w-4" />}
          label={
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="min-w-0 [overflow-wrap:anywhere]">{title}</span>
              {chip ? (
                <StatusBadge size="xs" variant={chip.tone} showIcon={false}>
                  {chip.text}
                </StatusBadge>
              ) : null}
            </span>
          }
          description={sentence}
          // An empty slot keeps a state with no act a setting's row, its words across the row.
          action={actions ? <span className="flex flex-col gap-2">{actions}</span> : <></>}
        />
      </FactList>
      {card.kind === "choose" && field ? (
        <div className="border-t border-stroke-soft-200 px-3.5 py-3">{field}</div>
      ) : null}
    </div>
  );
}
