import type { useAgentReportingPermissions } from "@green-goods/shared/hooks/agent-reporting/useAgentReportingPermissions";
import { RiCheckLine, RiLoader4Line, RiTimeLine } from "@remixicon/react";
import type { ReactNode } from "react";
import type { MessageDescriptor } from "react-intl";
import { StageNotice } from "./CeremonyFrame";
import { PERMISSION_FAILURE_COPY } from "./failures";

type Permissions = ReturnType<typeof useAgentReportingPermissions>;

const ICON = "h-5 w-5 flex-shrink-0";
const WAITING = <RiLoader4Line className={`${ICON} animate-spin`} aria-hidden="true" />;
const NOT_YET = <RiTimeLine className={ICON} aria-hidden="true" />;

/** Failures that ask for another look or another try, not a correction. */
const CAUTIONS = new Set<NonNullable<Permissions["error"]>>([
  "outcome_unknown",
  "declined",
  "remaining_permissions",
]);

interface Standing {
  variant: "info" | "success";
  icon?: ReactNode;
  title: MessageDescriptor;
  body: MessageDescriptor;
}

const STANDING: Record<Permissions["stage"], Standing> = {
  idle: {
    variant: "info",
    icon: NOT_YET,
    title: { id: "public.reporting.permissions.status.idle", defaultMessage: "Not checked yet" },
    body: {
      id: "public.reporting.permissions.status.idleBody",
      defaultMessage: "Check Permissions looks at what is installed on this account.",
    },
  },
  inspecting: {
    variant: "info",
    icon: WAITING,
    title: {
      id: "public.reporting.permissions.status.checking",
      defaultMessage: "Checking permissions",
    },
    body: {
      id: "public.reporting.permissions.status.checkingBody",
      defaultMessage: "Looking for permissions installed on this account.",
    },
  },
  ready: {
    variant: "info",
    icon: <RiCheckLine className={ICON} aria-hidden="true" />,
    title: { id: "public.reporting.permissions.status.ready", defaultMessage: "Checked" },
    body: {
      id: "public.reporting.permissions.status.readyBody",
      defaultMessage:
        "{active, plural, =0 {No permission is active on this account.} one {# permission is active. You can remove it below.} other {# permissions are active. You can remove them below.}}",
    },
  },
  revoking: {
    variant: "info",
    icon: WAITING,
    title: { id: "public.reporting.status.approving", defaultMessage: "Waiting for your approval" },
    body: {
      id: "public.reporting.permissions.signing",
      defaultMessage: "Confirm removal in your wallet or passkey prompt.",
    },
  },
  submitted: {
    variant: "info",
    icon: NOT_YET,
    title: { id: "public.reporting.permissions.status.sent", defaultMessage: "Removal sent" },
    body: {
      id: "public.reporting.permissions.waiting",
      defaultMessage: "Waiting for the network. Check again to confirm it.",
    },
  },
  revoked: {
    variant: "success",
    title: {
      id: "public.reporting.permissions.status.removed",
      defaultMessage: "Permissions removed",
    },
    body: {
      id: "public.reporting.permissions.removed",
      defaultMessage: "Your owner wallet or passkey can still sign reports.",
    },
  },
  failed: {
    variant: "info",
    icon: NOT_YET,
    title: { id: "public.reporting.permissions.status.idle", defaultMessage: "Not checked yet" },
    body: {
      id: "public.reporting.permissions.status.idleBody",
      defaultMessage: "Check Permissions looks at what is installed on this account.",
    },
  },
};

/**
 * Where a check or a removal stands, in the card the ceremonies use for a request's status. The
 * page has it from the start, before an account is connected, so nothing under it moves when a
 * check begins, finds something, or fails. A failure takes the card over, title and two lines.
 */
export function PermissionStatus({
  stage,
  connected,
  active,
  failure,
}: {
  stage: Permissions["stage"];
  connected: boolean;
  /** How many of the permissions found are still active. */
  active: number;
  /** What went wrong, other than a saved record its own field rejects. */
  failure: NonNullable<Permissions["error"]> | null;
}) {
  if (failure) {
    const copy = PERMISSION_FAILURE_COPY[failure];
    return (
      <StageNotice
        variant={CAUTIONS.has(failure) ? "warning" : "error"}
        title={copy.title}
        body={copy.message}
      />
    );
  }
  if (!connected) {
    return (
      <StageNotice
        variant="info"
        icon={NOT_YET}
        title={STANDING.idle.title}
        body={{
          id: "public.reporting.permissions.status.connect",
          defaultMessage: "Connect your wallet or passkey to check its permissions.",
        }}
      />
    );
  }
  return <StageNotice {...STANDING[stage]} values={{ active }} />;
}
