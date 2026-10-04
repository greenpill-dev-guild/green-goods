import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import { useId } from "react";
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

/** Naming a new account: create it, or go back to the two ways in. The field is on the page. */
export function CreateActs({
  formId,
  name,
  creating,
  onBack,
}: {
  formId: string;
  name: string;
  creating: boolean;
  onBack: () => void;
}) {
  const intl = useIntl();
  return (
    <PairedActs>
      <Button size="lg" type="submit" form={formId} loading={creating} disabled={!nameReady(name)}>
        {intl.formatMessage({
          id: "app.login.button.createAccount",
          defaultMessage: "Create Account",
        })}
      </Button>
      <Button size="lg" emphasis="secondary" disabled={creating} onClick={onBack}>
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

/** The one thing a new account is asked for. The heading card says why the name matters. */
export function CreateAccountForm({
  id,
  name,
  onName,
  onCreate,
}: {
  id: string;
  name: string;
  onName: (name: string) => void;
  onCreate: (name: string) => void;
}) {
  const intl = useIntl();
  const nameId = useId();
  return (
    <form
      id={id}
      className="flex min-w-0 flex-col gap-3"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        if (nameReady(name)) onCreate(name.trim());
      }}
    >
      <FormField
        htmlFor={nameId}
        required
        label={intl.formatMessage({
          id: "app.login.username.newAccountLabel",
          defaultMessage: "Display name for new account",
        })}
      >
        <TextInput
          id={nameId}
          name="displayName"
          value={name}
          onChange={(event) => onName(event.target.value)}
          placeholder={intl.formatMessage({
            id: "app.login.username.placeholder",
            defaultMessage: "e.g. alice or alice.eth",
          })}
          minLength={MIN_NAME}
          autoComplete="nickname"
          required
        />
      </FormField>
    </form>
  );
}

/** For someone with no account yet, under what the link step will ask for. */
export function CreateAccountLink({
  disabled,
  onCreate,
}: {
  disabled: boolean;
  onCreate: () => void;
}) {
  const intl = useIntl();
  return (
    <Button
      type="button"
      size="sm"
      emphasis="tertiary"
      className="text-sm text-primary-action underline underline-offset-4"
      disabled={disabled}
      onClick={onCreate}
    >
      {intl.formatMessage({
        id: "public.reporting.create.link",
        defaultMessage: "New here? Create an account",
      })}
    </Button>
  );
}
