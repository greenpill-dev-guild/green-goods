// TODO: Scap component not needed and take any useful parts and implement elsewhere
import {
  type RemixiconComponentType,
  RiCheckFill,
  RiErrorWarningFill,
  RiNotification3Line,
  RiTelegram2Fill,
  RiWifiOffLine,
} from "@remixicon/react";
import React, { useEffect } from "react";
import { useIntl } from "react-intl";
import { type ModalVariantRoot, UploadModal } from "@/components/UI/UploadModal/UploadModal";
import { useOffline } from "@/hooks/useOffline";
import { track } from "@/modules/posthog";

export type completedMessage = {
  header: string;
  title: string;
  body: string;
  variant: ModalVariantRoot["variant"];
  icon: RemixiconComponentType;
  spinner: boolean;
};

export type completedStatus = "error" | "success" | "pending" | "idle";

interface WorkCompletedProps {
  garden: Garden;
  status: "error" | "success" | "pending" | "idle";
  messages?: { [key: string]: completedMessage };
  mutationData?: any; // The mutation result data (transaction hash or error)
}

export const WorkCompleted: React.FC<WorkCompletedProps> = ({
  garden,
  status,
  messages,
  mutationData,
}) => {
  const intl = useIntl();
  const { isOnline } = useOffline();

  // Detect if work was saved offline by checking if the transaction hash starts with "0xoffline_"
  const isOfflineWork = (data: any): boolean => {
    if (!data) return false;
    if (typeof data === "string") {
      return data.startsWith("0xoffline_");
    }
    // For transaction receipts, check the transactionHash
    if (data.transactionHash && typeof data.transactionHash === "string") {
      return data.transactionHash.startsWith("0xoffline_");
    }
    return false;
  };

  const isOffline = isOfflineWork(mutationData) || !isOnline;

  useEffect(() => {
    // Track work submission completion
    track("work_submission_completed", {
      garden_id: garden.id,
      status,
      is_online: isOnline,
      is_offline_submission: isOffline,
    });
  }, [status, garden.id, isOnline, isOffline]);

  // For better UX, show success immediately when work is queued
  const displayStatus = status === "pending" || status === "idle" ? "success" : status;

  const getMessages = (garden: Garden) => ({
    error: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.error.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.error.title",
        defaultMessage: "Unable to Save Work",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.error.body",
        defaultMessage: "We couldn't save your work. Please check your connection and try again.",
      }),
      variant: "error",
      icon: RiErrorWarningFill,
      spinner: false,
    },
    success: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.success.header",
        defaultMessage: "Work Saved Successfully!",
      }),
      title: intl.formatMessage({
        id: isOffline
          ? "app.garden.completed.messages.success.offline.title"
          : "app.garden.completed.messages.success.title",
        defaultMessage: "Work Saved!",
      }),
      body: intl.formatMessage(
        {
          id: isOffline
            ? "app.garden.completed.messages.success.offline.body"
            : "app.garden.completed.messages.success.body",
          defaultMessage: isOffline
            ? "Your work has been securely saved on your device!<br/><br/>It will automatically upload to the blockchain when you reconnect to the internet. Once uploaded, {operator} will be notified to review your submission."
            : "Your work is being uploaded to the blockchain!<br/><br/>{operator} will be notified once the upload completes and will review your submission. You'll receive a notification when it's approved.",
        },
        {
          operator: garden.operators[0]?.substring(0, 12) || "The operator",
        }
      ),
      variant: "success",
      icon: isOffline ? RiNotification3Line : RiCheckFill,
      spinner: false,
    },
    pending: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.pending.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.pending.title",
        defaultMessage: "Saving Work...",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.pending.body",
        defaultMessage: "Please wait while we save your work...",
      }),
      variant: "pending",
      icon: RiTelegram2Fill,
      spinner: true,
    },
    idle: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.idle.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.idle.title",
        defaultMessage: "Processing...",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.idle.body",
        defaultMessage: "Your work is being processed...",
      }),
      variant: "pending",
      icon: RiTelegram2Fill,
      spinner: true,
    },
    ...messages,
  });

  const state = getMessages(garden)[displayStatus as keyof ReturnType<typeof getMessages>];

  return (
    <>
      <UploadModal
        variant={state.variant as ModalVariantRoot["variant"]}
        headerText={state.header}
        titleText={state.title}
        bodyText={state.body}
        icon={state.icon}
        spinner={state.spinner}
      />
      {!isOnline && displayStatus === "success" && (
        <div className="mt-4 mx-4 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
          <RiWifiOffLine className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-orange-800">
            You&apos;re currently offline. Your work is safely stored on your device and will upload
            automatically when you reconnect.
          </p>
        </div>
      )}
    </>
  );
};
