import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { useId, useState } from "react";
import { useIntl } from "react-intl";
import { CeremonyFrame } from "./CeremonyFrame";
import { PERMISSION_FAILURE_COPY as ERRORS } from "./messages";

type PermissionsViewProps = Pick<
  ReturnType<typeof useAgentReportingPermissions>,
  | "account"
  | "connecting"
  | "connectWallet"
  | "connectPasskey"
  | "stage"
  | "permissions"
  | "descriptors"
  | "error"
  | "scan"
  | "importDescriptor"
  | "exportDescriptors"
  | "revoke"
>;

/** Command surface, solid material: inspect and remove permissions directly with the owner. */
export function PermissionsView(props: PermissionsViewProps) {
  const intl = useIntl();
  const importId = useId();
  const exportId = useId();
  const [record, setRecord] = useState("");
  const [exported, setExported] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationAccount, setConfirmationAccount] = useState(props.account);
  const busy = props.stage === "inspecting" || props.stage === "revoking";
  const active = props.permissions.filter((permission) => permission.active);
  const canRevoke = props.stage === "ready" && active.length > 0;
  const removeLabel = intl.formatMessage({
    id: "public.reporting.permissions.remove",
    defaultMessage: "Remove Account Permissions",
  });

  return (
    <CeremonyFrame
      channel={null}
      title={{ id: "public.reporting.permissions.title", defaultMessage: "Reporting permissions" }}
      body={{
        id: "public.reporting.permissions.body",
        defaultMessage:
          "Check your account's permissions and remove them directly with your wallet or passkey. This page works even when the chat assistant is unavailable.",
      }}
      error={
        props.error
          ? { message: ERRORS[props.error], caution: props.error === "outcome_unknown" }
          : null
      }
      actions={
        !props.account ? (
          <>
            <Button size="lg" loading={props.connecting} onClick={props.connectWallet}>
              {intl.formatMessage({
                id: "public.reporting.connect.wallet",
                defaultMessage: "Connect wallet",
              })}
            </Button>
            <Button
              size="lg"
              emphasis="secondary"
              disabled={props.connecting}
              onClick={() => void props.connectPasskey()}
            >
              {intl.formatMessage({
                id: "public.reporting.connect.passkey",
                defaultMessage: "Use my passkey",
              })}
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              loading={props.stage === "inspecting"}
              disabled={props.stage === "revoking"}
              onClick={() => void props.scan()}
            >
              {intl.formatMessage({
                id: "public.reporting.permissions.check",
                defaultMessage: "Check Permissions",
              })}
            </Button>
            {canRevoke ? (
              <Button
                size="lg"
                emphasis="secondary"
                tone="danger"
                onClick={() => {
                  setConfirmationAccount(props.account);
                  setConfirmOpen(true);
                }}
              >
                {removeLabel}
              </Button>
            ) : null}
          </>
        )
      }
    >
      {props.account ? (
        <p className="break-words text-sm text-text-sub-600" title={props.account}>
          {intl.formatMessage(
            { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" },
            { account: formatAddress(props.account) }
          )}
        </p>
      ) : null}

      {busy || props.stage === "submitted" || props.stage === "revoked" ? (
        <p
          role="status"
          className="rounded-xl bg-bg-weak-50 p-4 text-sm leading-6 text-text-strong-950"
        >
          {props.stage === "inspecting"
            ? intl.formatMessage({
                id: "public.reporting.permissions.checking",
                defaultMessage: "Checking installed permissions…",
              })
            : props.stage === "revoking"
              ? intl.formatMessage({
                  id: "public.reporting.permissions.signing",
                  defaultMessage: "Confirm removal in your wallet or passkey prompt.",
                })
              : props.stage === "submitted"
                ? intl.formatMessage({
                    id: "public.reporting.permissions.waiting",
                    defaultMessage: "Removal sent. Waiting for the network to confirm.",
                  })
                : intl.formatMessage({
                    id: "public.reporting.permissions.removed",
                    defaultMessage:
                      "Account permissions removed. Your owner wallet or passkey can still sign reports.",
                  })}
        </p>
      ) : null}

      {props.stage === "ready" && props.permissions.length === 0 ? (
        <p className="rounded-xl bg-bg-weak-50 p-4 text-sm leading-6 text-text-sub-600">
          {intl.formatMessage({
            id: "public.reporting.permissions.empty",
            defaultMessage:
              "No permissions were found in this scan. Import a saved record to check an older permission.",
          })}
        </p>
      ) : null}

      {props.permissions.length > 0 ? (
        <ul className="min-w-0 divide-y divide-stroke-soft-200 rounded-2xl border border-stroke-soft-200 bg-bg-weak-50">
          {props.permissions.map((permission) => (
            <li key={permission.permissionId} className="min-w-0 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="text-sm font-semibold text-text-strong-950">
                  {intl.formatMessage(
                    permission.descriptor
                      ? {
                          id: "public.reporting.permissions.reporting",
                          defaultMessage: "Reporting permission",
                        }
                      : {
                          id: "public.reporting.permissions.other",
                          defaultMessage: "Account permission",
                        }
                  )}
                </p>
                <p className="text-sm text-text-sub-600">
                  {intl.formatMessage(
                    permission.active
                      ? { id: "public.reporting.permissions.active", defaultMessage: "Active" }
                      : { id: "public.reporting.permissions.inactive", defaultMessage: "Inactive" }
                  )}
                </p>
              </div>
              <p className="mt-2 break-all font-mono text-xs leading-5 text-text-sub-600">
                {permission.permissionId}
              </p>
            </li>
          ))}
        </ul>
      ) : null}

      {props.account ? (
        <div className="min-w-0">
          <form
            method="post"
            onSubmit={(event) => {
              event.preventDefault();
              props.importDescriptor(record);
            }}
          >
            <FormField
              htmlFor={importId}
              label={intl.formatMessage({
                id: "public.reporting.permissions.importLabel",
                defaultMessage: "Saved permission record",
              })}
              hint={intl.formatMessage({
                id: "public.reporting.permissions.importHint",
                defaultMessage:
                  "Paste an exported record to check it. Importing a record doesn't grant any permission.",
              })}
              error={
                props.error === "invalid_descriptor"
                  ? intl.formatMessage(ERRORS.invalid_descriptor)
                  : undefined
              }
            >
              <Textarea
                id={importId}
                name="permissionRecord"
                value={record}
                onChange={(event) => setRecord(event.target.value)}
                rows={4}
                maxLength={65536}
                required
                invalid={props.error === "invalid_descriptor"}
                className="text-base [overflow-wrap:anywhere]"
              />
            </FormField>
            <Button
              type="submit"
              size="lg"
              emphasis="secondary"
              disabled={busy || props.stage === "submitted"}
              className="w-full sm:w-auto"
            >
              {intl.formatMessage({
                id: "public.reporting.permissions.import",
                defaultMessage: "Import Record",
              })}
            </Button>
          </form>
          {props.descriptors.length > 0 ? (
            <div className="mt-4 flex min-w-0 flex-col gap-3">
              <Button
                size="lg"
                emphasis="tertiary"
                onClick={() => setExported(props.exportDescriptors())}
                className="w-full sm:w-fit"
              >
                {intl.formatMessage({
                  id: "public.reporting.permissions.export",
                  defaultMessage: "Show Saved Records",
                })}
              </Button>
              {exported ? (
                <FormField
                  htmlFor={exportId}
                  label={intl.formatMessage({
                    id: "public.reporting.permissions.exportLabel",
                    defaultMessage: "Copy and save this record",
                  })}
                  hint={intl.formatMessage({
                    id: "public.reporting.permissions.exportHint",
                    defaultMessage:
                      "Keep this record to check permissions later. It contains public permission details, never a signing key.",
                  })}
                >
                  <Textarea
                    id={exportId}
                    value={exported}
                    readOnly
                    rows={5}
                    onFocus={(event) => event.target.select()}
                    className="text-base [overflow-wrap:anywhere]"
                  />
                </FormField>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <DialogShell
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={removeLabel}
        actions={{
          primary: {
            label: removeLabel,
            tone: "danger",
            disabled: !canRevoke || confirmationAccount !== props.account,
            onClick: () => {
              if (!canRevoke || confirmationAccount !== props.account) return;
              setConfirmOpen(false);
              void props.revoke();
            },
          },
          secondary: {
            label: intl.formatMessage({
              id: "public.reporting.permissions.cancel",
              defaultMessage: "Cancel",
            }),
            onClick: () => setConfirmOpen(false),
          },
        }}
      >
        <Alert variant="warning">
          {intl.formatMessage({
            id: "public.reporting.permissions.removeWarning",
            defaultMessage:
              "This removes permissions installed before this request is prepared, including permissions for other apps. Your owner wallet or passkey remains. Permissions installed later may still be active.",
          })}
        </Alert>
        <p
          className="mt-4 break-words text-sm text-text-sub-600"
          title={confirmationAccount ?? undefined}
        >
          {intl.formatMessage(
            { id: "public.reporting.connect.as", defaultMessage: "Connected as {account}" },
            { account: formatAddress(confirmationAccount) }
          )}
        </p>
      </DialogShell>
    </CeremonyFrame>
  );
}
