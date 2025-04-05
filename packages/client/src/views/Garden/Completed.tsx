import type React from "react";
import {
  RiCheckFill,
  RiErrorWarningFill,
  RiTelegram2Fill,
  type RemixiconComponentType,
} from "@remixicon/react";

import {
  UploadModal,
  type ModalVariantRoot,
} from "@/components/UI/UploadModal/UploadModal";

export type completedMessage = {
  header?: string;
  variant: ModalVariantRoot["variant"];
  title: string;
  body: string;
  icon: RemixiconComponentType;
  spinner: boolean;
};

export type completedStatus = "error" | "success" | "pending" | "idle";

interface WorkCompletedProps {
  garden: Garden;
  status: "error" | "success" | "pending" | "idle";
  messages?: { [key: string]: completedMessage };
}

export const WorkCompleted: React.FC<WorkCompletedProps> = ({
  garden,
  status,
  messages,
}) => {
  const getMessages = (garden: Garden) => ({
    error: {
      header: "",
      variant: "error",
      title: "Error",
      body: "Something went wrong, please try again later",
      icon: RiErrorWarningFill,
      spinner: false,
    },
    success: {
      header: "Your work has been added!",
      variant: "success",
      title: "Published!",
      body: `Your work has been submitted!<br/><br/>${garden.operators[0].substring(0, 12)}, your Garden Operator will review your submission and you’ll be notified once it's approved or rejected.`,
      icon: RiCheckFill,
      spinner: false,
    },
    pending: {
      header: "",
      variant: "pending",
      title: "Publishing...",
      body: "Your work is being submitted...",
      icon: RiTelegram2Fill,
      spinner: true,
    },
    idle: {
      header: "",
      variant: "pending",
      title: "Pending",
      body: "We also have no idea what's going on...",
      icon: RiTelegram2Fill,
      spinner: true,
    },
    ...messages,
  });

  const state = getMessages(garden)[status as completedStatus];
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
