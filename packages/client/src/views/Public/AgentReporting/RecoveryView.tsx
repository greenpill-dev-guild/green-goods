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
import {
  AccountActions,
  AccountLine,
  ActContext,
  BarStatus,
  BLOCKED_ID,
  type CeremonyHeading,
  CeremonyFrame,
  StageNotice,
} from "./CeremonyFrame";
import {
  CAUTIONS,
  CEREMONY_COPY,
  FAILURE_COPY,
  RECOVERY_COPY,
  SENT_HEADINGS,
  STEP_NAMES,
} from "./messages";

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
  | "start"
  | "prove"
  | "confirmCode"
  | "apply"
>;

const CODE_LENGTH = 6;

/**
 * Moving an account to a new chat, drawn as the other ceremonies are: show the account is yours,
 * enter the code the new chat received, then confirm the move after reading what changes.
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
        title: copy.title,
        info: text(RECOVERY_COPY.intro.body as MessageDescriptor),
        Icon: RiArrowLeftRightLine,
      }
    : proving
      ? { title: copy.title, info: text(copy.body as MessageDescriptor), Icon: RiShieldUserLine }
      : stage === "code"
        ? {
            title: copy.title,
            info: text({
              id: "public.reporting.recovery.code.body",
              defaultMessage: "Your new chat received a 6-digit code. Enter it here.",
            }),
            Icon: RiLockPasswordLine,
          }
        : confirming
          ? {
              title: RECOVERY_COPY.confirm.title,
              info: text({
                id: "public.reporting.recovery.confirm.info",
                defaultMessage: "Check what changes before you move it.",
              }),
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
      describedBy={complete ? undefined : BLOCKED_ID}
    />
  ) : confirming ? (
    <FlowForward
      label={text({ id: "public.reporting.recovery.move", defaultMessage: "Move My Account" })}
      loading={stage === "applying"}
      onClick={() => void props.apply()}
    />
  ) : null;

  return (
    <CeremonyFrame
      channel={props.channelLabel}
      screen={unusable ? "state" : "step"}
      steps={
        opening || unusable
          ? null
          : {
              names: [STEP_NAMES.account, STEP_NAMES.code, STEP_NAMES.move].map(text),
              current: proving ? 1 : stage === "code" ? 2 : confirming ? 3 : 4,
            }
      }
      heading={heading}
      values={{ account: formatAddress(props.recoveredAccount) }}
      notice={
        confirming ? (
          // What the move changes, read before the one act that makes it.
          <Alert
            variant="warning"
            layout="stacked"
            title={text({
              id: "public.reporting.recovery.confirm.changes",
              defaultMessage: "What changes",
            })}
          >
            <p>{text(RECOVERY_COPY.confirm.body as MessageDescriptor)}</p>
          </Alert>
        ) : stage === "applied" ? (
          <StageNotice
            variant="success"
            title={RECOVERY_COPY.applied.title}
            body={CEREMONY_COPY.linked.body as MessageDescriptor}
          />
        ) : null
      }
      error={
        props.error && props.error !== "wrong_code"
          ? {
              message: FAILURE_COPY[props.error],
              tone: CAUTIONS.has(props.error) ? "caution" : "error",
            }
          : null
      }
      blocked={
        stage === "code" && !complete
          ? {
              message: {
                id: "public.reporting.recovery.code.needed",
                defaultMessage: "Enter all 6 digits to continue.",
              },
              tone: "neutral",
            }
          : null
      }
      barNotes={
        proving && props.account ? (
          <ActContext account={<AccountLine account={props.account} relation="connected" />} />
        ) : null
      }
      actions={actions}
      barStatus={
        stage === "applied" ? (
          <BarStatus tone="success" icon={<RiCheckLine />} announce={false}>
            {text({ id: "public.reporting.recovery.moved", defaultMessage: "Account moved" })}
          </BarStatus>
        ) : null
      }
    >
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
    </CeremonyFrame>
  );
}
