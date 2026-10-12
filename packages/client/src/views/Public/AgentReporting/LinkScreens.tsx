import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { type ReactNode, useId } from "react";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useIntl } from "react-intl";
import { PairedActs } from "./CeremonyBar";
import { BLOCKED_ID } from "./CeremonyFrame";

/** A display name is the account's way back in on another device, so it is never one or two letters. */
const MIN_NAME = 3;

function nameReady(name: string): boolean {
  return name.trim().length >= MIN_NAME;
}

/**
 * The page opened inside a chat app's own browser, where passkey and wallet prompts may not open.
 * Leaving for the person's browser is the act; carrying on here stays possible, since some of
 * these browsers do work. Both labels are long in Spanish and Portuguese, so they are set a size
 * down: the pair shares one row on the narrowest phone and the bar keeps its height.
 */
export function BrowserActs({ onOpen, onStay }: { onOpen: () => void; onStay: () => void }) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" className="!px-2 !text-sm" onClick={onOpen}>
        {intl.formatMessage({
          id: "public.reporting.browser.open",
          defaultMessage: "Open in Browser",
        })}
      </Button>
      <Button size="lg" className="!px-2 !text-sm" emphasis="secondary" onClick={onStay}>
        {intl.formatMessage({
          id: "public.reporting.browser.continue",
          defaultMessage: "Continue Here",
        })}
      </Button>
    </PairedActs>
  );
}

/**
 * The account step's two doors, where a browser that remembers no passkey cannot tell a newcomer
 * from someone whose account is elsewhere. Neither opens a prompt: each leads to the screen
 * that asks for what it needs. The labels are set a size down, as the in-app pair is, so the
 * pair shares one row on the narrowest phone in every language.
 */
export function EntryActs({
  onCreate,
  onExisting,
}: {
  onCreate: () => void;
  onExisting: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" className="!px-2 !text-sm" onClick={onCreate}>
        {intl.formatMessage({
          id: "app.login.button.createAccount",
          defaultMessage: "Create Account",
        })}
      </Button>
      <Button size="lg" className="!px-2 !text-sm" emphasis="secondary" onClick={onExisting}>
        {intl.formatMessage({
          id: "public.reporting.entry.existing",
          defaultMessage: "I Have an Account",
        })}
      </Button>
    </PairedActs>
  );
}

/**
 * An account by its name: a new one to create, or one this browser does not remember to find.
 * Either way the act submits the field on the page, and Back returns to the ways in.
 */
export type NameScreen = "create" | "find";

export function NameActs({
  screen,
  formId,
  name,
  busy,
  onBack,
}: {
  screen: NameScreen;
  formId: string;
  name: string;
  busy: boolean;
  onBack: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" type="submit" form={formId} loading={busy} disabled={!nameReady(name)}>
        {screen === "create"
          ? intl.formatMessage({
              id: "app.login.button.createAccount",
              defaultMessage: "Create Account",
            })
          : intl.formatMessage({
              id: "public.reporting.find.action",
              defaultMessage: "Find Account",
            })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={busy} onClick={onBack}>
        {intl.formatMessage({ id: "app.login.button.back", defaultMessage: "Back" })}
      </Button>
    </PairedActs>
  );
}

/**
 * Joining the Community Garden, or not. Joining is switched off while another account than the
 * one the chat links is connected; the heading card says which one to switch to.
 */
export function JoinActs({
  sending,
  blocked,
  onJoin,
  onSkip,
}: {
  sending: boolean;
  blocked: boolean;
  onJoin: () => void;
  onSkip: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button
        size="lg"
        loading={sending}
        disabled={blocked}
        aria-describedby={blocked ? BLOCKED_ID : undefined}
        onClick={onJoin}
      >
        {intl.formatMessage({ id: "public.reporting.join.action", defaultMessage: "Join Garden" })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={sending} onClick={onSkip}>
        {intl.formatMessage({ id: "public.reporting.join.notNow", defaultMessage: "Not Now" })}
      </Button>
    </PairedActs>
  );
}

/**
 * The one thing either naming screen asks for: the name a new account will go by, or the name an
 * existing one was created with. Both call it the account's name, so the name chosen on one is
 * recognizably the name asked for on the other. The heading card says why it matters.
 */
export function AccountNameForm({
  screen,
  id,
  name,
  onName,
  onSubmit,
}: {
  screen: NameScreen;
  id: string;
  name: string;
  onName: (name: string) => void;
  onSubmit: (name: string) => void;
}) {
  const intl = useIntl();
  const nameId = useId();
  const creating = screen === "create";
  return (
    <form
      id={id}
      className="flex min-w-0 flex-col gap-3"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (nameReady(name)) onSubmit(name.trim());
      }}
    >
      <FormField
        htmlFor={nameId}
        required
        label={intl.formatMessage({
          id: "public.reporting.account.nameLabel",
          defaultMessage: "Account name",
        })}
      >
        <TextInput
          id={nameId}
          name={creating ? "displayName" : "username"}
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder={intl.formatMessage({
            id: "app.login.username.placeholder",
            defaultMessage: "e.g. alice or alice.eth",
          })}
          minLength={MIN_NAME}
          autoComplete={creating ? "nickname" : "username"}
          required
        />
      </FormField>
    </form>
  );
}

function StepLink({
  disabled = false,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      emphasis="tertiary"
      // A link longer than the page, as large text or a long translation makes it, wraps.
      className="max-w-full whitespace-normal text-sm text-primary-action underline underline-offset-4"
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}

/**
 * Under the account step, with an account connected: the link names it and lets it go. The page
 * starts on whichever account this browser last used, which may not be the one meant, and
 * nothing else on the step says which account will sign.
 */
export function OtherAccountLink({
  account,
  onChangeAccount,
}: {
  account: string;
  onChangeAccount: () => void;
}) {
  const intl = useIntl();
  return (
    <StepLink onClick={onChangeAccount}>
      <span title={account}>
        {intl.formatMessage(
          {
            id: "public.reporting.connect.other",
            defaultMessage: "Not {account}? Use a different account",
          },
          { account: formatAddress(account) }
        )}
      </span>
    </StepLink>
  );
}

/**
 * The other ways in, under the passkey and wallet acts: a new account, and another account than
 * the one whose passkey this browser remembers. Each is offered only where it can work.
 */
export function EntryLinks({
  canCreate,
  canFind,
  passkeyUnavailable,
  onName,
}: {
  /** Only linking an account may create one. */
  canCreate: boolean;
  canFind: boolean;
  passkeyUnavailable: boolean;
  onName: (screen: NameScreen) => void;
}) {
  const intl = useIntl();
  return (
    <>
      {canCreate ? (
        <StepLink disabled={passkeyUnavailable} onClick={() => onName("create")}>
          {intl.formatMessage({
            id: "public.reporting.create.link",
            defaultMessage: "New here? Create an account",
          })}
        </StepLink>
      ) : null}
      {canFind ? (
        <StepLink disabled={passkeyUnavailable} onClick={() => onName("find")}>
          {intl.formatMessage({
            id: "public.reporting.find.link",
            defaultMessage: "Another account? Find it by name",
          })}
        </StepLink>
      ) : null}
    </>
  );
}
