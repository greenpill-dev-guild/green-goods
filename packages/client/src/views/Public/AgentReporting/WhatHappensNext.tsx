import { useId } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";

type Row = { title: MessageDescriptor; note: MessageDescriptor };

const ACCOUNT: Row = {
  title: { id: "public.reporting.next.account", defaultMessage: "Show it's your account" },
  note: { id: "public.reporting.next.accountNote", defaultMessage: "It costs nothing." },
};

const JOIN: MessageDescriptor = {
  id: "public.reporting.join.signature",
  defaultMessage: "Join with your own signature",
};
/** A passkey account's join is paid for; a wallet pays its own network fee. */
const JOIN_FREE: Row = {
  title: JOIN,
  note: { id: "public.reporting.join.free", defaultMessage: "It costs nothing." },
};
const JOIN_PAID: Row = {
  title: JOIN,
  note: {
    id: "public.reporting.join.fee",
    defaultMessage: "Your wallet pays a small network fee.",
  },
};
const THEN_CODE: Row = {
  title: { id: "public.reporting.join.code", defaultMessage: "Then send the code in your chat" },
  note: {
    id: "public.reporting.next.codeNote",
    defaultMessage: "That links this account to your chat.",
  },
};
/** A chat that is already linked has no code to send: joining is all that is left. */
const THEN_CHAT: Row = {
  title: { id: "public.reporting.join.back", defaultMessage: "Then go back to your chat" },
  note: {
    id: "public.reporting.join.backNote",
    defaultMessage: "Your account is already linked there.",
  },
};

/**
 * What each kind of page asks for. Before the link is opened the page can't know which flow it is
 * for, so `any` holds for all of them; linking and moving an account ask for something else after
 * the account step, and say so. Joining a garden comes before the code for a new link, and is the
 * only thing left for a chat that is linked already.
 */
const ROWS: Record<
  "any" | "link" | "move" | "joinFree" | "joinPaid" | "joinedFree" | "joinedPaid",
  Row[]
> = {
  any: [
    ACCOUNT,
    {
      title: { id: "public.reporting.next.check", defaultMessage: "Check the details" },
      note: {
        id: "public.reporting.next.checkNote",
        defaultMessage: "You see everything before you sign.",
      },
    },
    {
      title: { id: "public.reporting.next.sign", defaultMessage: "Sign it yourself" },
      note: { id: "public.reporting.next.signNote", defaultMessage: "Nothing is signed for you." },
    },
  ],
  link: [
    ACCOUNT,
    {
      title: { id: "public.reporting.next.code", defaultMessage: "Send a code in your chat" },
      note: {
        id: "public.reporting.next.codeNote",
        defaultMessage: "That links this account to your chat.",
      },
    },
  ],
  joinFree: [JOIN_FREE, THEN_CODE],
  joinPaid: [JOIN_PAID, THEN_CODE],
  joinedFree: [JOIN_FREE, THEN_CHAT],
  joinedPaid: [JOIN_PAID, THEN_CHAT],
  move: [
    ACCOUNT,
    {
      title: { id: "public.reporting.next.enter", defaultMessage: "Enter the code" },
      note: {
        id: "public.reporting.next.enterNote",
        defaultMessage: "Your new chat received it.",
      },
    },
    {
      title: { id: "public.reporting.next.move", defaultMessage: "Confirm the move" },
      note: { id: "public.reporting.next.moveNote", defaultMessage: "Nothing moves until you do." },
    },
  ],
};

/**
 * What the page will ask for, on the screens that have nothing else to show yet: before the link
 * is opened and while the account is shown to be the person's. A few plain promises, in one place
 * on both screens, so opening the link moves nothing. The numbers are the list's own; the flow's
 * steps are in the top bar.
 */
export function WhatHappensNext({ flow = "any" }: { flow?: keyof typeof ROWS }) {
  const intl = useIntl();
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-4"
    >
      <h2 id={headingId} className="text-sm font-semibold leading-5 text-text-strong-950">
        {intl.formatMessage({
          id: "public.reporting.next.title",
          defaultMessage: "What happens next",
        })}
      </h2>
      <ol className="mt-1 divide-y divide-stroke-soft-200">
        {ROWS[flow].map((row, index) => (
          <li key={row.title.id} className="flex min-w-0 items-center gap-3 py-3 last:pb-0">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-stroke-soft-200 text-xs font-medium text-text-sub-600"
            >
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-sm font-medium text-text-strong-950">
                {intl.formatMessage(row.title)}
              </span>
              <span className="text-xs text-text-sub-600">{intl.formatMessage(row.note)}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
