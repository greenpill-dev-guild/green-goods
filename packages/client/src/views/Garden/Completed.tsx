import type React from "react";
import {
  RiCheckFill,
  RiErrorWarningFill,
  RiTelegram2Fill,
  type RemixiconComponentType,
} from "@remixicon/react";

import { UploadModal, type ModalVariantRoot } from "@/components/UI/UploadModal/UploadModal";
import { useIntl } from "react-intl";

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
}

export const WorkCompleted: React.FC<WorkCompletedProps> = ({ garden, status, messages }) => {
  const intl = useIntl();
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
        id: "app.garden.completed.messages.success.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.success.title",
        defaultMessage: "Published!",
      }),
      body: intl.formatMessage(
        {
          id: "app.garden.completed.messages.success.body",
          defaultMessage:
            "Your work has been submitted!<br/><br/>{operator}, your Garden Operator will review your submission and you’ll be notified once it's approved or rejected.",
        },
        {
          operator: garden.operators[0].substring(0, 12),
        }
      ),
      variant: "success",
      icon: RiCheckFill,
      spinner: false,
    },
    pending: {
      header: intl.formatMessage({
        id: "app.garden.completed.messages.pending.header",
        defaultMessage: " ",
      }),
      title: intl.formatMessage({
        id: "app.garden.completed.messages.pending.title",
        defaultMessage: "Publishing...",
      }),
      body: intl.formatMessage({
        id: "app.garden.completed.messages.pending.body",
        defaultMessage: "Your work is being submitted...",
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
