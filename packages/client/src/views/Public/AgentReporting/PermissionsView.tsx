import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { DialogShell } from "@green-goods/shared/components/Dialog/DialogShell";
import { Textarea } from "@green-goods/shared/components/Form/ControlPrimitives";
import { FormField } from "@green-goods/shared/components/Form/FormFieldWrapper";
import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import { formatAddress } from "@green-goods/shared/utils/app/text";
import { RiShieldKeyholeLine } from "@remixicon/react";
import { useId, useState } from "react";
import { type MessageDescriptor, useIntl } from "react-intl";
import { EmptyState } from "@/components/Communication";
import { ConnectActions, PageAccount } from "./CeremonyActs";
import { CeremonyFrame } from "./CeremonyFrame";
import { PERMISSION_FAILURE_COPY as ERRORS } from "./failures";
import { PermissionList } from "./PermissionList";
import { PermissionStatus } from "./PermissionStatus";

/** Failures of the saved-record import, shown on its own field rather than in the page's status. */
const IMPORT_ERRORS = new Set(["invalid_descriptor", "wrong_account"]);

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
 * is drawn as the ceremonies are: a heading card, a status card that is there from the start and
 * says where a check or removal stands, what a check found as a list of permissions with their
 * status, and the page's one standing act in the fixed bar. Removing sits under the list it acts
 * on, and the connected account is in the top bar's sheet.
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

  return (
    <CeremonyFrame
      heading={{
        title: {
          id: "public.reporting.permissions.title",
          defaultMessage: "Reporting Permissions",
        },
        info: text({
          id: "public.reporting.permissions.body",
          defaultMessage: "Check and remove your account's permissions here.",
        }),
        Icon: RiShieldKeyholeLine,
      }}
      notice={
        <PermissionStatus
          stage={props.stage}
          connected={props.account !== null}
          active={active.length}
          failure={props.error && !importError ? props.error : null}
        />
      }
      actions={
        !props.account ? (
          <ConnectActions
            connecting={props.connecting}
            onConnectWallet={props.connectWallet}
            onConnectPasskey={() => void props.connectPasskey()}
          />
        ) : (
          <Button
            size="lg"
            className="w-full whitespace-normal [text-wrap:balance]"
            loading={props.stage === "inspecting"}
            disabled={props.stage === "revoking"}
            onClick={() => void props.scan()}
          >
            {text({
              id: "public.reporting.permissions.check",
              defaultMessage: "Check Permissions",
            })}
          </Button>
        )
      }
    >
      <PageAccount
        account={props.account}
        signedIn={false}
        signsIn={false}
        permissionsLink={false}
      />
      {props.permissions.length > 0 ? (
        <PermissionList
          permissions={props.permissions}
          action={
            canRevoke ? (
              <Button
                size="md"
                emphasis="secondary"
                tone="danger"
                className="whitespace-normal"
                onClick={() => {
                  setConfirmationAccount(props.account);
                  setConfirmOpen(true);
                }}
              >
                {removeLabel}
              </Button>
            ) : null
          }
        />
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
              error={importError ? text(ERRORS[importError].message) : undefined}
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
            {/* A section's own act, sized below the page's act in the bar. */}
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
