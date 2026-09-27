import { CeremonyFrame } from "./CeremonyFrame";

/**
 * Static and honest: delegated publication is disabled until its live gates pass, so this page
 * grants, changes and reads nothing. It makes no API calls and needs no wallet.
 */
export default function ReportingPermissionsPage() {
  return (
    <CeremonyFrame
      channel={null}
      title={{ id: "public.reporting.permissions.title", defaultMessage: "Reporting permissions" }}
      body={{
        id: "public.reporting.permissions.body",
        defaultMessage:
          "Letting the assistant publish for you isn't available yet. Each report is published only after you confirm it in chat and sign it yourself. This page doesn't grant, change or remove any permission.",
      }}
    />
  );
}
