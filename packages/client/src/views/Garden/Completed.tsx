import {
  type RemixiconComponentType,
  RiCheckFill,
  RiErrorWarningFill,
  RiTelegram2Fill,
  RiWifiOffLine,
} from "@remixicon/react";
import type React from "react";
import { useIntl } from "react-intl";
import { type ModalVariantRoot, UploadModal } from "@/components/UI/UploadModal/UploadModal";

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

  const isOffline = isOfflineWork(mutationData);

  const getMessages = (garden: Garden) => ({
    error: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.error.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.error.title",
        defaultMessage: "Error",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.error.body",
        defaultMessage: "Something went wrong, please try again later",
      }),
      variant: "error",
      icon: RiErrorWarningFill,
      spinner: false,
    },
    success: {
      header: intl.formatMessage({
        id: isOffline
          ? "app.garden.completed.messages.success.offline.header"
          : "app.garden.completed.messages.success.header",
        defaultMessage: isOffline ? "Your work has been saved offline!" : " ",
      }),
      title: intl.formatMessage({
        id: isOffline
          ? "app.garden.completed.messages.success.offline.title"
          : "app.garden.completed.messages.success.title",
        defaultMessage: isOffline ? "Saved Offline!" : "Published!",
      }),
      body: intl.formatMessage(
        {
          id: isOffline
            ? "app.garden.completed.messages.success.offline.body"
            : "app.garden.completed.messages.success.body",
          defaultMessage: isOffline
            ? "Your work has been saved offline!<br/><br/>It will be submitted automatically when you reconnect to the internet. {operator} will review it once submitted."
            : "Your work has been submitted!<br/><br/>{operator}, your Garden Operator will review your submission and you'll be notified once it's approved or rejected.",
        },
        {
          operator: garden.operators[0].substring(0, 12),
        }
      ),
      variant: "success",
      icon: isOffline ? RiWifiOffLine : RiCheckFill,
      spinner: false,
    },
    pending: {
      header: intl.formatMessage({
        id:
          isOffline || !navigator.onLine
            ? "app.garden.completed.messages.pending.offline.header"
            : "app.garden.completed.messages.pending.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id:
          isOffline || !navigator.onLine
            ? "app.garden.completed.messages.pending.offline.title"
            : "app.garden.completed.messages.pending.title",
        defaultMessage: isOffline || !navigator.onLine ? "Saving Offline..." : "Publishing...",
      }),
      body: intl.formatMessage({
        id:
          isOffline || !navigator.onLine
            ? "app.garden.completed.messages.pending.offline.body"
            : "app.garden.completed.messages.pending.body",
        defaultMessage:
          isOffline || !navigator.onLine
            ? "Your work is being saved offline..."
            : "Your work is being submitted...",
      }),
      variant: "pending",
      icon: isOffline || !navigator.onLine ? RiWifiOffLine : RiTelegram2Fill,
      spinner: true,
    },
    idle: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.idle.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.idle.title",
        defaultMessage: "Pending",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.idle.body",
        defaultMessage: "We also have no idea what's going on...",
      }),
      variant: "pending",
      icon: RiTelegram2Fill,
      spinner: true,
    },
    ...messages,
  });

  // const state = getMessages(garden)[status as completedStatus];
  const state = getMessages(garden)[status];
  return (
    <UploadModal
      variant={state.variant as ModalVariantRoot["variant"]}
      headerText={state.header}
      titleText={state.title}
      bodyText={state.body}
      icon={state.icon}
      spinner={state.spinner}
    />
  );
};
