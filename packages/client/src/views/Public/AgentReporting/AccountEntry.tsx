import type { AgentReportingCeremony } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingCeremony";
import { RiUserAddLine, RiUserSearchLine, RiUserSmileLine } from "@remixicon/react";
import { type ReactNode, useId, useState } from "react";
import { useIntl } from "react-intl";
import { ConnectActions } from "./CeremonyActs";
import { CeremonyFrame, type CeremonyHeading } from "./CeremonyFrame";
import {
  accountFailureProblem,
  type CeremonyProblem,
  PASSKEYS_UNAVAILABLE,
  type SpokenProblem,
} from "./failures";
import { AccountNameForm, EntryActs, EntryLinks, NameActs, type NameScreen } from "./LinkScreens";

/**
 * The account step's screens while no account is connected: the two doors, the acts for an
 * account the person already has, and a name to create one by or to find one by.
 */
export type EntryScreen = "doors" | "existing" | NameScreen;

type AccountEntryProps = Pick<
  AgentReportingCeremony,
  "failure" | "savedPasskey" | "canFindAccount" | "connecting" | "connectWallet" | "connectPasskey"
> & {
  /** The page's own heading for this step, shown while the passkey and wallet acts are offered. */
  heading: CeremonyHeading;
  steps: { names: string[]; current: number } | null;
  /** What stopped the page itself, as a request that could not be reached does. */
  problem: CeremonyProblem | null;
  /**
   * Given only by a page that may create an account, which is linking one to a chat. Without it
   * the step has no door to a new account and no link to one.
   */
  createAccount?: AgentReportingCeremony["createAccount"];
  passkeyUnavailable?: boolean;
  /** The page's account, for the top bar's sheet. */
  account: ReactNode;
  /**
   * The status card of a page that has one. Such a page says what went wrong in that card, so it
   * is handed the problem and the heading card keeps its own words.
   */
  status?: (problem: CeremonyProblem | SpokenProblem | null) => ReactNode;
  /** Under the heading while no name is being asked for. */
  children?: ReactNode;
  /** Story fixture: the screen the step opens on. */
  initialEntry?: EntryScreen;
};

/**
 * The account step before an account is connected, on every page that needs one. A browser that
 * remembers no passkey cannot tell a newcomer from someone whose account is elsewhere, so where
 * an account may be created the step opens on two doors: create one, or use the one you have.
 * Behind the second are the passkey and the wallet. A browser that does remember a passkey, and
 * every page that only asks for an existing account, opens on those acts, with the other ways in
 * as links.
 *
 * A passkey prompt is opened only where the browser has something to ask for: a passkey it does
 * not remember is found by its account's name first. Nothing creates an account except the
 * create screen's own act. A failed attempt is said with what to do next, in the status card of a
 * page that has one and in the heading card of one that has not. It belongs to the screen it
 * happened on, so it is gone once the person moves to another.
 */
export function AccountEntry(props: AccountEntryProps) {
  const intl = useIntl();
  const formId = useId();
  const { createAccount, passkeyUnavailable = false } = props;
  const canCreate = createAccount !== undefined;
  const opening: EntryScreen =
    canCreate && !props.savedPasskey && !passkeyUnavailable ? "doors" : "existing";
  const [entry, setEntry] = useState<EntryScreen>(props.initialEntry ?? opening);
  const [name, setName] = useState("");
  // The failure that was showing when the person moved on, which the next screen does not repeat.
  const [dismissed, setDismissed] = useState<AccountEntryProps["failure"]>(null);
  const go = (next: EntryScreen) => {
    setName("");
    setDismissed(props.failure);
    setEntry(next);
  };
  const naming: NameScreen | null = entry === "create" || entry === "find" ? entry : null;

  const askForPasskey = () => {
    // With nothing remembered there is no passkey to ask for until the account is named.
    if (!props.savedPasskey && props.canFindAccount) return go("find");
    void props.connectPasskey();
  };

  const heading: CeremonyHeading =
    entry === "doors"
      ? {
          title: { id: "public.reporting.entry.title", defaultMessage: "New to Green Goods?" },
          info: intl.formatMessage({
            id: "public.reporting.entry.body",
            defaultMessage: "Create an account here, or use the one you have.",
          }),
          Icon: RiUserSmileLine,
        }
      : entry === "create"
        ? {
            title: { id: "public.reporting.create.title", defaultMessage: "Create Your Account" },
            info: intl.formatMessage({
              id: "public.reporting.create.body",
              defaultMessage: "Pick a name and keep it safe. It signs you in on other devices.",
            }),
            Icon: RiUserAddLine,
          }
        : entry === "find"
          ? {
              title: { id: "public.reporting.find.title", defaultMessage: "Find Your Account" },
              info: intl.formatMessage({
                id: "public.reporting.find.body",
                defaultMessage: "Enter its name. Its passkey must be on this device or nearby.",
              }),
              Icon: RiUserSearchLine,
            }
          : props.heading;

  const failure = props.failure && props.failure !== dismissed ? props.failure : null;
  const problem = failure
    ? accountFailureProblem(failure)
    : entry === "existing" && passkeyUnavailable
      ? PASSKEYS_UNAVAILABLE
      : props.problem;

  return (
    <CeremonyFrame
      steps={props.steps}
      heading={heading}
      problem={props.status ? null : problem}
      notice={props.status ? props.status(problem) : null}
      actions={
        entry === "doors" ? (
          <EntryActs onCreate={() => go("create")} onExisting={() => go("existing")} />
        ) : naming ? (
          <NameActs
            screen={naming}
            formId={formId}
            name={name}
            busy={props.connecting}
            onBack={() => go(naming === "create" ? opening : "existing")}
          />
        ) : (
          <ConnectActions
            connecting={props.connecting}
            onConnectWallet={props.connectWallet}
            onConnectPasskey={askForPasskey}
            passkeyUnavailable={passkeyUnavailable}
          />
        )
      }
    >
      {props.account}
      {naming ? (
        <AccountNameForm
          screen={naming}
          id={formId}
          name={name}
          onName={setName}
          onSubmit={(chosen) =>
            void (naming === "create" ? createAccount?.(chosen) : props.connectPasskey(chosen))
          }
        />
      ) : (
        props.children
      )}
      {entry === "existing" ? (
        <EntryLinks
          canCreate={canCreate}
          // Without a remembered passkey, the passkey act already asks for the account's name.
          canFind={props.canFindAccount && props.savedPasskey}
          passkeyUnavailable={passkeyUnavailable}
          onName={go}
        />
      ) : null}
    </CeremonyFrame>
  );
}
