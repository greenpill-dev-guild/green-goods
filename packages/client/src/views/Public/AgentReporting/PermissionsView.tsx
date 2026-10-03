import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiLoader4Line, RiShieldKeyholeLine, RiTimeLine } from "@remixicon/react";
import { useId, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";
import {
  AccountLine,
  ActContext,
  CeremonyFrame,
  ConnectActions,
  PairedActs,
} from "./CeremonyFrame";
import { PERMISSION_FAILURE_COPY as ERRORS } from "./messages";
import { PermissionList } from "./PermissionList";

/** Failures of the saved-record import, shown on its own field rather than beside the page's acts. */
const IMPORT_ERRORS = new Set(["invalid_descriptor", "wrong_account"]);
const ICON = "h-5 w-5 flex-shrink-0";

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

/**
 * Command surface, solid material: inspect and remove permissions directly with the owner. The page
 * is drawn as the ceremonies are, its acts in the fixed bar, where a check or removal stands in the
 * notice under its heading, and what a check found as a list of permissions with their status.
 */
export function PermissionsView(props: PermissionsViewProps) {
  const intl = useIntl();
  const importId = useId();
  const exportId = useId();
  const [record, setRecord] = useState("");
  const [exported, setExported] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmationAccount, setConfirmationAccount] = useState(props.account);
  const text = (message: MessageDescriptor) => intl.formatMessage(message);
  const busy = props.stage === "inspecting" || props.stage === "revoking";
  const active = props.permissions.filter((permission) => permission.active);
  const canRevoke = props.stage === "ready" && active.length > 0;
  const importError = props.error && IMPORT_ERRORS.has(props.error) ? props.error : null;
  const removeLabel = text({
    id: "public.reporting.permissions.remove",
    defaultMessage: "Remove Account Permissions",
  });

  const waiting = <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />;
  const notice =
    props.stage === "inspecting" ? (
      <Alert variant="info" icon={waiting}>
        {text({
          id: "public.reporting.permissions.checking",
          defaultMessage: "Checking installed permissions…",
        })}
      </Alert>
    ) : props.stage === "revoking" ? (
      <Alert variant="info" icon={waiting}>
        {text({
          id: "public.reporting.permissions.signing",
          defaultMessage: "Confirm removal in your wallet or passkey prompt.",
        })}
      </Alert>
    ) : props.stage === "submitted" ? (
      // Nothing checks on its own here: the bar's Check Permissions confirms the removal.
      <Alert variant="info" icon={<RiTimeLine className={ICON} aria-hidden="true" />}>
        {text({
          id: "public.reporting.permissions.waiting",
          defaultMessage: "Removal sent. Waiting for the network to confirm.",
        })}
      </Alert>
    ) : props.stage === "revoked" ? (
      <Alert variant="success">
        {text({
          id: "public.reporting.permissions.removed",
          defaultMessage:
            "Account permissions removed. Your owner wallet or passkey can still sign reports.",
        })}
      </Alert>
    ) : null;

  return (
    <CeremonyFrame
      channel={null}
      heading={{
        title: {
          id: "public.reporting.permissions.title",
          defaultMessage: "Reporting Permissions",
        },
        info: text({
          id: "public.reporting.permissions.body",
          defaultMessage:
            "Check your account's permissions and remove them directly with your wallet or passkey. This page works even when the chat assistant is unavailable.",
        }),
        Icon: RiShieldKeyholeLine,
      }}
      notice={notice}
      error={
        props.error && !importError
          ? {
              message: ERRORS[props.error],
              tone: props.error === "outcome_unknown" ? "caution" : "error",
            }
          : null
      }
      barNotes={
        props.account ? (
          <ActContext account={<AccountLine account={props.account} relation="connected" />} />
        ) : null
      }
      actions={
        !props.account ? (
          <ConnectActions
            connecting={props.connecting}
            onConnectWallet={props.connectWallet}
            onConnectPasskey={() => void props.connectPasskey()}
          />
        ) : (
          <PairedActs>
            <Button
              size="lg"
              loading={props.stage === "inspecting"}
              disabled={props.stage === "revoking"}
              onClick={() => void props.scan()}
            >
              {text({
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
          </PairedActs>
        )
      }
    >
      {props.permissions.length > 0 ? (
        <PermissionList permissions={props.permissions} />
      ) : props.stage === "ready" ? (
        <EmptyState
          titleAs="h2"
          placement="list"
          icon={<RiShieldKeyholeLine />}
          title={text({
            id: "public.reporting.permissions.emptyTitle",
            defaultMessage: "No permissions found",
          })}
          description={text({
            id: "public.reporting.permissions.emptyBody",
            defaultMessage: "Import a saved record to check an older permission.",
          })}
        />
      ) : null}

      {props.account ? (
        <div className="flex min-w-0 flex-col gap-3">
          <form
            method="post"
            className="flex min-w-0 flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              props.importDescriptor(record);
            }}
          >
            <FormField
              htmlFor={importId}
              label={text({
                id: "public.reporting.permissions.importLabel",
                defaultMessage: "Saved permission record",
              })}
              hint={text({
                id: "public.reporting.permissions.importHint",
                defaultMessage:
                  "Paste an exported record to check it. Importing a record doesn't grant any permission.",
              })}
              error={importError ? text(ERRORS[importError]) : undefined}
            >
              <Textarea
                id={importId}
                name="permissionRecord"
                value={record}
                onChange={(event) => setRecord(event.target.value)}
                rows={4}
                maxLength={65536}
                required
                invalid={importError !== null}
                aria-invalid={importError !== null || undefined}
                aria-describedby={`${importId}-helper-text`}
                className="text-base [overflow-wrap:anywhere]"
              />
            </FormField>
            {/* A section's own act, sized below the page's acts in the bar. */}
            <Button
              type="submit"
              size="md"
              emphasis="secondary"
              className="self-start"
              disabled={busy || props.stage === "submitted"}
            >
              {text({ id: "public.reporting.permissions.import", defaultMessage: "Import Record" })}
            </Button>
          </form>
          {props.descriptors.length > 0 ? (
            <div className="flex min-w-0 flex-col gap-3">
              <Button
                size="md"
                emphasis="tertiary"
                onClick={() => setExported(props.exportDescriptors())}
                className="self-start"
              >
                {text({
                  id: "public.reporting.permissions.export",
                  defaultMessage: "Show Saved Records",
                })}
              </Button>
              {exported ? (
                <FormField
                  htmlFor={exportId}
                  label={text({
                    id: "public.reporting.permissions.exportLabel",
                    defaultMessage: "Copy and save this record",
                  })}
                  hint={text({
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
                    aria-describedby={`${exportId}-helper-text`}
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
            label: text({ id: "public.reporting.permissions.cancel", defaultMessage: "Cancel" }),
            onClick: () => setConfirmOpen(false),
          },
        }}
      >
        <Alert variant="warning">
          {text({
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
