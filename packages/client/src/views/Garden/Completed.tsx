import { RiCheckFill, RiCloseFill, RiLoader4Line, RiArrowRightLine } from "@remixicon/react";
import type { ComponentType } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/Actions";

interface WorkCompletedMessage {
  header: string;
  variant: "success" | "error" | "pending";
  title: string;
  body: string;
  icon?: ComponentType<{ className?: string }>;
  spinner?: boolean;
}

interface WorkCompletedProps {
  garden: Garden;
  status: "idle" | "pending" | "success" | "error";
  mutationData?: unknown;
  messages: {
    success?: WorkCompletedMessage;
    error?: WorkCompletedMessage;
    pending?: WorkCompletedMessage;
  };
}

export function WorkCompleted({ garden, status, messages }: WorkCompletedProps) {
  const intl = useIntl();
  const navigate = useNavigate();

  const getMessage = (): WorkCompletedMessage | null => {
    if (status === "success" && messages.success) return messages.success;
    if (status === "error" && messages.error) return messages.error;
    if (status === "pending" && messages.pending) return messages.pending;
    // Default success message if only success is provided
    if (status === "success") {
      return {
        header: intl.formatMessage({
          id: "app.work.completed.header",
          defaultMessage: "Success!",
        }),
        variant: "success",
        title: intl.formatMessage({
          id: "app.work.completed.title",
          defaultMessage: "Completed",
        }),
        body: intl.formatMessage({
          id: "app.work.completed.body",
          defaultMessage: "Your action has been completed successfully.",
        }),
        icon: RiCheckFill,
        spinner: false,
      };
    }
    return null;
  };

  const message = getMessage();

  if (!message) {
    return null;
  }

  const IconComponent = message.icon || (message.spinner ? RiLoader4Line : RiCheckFill);
  const iconColorClass =
    message.variant === "success"
      ? "text-success-base"
      : message.variant === "error"
        ? "text-error-base"
        : "text-primary";

  const bgColorClass =
    message.variant === "success"
      ? "bg-success-lighter"
      : message.variant === "error"
        ? "bg-error-lighter"
        : "bg-bg-weak-50";

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Icon Container */}
      <div
        className={`w-20 h-20 rounded-full ${bgColorClass} flex items-center justify-center mb-6`}
      >
        <IconComponent
          className={`w-10 h-10 ${iconColorClass} ${message.spinner ? "animate-spin" : ""}`}
        />
      </div>

      {/* Header */}
      <h1 className="text-2xl font-bold text-text-strong-950 mb-2">{message.header}</h1>

      {/* Title Badge */}
      <div
        className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${bgColorClass} ${iconColorClass} mb-4`}
      >
        {message.variant === "success" ? (
          <RiCheckFill className="w-5 h-5" />
        ) : message.variant === "error" ? (
          <RiCloseFill className="w-5 h-5" />
        ) : null}
        <span className="font-semibold">{message.title}</span>
      </div>

      {/* Body */}
      <p
        className="text-text-sub-600 max-w-sm mb-8"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe HTML from intl messages
        dangerouslySetInnerHTML={{ __html: message.body }}
      />

      {/* Action Button */}
      <Button
        variant="primary"
        mode="filled"
        shape="pilled"
        size="medium"
        label={intl.formatMessage({
          id: "app.work.completed.backToGarden",
          defaultMessage: "Back to Garden",
        })}
        trailingIcon={<RiArrowRightLine className="w-5 h-5" />}
        onClick={() => navigate(`/home/${garden.id}`)}
        className="min-w-[200px]"
      />
    </div>
  );
}
