import type React from "react";
import {
  RiCheckFill,
  RiErrorWarningFill,
  RiTelegram2Fill,
} from "@remixicon/react";

import type { useMutation } from "@tanstack/react-query";
import {
  UploadModal,
  type ModalVariantRoot,
} from "@/components/UI/UploadModal/UploadModal";

interface WorkCompletedProps {
  garden: Garden;
  workMutation: ReturnType<
    typeof useMutation<`0x${string}`, Error, WorkDraft, void>
  >;
}

const messages = (garden: Garden) => ({
  error: {
    variant: "error",
    header: "Error",
    body: "Something went wrong, please try again later",
    icon: RiErrorWarningFill,
    spinner: false,
  },
  success: {
    variant: "success",
    header: "Published!",
    body: `Your work has been submitted!<br/><br/>${garden.operators[0].substring(0, 12)}, your Garden Operator will review your submission and you’ll be notified once it's approved or rejected.`,
    icon: RiCheckFill,
    spinner: false,
  },
  pending: {
    variant: "pending",
    header: "Publishing...",
    body: "Your work is being submitted...",
    icon: RiTelegram2Fill,
    spinner: true,
  },
  idle: {
    variant: "pending",
    header: "Pending",
    body: "We also have no idea what's going on...",
    icon: RiTelegram2Fill,
    spinner: true,
  },
});

export const WorkCompleted: React.FC<WorkCompletedProps> = ({
  workMutation,
  garden,
}) => {
  const { status } = workMutation;
  const state = messages(garden)[status as keyof ReturnType<typeof messages>];
  return (
    <UploadModal
      variant={state.variant as ModalVariantRoot["variant"]}
      headerText={state.header}
      bodyText={state.body}
      icon={state.icon}
      spinner={state.spinner}
    />
  );
};
