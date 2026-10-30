import { useIntl } from "react-intl";
import { EditorialPrimaryButton } from "@/components/Public/atoms";
import { PublicStatement } from "@/components/Public/PublicStatement";
import type { RecoveryScreenProps } from "./ErrorRecovery";

/**
 * A reporting ceremony page that failed, under its focused bar and in the website's voice
 * (DL-121): the words a failed screen says, as the website's sentence, and Reload as the
 * website's button. Offline is a wait, not a fault, so it is not announced as an alert.
 */
export function CeremonyPageError({ offline, onReload }: RecoveryScreenProps) {
  const { formatMessage } = useIntl();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pt-8 pb-6 sm:px-6">
      <PublicStatement
        titleAs="h1"
        role={offline ? undefined : "alert"}
        title={
          offline
            ? formatMessage({
                id: "app.screenError.offline.title",
                defaultMessage: "You're offline",
              })
            : formatMessage({
                id: "app.screenError.title",
                defaultMessage: "This screen didn't load",
              })
        }
        description={
          offline
            ? formatMessage({
                id: "app.screenError.offline.description",
                defaultMessage: "Nothing was lost. This screen loads when you are back online.",
              })
            : formatMessage({
                id: "app.screenError.description",
                defaultMessage: "Nothing was lost. Reload to carry on.",
              })
        }
        action={
          <EditorialPrimaryButton onClick={onReload}>
            {formatMessage({ id: "app.screenError.reload", defaultMessage: "Reload" })}
          </EditorialPrimaryButton>
        }
      />
    </div>
  );
}
