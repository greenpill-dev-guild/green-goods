import { Button } from "@green-goods/shared/components/Button";
import { RiAddLine, RiArrowRightSLine, RiHandHeartLine, RiSeedlingLine } from "@remixicon/react";
import { type ReactNode, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

import { AppSheet } from "@/components/Sheets/AppSheet";
import { APP_ROUTES } from "@/config/pwaRouting";

export type CommitmentDoor = "offer" | "request";

export interface PoolCreateEntryProps {
  onChoose: (door: CommitmentDoor) => void;
}

function Choice({
  icon,
  iconClassName,
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  iconClassName: string;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-pressable="card"
      onClick={onClick}
      className="grid min-h-22 w-full grid-cols-[2.5rem_1fr_1.25rem] items-center gap-3 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-4 py-3.5 text-left text-text-strong-950 hover:bg-bg-weak-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <span
        className={`grid h-10 w-10 place-items-center rounded-full ${iconClassName}`}
        aria-hidden="true"
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-text-sub-600">{description}</span>
      </span>
      <RiArrowRightSLine className="h-5 w-5 text-text-soft-400" aria-hidden="true" />
    </button>
  );
}

/**
 * The way into a new promise: the floating + opens the Offer or Request sheet,
 * whose two cards are the two doors (D10). Direction is fixed by the door and
 * never asked again inside the form, so a member who wanted the other one
 * leaves and comes back through it. The sheet links to Help, where promises are
 * explained, since the tab no longer carries that explanation itself.
 *
 * The + floats above the bottom nav so it is reachable however far the list has
 * scrolled, and it stays when the list is empty (D25). Only members see it
 * (D14); the caller decides that.
 */
export function PoolCreateEntry({ onChoose }: PoolCreateEntryProps) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const choose = (door: CommitmentDoor) => {
    setOpen(false);
    onChoose(door);
  };

  return (
    <>
      <div
        className="fixed right-4 z-nav flex flex-col items-end gap-3"
        style={{ bottom: "calc(69px + env(safe-area-inset-bottom) + 1rem)" }}
        data-component="PoolCreateEntry"
      >
        <button
          type="button"
          data-pressable="fab"
          aria-haspopup="dialog"
          aria-label={formatMessage({ id: "app.pool.create.open" })}
          onClick={() => setOpen(true)}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-action text-primary-action-foreground shadow-lg tap-target-lg"
        >
          <RiAddLine className="h-6 w-6" aria-hidden="true" />
        </button>
      </div>
      <AppSheet
        isOpen={open}
        onClose={() => setOpen(false)}
        size="compact"
        header={{
          title: formatMessage({ id: "app.pool.create.open" }),
          description: formatMessage({ id: "app.pool.create.description" }),
        }}
      >
        <div className="grid gap-3">
          <Choice
            icon={<RiSeedlingLine className="h-5 w-5" />}
            iconClassName="bg-primary-alpha-10 text-primary"
            title={formatMessage({ id: "app.pool.door.offer" })}
            description={formatMessage({ id: "app.pool.door.offerHint" })}
            onClick={() => choose("offer")}
          />
          <Choice
            icon={<RiHandHeartLine className="h-5 w-5" />}
            iconClassName="bg-information-lighter text-information-base"
            title={formatMessage({ id: "app.pool.door.request" })}
            description={formatMessage({ id: "app.pool.door.requestHint" })}
            onClick={() => choose("request")}
          />
          <Button
            type="button"
            emphasis="tertiary"
            size="compact"
            className="justify-self-start"
            onClick={() => {
              setOpen(false);
              navigate(`${APP_ROUTES.profile}?tab=help`);
            }}
          >
            {formatMessage({ id: "app.pool.create.howItWorks" })}
          </Button>
        </div>
      </AppSheet>
    </>
  );
}
