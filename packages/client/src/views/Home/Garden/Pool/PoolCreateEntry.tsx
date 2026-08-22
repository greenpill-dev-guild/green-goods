import { cn, useWindowEvent } from "@green-goods/shared";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "react-intl";

export type CommitmentDoor = "offer" | "request";

export interface PoolCreateEntryProps {
  onChoose: (door: CommitmentDoor) => void;
}

/**
 * The two one-word doors into making a commitment.
 *
 * Direction is fixed by the door and never asked again inside the form, so a
 * member who wanted the other one leaves and comes back through it. The entry
 * floats above the bottom nav so it is reachable however far the list has
 * scrolled; it only opens the doors and is never itself a form.
 *
 * The client has no floating-entry primitive of its own yet. This is the one
 * place it exists, kept deliberately small, until a shared one is promoted.
 */
export function PoolCreateEntry({ onChoose }: PoolCreateEntryProps) {
  const { formatMessage } = useIntl();
  const [open, setOpen] = useState(false);
  const entryRef = useRef<HTMLButtonElement>(null);
  const firstChoiceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstChoiceRef.current?.focus();
  }, [open]);

  const close = () => {
    setOpen(false);
    // The doors unmount with the scrim, so focus would otherwise fall to body.
    entryRef.current?.focus();
  };

  useWindowEvent("keydown", (event) => {
    if (open && event.key === "Escape") {
      event.preventDefault();
      close();
    }
  });

  return (
    <>
      {open ? (
        // A pointer convenience only: keyboard users close with Escape or the
        // entry itself, so the scrim carries no role of its own.
        <div
          aria-hidden="true"
          onClick={close}
          className="fixed inset-0 z-nav bg-text-strong-950/30"
          data-component="PoolCreateScrim"
        />
      ) : null}
      <div
        className="fixed right-4 z-nav flex flex-col items-end gap-3"
        style={{ bottom: "calc(69px + env(safe-area-inset-bottom) + 1rem)" }}
        data-component="PoolCreateEntry"
        data-open={open ? "true" : "false"}
      >
        {open ? (
          <>
            <button
              type="button"
              // The choices sit above the toggle in the DOM, so Tab from the
              // toggle would leave the menu entirely. Opening moves focus to
              // the first choice; Escape and the toggle return it.
              ref={firstChoiceRef}
              onClick={() => onChoose("offer")}
              className="rounded-full bg-bg-white-0 px-5 py-3 text-sm font-medium text-text-strong-950 shadow-md tap-target-lg"
            >
              {formatMessage({ id: "app.pool.door.offer" })}
            </button>
            <button
              type="button"
              onClick={() => onChoose("request")}
              className="rounded-full bg-bg-white-0 px-5 py-3 text-sm font-medium text-text-strong-950 shadow-md tap-target-lg"
            >
              {formatMessage({ id: "app.pool.door.request" })}
            </button>
          </>
        ) : null}
        <button
          ref={entryRef}
          type="button"
          aria-expanded={open}
          aria-label={formatMessage({
            id: open ? "app.pool.create.close" : "app.pool.create.open",
          })}
          onClick={() => (open ? close() : setOpen(true))}
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-full bg-primary-action text-primary-action-foreground shadow-lg transition-transform duration-[var(--spring-spatial-fast-duration)] ease-[var(--spring-spatial-fast-easing)] tap-target-lg",
            open && "rotate-45"
          )}
        >
          {open ? (
            <RiCloseLine className="h-6 w-6 -rotate-45" aria-hidden="true" />
          ) : (
            <RiAddLine className="h-6 w-6" aria-hidden="true" />
          )}
        </button>
      </div>
    </>
  );
}
