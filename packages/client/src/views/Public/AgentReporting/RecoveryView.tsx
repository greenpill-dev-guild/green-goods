import { Alert } from "@green-goods/shared/components/Alert";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import type { AgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import {
  RiArrowLeftRightLine,
  RiCheckLine,
  RiErrorWarningLine,
  RiLinkUnlinkM,
  RiLockPasswordLine,
  RiShieldUserLine,
  RiUserFollowLine,
} from "@remixicon/react";
import { useId, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { FlowForward } from "@/components/Features/Work";
import { AccountActions, PageAccount } from "./CeremonyActs";
import { BarStatus } from "./CeremonyBar";
import { type CeremonyHeading, CeremonyFrame, StageNotice } from "./CeremonyFrame";
import { FAILURE_COPY, failureProblem } from "./failures";
import { CEREMONY_COPY, RECOVERY_COPY, SENT_HEADINGS, STEP_NAMES } from "./messages";
import { WhatHappensNext } from "./WhatHappensNext";

type RecoveryViewProps = Pick<
  AgentReportingRecovery,
  | "stage"
  | "channelLabel"
  | "recoveredAccount"
  | "error"
  | "account"
  | "connecting"
  | "connectWallet"
  | "connectPasskey"
  | "changeAccount"
  | "start"
  | "prove"
  | "confirmCode"
  | "apply"
>;

const CODE_LENGTH = 6;

/**
 * Moving an account to a new chat, drawn as the other ceremonies are: show the account is yours,
 * enter the code the new chat received, then confirm the move after reading what changes. Its
 * steps have no status card until the move is done, so a problem is said in the heading card.
 */
export function RecoveryView(props: RecoveryViewProps) {
  const intl = useIntl();
  const codeId = useId();
  const formId = useId();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const { stage } = props;
  const copy = RECOVERY_COPY[stage];
  const text = (message: MessageDescriptor) => intl.formatMessage(message);
  const opening = stage === "intro" || stage === "opening";
  const proving = stage === "connect" || stage === "proving";
  const confirming = stage === "confirm" || stage === "applying";
  const unusable = stage === "unavailable" || stage === "unsupported";
  const complete = code.length === CODE_LENGTH;

  const submitCode = async () => {
    // A wrong code spends a small attempt budget, so one code is checked at a time.
    if (checking || !complete) return;
    setChecking(true);
    try {
      await props.confirmCode(code);
    } finally {
      setChecking(false);
    }
  };

  const heading: CeremonyHeading = opening
    ? {
        title: RECOVERY_COPY.intro.title,
        info: text(RECOVERY_COPY.intro.body as MessageDescriptor),
        Icon: RiArrowLeftRightLine,
      }
    : proving
      ? {
          title: copy.title,
          // One signature here: moving the account afterwards asks for none.
          info:
            stage === "proving"
              ? text(copy.body as MessageDescriptor)
              : text({
                  id: "public.reporting.connect.once",
                  defaultMessage: "You'll sign once to show it's yours. It costs nothing.",
                }),
          Icon: RiShieldUserLine,
        }
      : stage === "code"
        ? {
            title: copy.title,
            info: text(copy.body as MessageDescriptor),
            Icon: RiLockPasswordLine,
          }
        : confirming
          ? {
              title: copy.title,
              // The account being moved leads, on a line of its own, so the title stays short.
              info: (
                <>
                  <span className="block font-mono" title={props.recoveredAccount ?? undefined}>
                    {formatAddress(props.recoveredAccount)}
                  </span>
                  <span className="block">{text(copy.body as MessageDescriptor)}</span>
                </>
              ),
              Icon: RiArrowLeftRightLine,
            }
          : stage === "applied"
            ? {
                title: SENT_HEADINGS.account,
                info: (
                  <span title={props.recoveredAccount ?? undefined}>
                    {formatAddress(props.recoveredAccount)}
                  </span>
                ),
                Icon: RiUserFollowLine,
              }
            : {
                title: copy.title,
                info: text(copy.body as MessageDescriptor),
                Icon: stage === "unavailable" ? RiLinkUnlinkM : RiErrorWarningLine,
              };

  const actions = opening ? (
    <FlowForward
      label={text({ id: "public.reporting.intro.continue", defaultMessage: "Continue" })}
      loading={stage === "opening"}
      onClick={() => void props.start()}
    />
  ) : proving ? (
    <AccountActions
      account={props.account}
      connecting={props.connecting}
      proving={stage === "proving"}
      onConnectWallet={props.connectWallet}
      onConnectPasskey={() => void props.connectPasskey()}
      onProve={() => void props.prove()}
    />
  ) : stage === "code" ? (
    <FlowForward
      form={formId}
      label={text({ id: "public.reporting.recovery.code.submit", defaultMessage: "Confirm Code" })}
      loading={checking}
      disabled={!complete}
      describedBy={`${codeId}-helper-text`}
    />
  ) : confirming ? (
    <FlowForward
      label={text({ id: "public.reporting.recovery.move", defaultMessage: "Move My Account" })}
      loading={stage === "applying"}
      onClick={() => void props.apply()}
    />
  ) : null;

  // A wrong code is the field's own error; anything else is the step's.
  const failure = props.error && props.error !== "wrong_code" ? failureProblem(props.error) : null;
  const moved = stage === "applied";
  // The account is proven from the code step on, and the page is signed in to it until it closes.
  const signedIn = stage === "code" || confirming || moved;

  return (
    <CeremonyFrame
      screen={unusable ? "state" : "step"}
      steps={
        opening || unusable || moved
          ? null
          : {
              names: [STEP_NAMES.account, STEP_NAMES.code, STEP_NAMES.move].map(text),
              current: proving ? 1 : stage === "code" ? 2 : 3,
            }
      }
      heading={heading}
      problem={moved ? null : failure}
      notice={
        moved ? (
          <StageNotice
            variant="success"
            title={RECOVERY_COPY.applied.title}
            body={CEREMONY_COPY.linked.body as MessageDescriptor}
          />
        ) : null
      }
      actions={actions}
      barStatus={
        moved ? (
          <BarStatus tone="success" icon={<RiCheckLine />} announce={false}>
            {text(RECOVERY_COPY.applied.title)}
          </BarStatus>
        ) : null
      }
    >
      <PageAccount
        account={signedIn ? (props.recoveredAccount ?? props.account) : props.account}
        signedIn={signedIn}
        channel={props.channelLabel}
        // Before the account is proven, the one connected here may not be the one to move.
        onChangeAccount={
          props.account && stage === "connect" ? () => void props.changeAccount() : undefined
        }
      />
      {opening || proving ? <WhatHappensNext flow="move" /> : null}
      {stage === "code" ? (
        <form
          id={formId}
          className="flex min-w-0 flex-col gap-3"
          method="post"
          onSubmit={(event) => {
            event.preventDefault();
            void submitCode();
          }}
        >
          <FormField
            className="min-w-0"
            htmlFor={codeId}
            required
            label={text({
              id: "public.reporting.recovery.code.label",
              defaultMessage: "6-digit code",
            })}
            // Why the act waits, said where the code is typed and kept there, so it never moves.
            hint={text({
              id: "public.reporting.recovery.code.needed",
              defaultMessage: "Enter all 6 digits to continue.",
            })}
            error={props.error === "wrong_code" ? text(FAILURE_COPY.wrong_code) : undefined}
          >
            <TextInput
              id={codeId}
              name="recoveryCode"
              value={code}
              onChange={(event) =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={CODE_LENGTH}
              enterKeyHint="done"
              required
              invalid={props.error === "wrong_code"}
              aria-invalid={props.error === "wrong_code" || undefined}
              aria-describedby={`${codeId}-helper-text`}
              className="text-base font-mono tracking-[0.3em]"
            />
          </FormField>
        </form>
      ) : null}
      {confirming ? (
        // What the move changes, read before the one act that makes it. It is the step's own
        // content, at whatever length it needs, not a status that trades places with another.
        <Alert
          variant="warning"
          layout="stacked"
          title={text({
            id: "public.reporting.recovery.confirm.changes",
            defaultMessage: "What changes",
          })}
        >
          <p>
            {text({
              id: "public.reporting.recovery.confirm.body",
              defaultMessage:
                "Your previous chat on this channel loses access. Other connected channels keep their conversations. Open pages close and reporting permissions pause. Unfinished reports from the replaced chat move here.",
            })}
          </p>
        </Alert>
      ) : null}
    </CeremonyFrame>
  );
}
