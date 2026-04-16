import { Alert, Button, formatRelativeTime, Surface } from "@green-goods/shared";
import { RiExternalLinkLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { HUB_CERTIFY_STATUS_CLASSNAME, HUB_META_PILL_CLASSNAME } from "../hub.utils";

export function HubCertificationInspector({
  assessment,
  canMint,
  onOpenMintFlow,
}: {
  assessment: {
    id: string;
    title?: string | null;
    description?: string | null;
    assessmentType?: string | null;
    createdAt: number;
  };
  canMint: boolean;
  onOpenMintFlow: () => void;
}) {
  const { formatMessage } = useIntl();

  return (
    <div className="flex flex-col gap-4 p-1.5">
      <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={HUB_CERTIFY_STATUS_CLASSNAME}>
            {canMint
              ? formatMessage({
                  id: "cockpit.hub.certify.readyLabel",
                  defaultMessage: "Ready to certify",
                })
              : formatMessage({
                  id: "cockpit.hub.certify.readOnlyLabel",
                  defaultMessage: "Read-only handoff",
                })}
          </span>
          <span className="text-xs text-text-soft">{formatRelativeTime(assessment.createdAt)}</span>
        </div>

        <div>
          <h3 className="text-lg font-semibold text-text-strong">
            {assessment.title ||
              formatMessage({
                id: "app.garden.admin.assessmentFallback",
                defaultMessage: "Assessment",
              })}
          </h3>
          <p className="mt-1 text-sm text-text-sub">
            {assessment.description ||
              formatMessage({
                id: "cockpit.hub.certify.fallbackDescription",
                defaultMessage:
                  "Review the assessment package and hand it off for hypercert minting.",
              })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {assessment.assessmentType ? (
            <span className={HUB_META_PILL_CLASSNAME}>{assessment.assessmentType}</span>
          ) : null}
          <span className={HUB_META_PILL_CLASSNAME}>
            {formatMessage({ id: "cockpit.hub.tab.certify", defaultMessage: "Certify" })}
          </span>
        </div>
      </Surface>

      {canMint ? (
        <Surface elevation="ground" padding="compact" className="flex flex-col gap-3">
          <p className="text-sm text-text-sub">
            {formatMessage({
              id: "cockpit.hub.certify.operatorDescription",
              defaultMessage:
                "This bundle is ready for the minting flow. Open the hypercert form when you are ready to finalize it.",
            })}
          </p>
          <Button onClick={onOpenMintFlow}>
            <RiExternalLinkLine className="h-4 w-4" />
            {formatMessage({
              id: "cockpit.hub.certify.openMintFlow",
              defaultMessage: "Open mint flow",
            })}
          </Button>
        </Surface>
      ) : (
        <Alert variant="info">
          {formatMessage({
            id: "cockpit.hub.certify.readOnlyDescription",
            defaultMessage:
              "You can review the certification handoff here, but only garden owners or operators can mint the hypercert.",
          })}
        </Alert>
      )}
    </div>
  );
}
