import { Button } from "@green-goods/shared/components/Button";
import { TextInput } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import type { AgentReportingRecovery } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingRecovery";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { AccountStep, CeremonyFrame } from "./CeremonyFrame";
import { CAUTIONS, FAILURE_COPY, RECOVERY_COPY } from "./messages";

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

export function RecoveryView(props: RecoveryViewProps) {
  const intl = useIntl();
  const codeId = useId();
  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const { stage } = props;
  const copy = RECOVERY_COPY[stage];

  const submitCode = async () => {
    setChecking(true);
    try {
      await props.confirmCode(code);
    } finally {
      setChecking(false);
    }
  };

  return (
    <CeremonyFrame
      channel={props.channelLabel}
      title={copy.title}
      body={copy.body}
      values={{ account: formatAddress(props.recoveredAccount) }}
      error={
        props.error && props.error !== "wrong_code"
          ? { message: FAILURE_COPY[props.error], caution: CAUTIONS.has(props.error) }
          : null
      }
      actions={
        <>
          {stage === "intro" || stage === "opening" ? (
            <Button size="lg" loading={stage === "opening"} onClick={() => void props.start()}>
              {intl.formatMessage({
                id: "public.reporting.intro.continue",
                defaultMessage: "Continue",
              })}
            </Button>
          ) : null}
          {stage === "connect" || stage === "proving" ? (
            <AccountStep
              account={props.account}
              connecting={props.connecting}
              proving={stage === "proving"}
              onConnectWallet={props.connectWallet}
              onConnectPasskey={() => void props.connectPasskey()}
              onProve={() => void props.prove()}
            />
          ) : null}
          {stage === "confirm" || stage === "applying" ? (
            <Button size="lg" loading={stage === "applying"} onClick={() => void props.apply()}>
              {intl.formatMessage({
                id: "public.reporting.recovery.move",
                defaultMessage: "Move my account",
              })}
            </Button>
          ) : null}
        </>
      }
    >
      {stage === "code" ? (
        <form
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
            label={intl.formatMessage({
              id: "public.reporting.recovery.code.label",
              defaultMessage: "6-digit code",
            })}
            error={
              props.error === "wrong_code" ? intl.formatMessage(FAILURE_COPY.wrong_code) : undefined
            }
          >
            <TextInput
              id={codeId}
              name="recoveryCode"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              enterKeyHint="done"
              required
              invalid={props.error === "wrong_code"}
              className="text-base font-mono tracking-[0.3em]"
            />
          </FormField>
          <Button size="lg" type="submit" loading={checking} disabled={code.length !== 6}>
            {intl.formatMessage({
              id: "public.reporting.recovery.code.submit",
              defaultMessage: "Confirm code",
            })}
          </Button>
        </form>
      ) : null}
    </CeremonyFrame>
  );
}
