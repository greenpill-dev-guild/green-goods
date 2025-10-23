import { useEffect, type CSSProperties } from "react";
import { Toaster, type ToastOptions, type ToastPosition } from "react-hot-toast";
import { useIntl } from "react-intl";
import { setToastTranslator, type ToastStatus, type ToastTranslator } from "./toast.service";

const BASE_CONTAINER_STYLE: CSSProperties = {
  zIndex: 20000,
  top: "1.5rem",
  left: "50%",
  transform: "translateX(-50%)",
  width: "min(420px, calc(100vw - 2rem))",
};

const BASE_TOAST_OPTIONS: ToastOptions = {
  duration: 3500,
  style: {
    width: "100%",
    background: "var(--color-bg-white-0)",
    color: "var(--color-text-strong-950)",
    border: "1px solid var(--color-stroke-soft-200)",
    boxShadow: "var(--shadow-regular-md)",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "14px",
    lineHeight: "20px",
    textAlign: "center",
  },
  success: {
    duration: 3000,
    style: {
      borderLeft: "4px solid var(--color-success-base)",
    },
    iconTheme: {
      primary: "var(--color-success-base)",
      secondary: "var(--color-white)",
    },
  },
  error: {
    duration: 4500,
    style: {
      borderLeft: "4px solid var(--color-error-base)",
    },
    iconTheme: {
      primary: "var(--color-error-base)",
      secondary: "var(--color-white)",
    },
  },
  loading: {
    duration: 60000,
    style: {
      borderLeft: "4px solid var(--color-information-base)",
    },
  },
};

function mergeToastOptions(
  base: ToastOptions | undefined,
  overrides?: ToastOptions
): ToastOptions | undefined {
  if (!base && !overrides) {
    return undefined;
  }

  if (!base) {
    return overrides ? { ...overrides } : undefined;
  }

  if (!overrides) {
    return { ...base };
  }

  const merged: ToastOptions = {
    ...base,
    ...overrides,
  };

  if (base.style || overrides.style) {
    merged.style = {
      ...(base.style ?? {}),
      ...(overrides.style ?? {}),
    };
  }

  if (base.iconTheme || overrides.iconTheme) {
    merged.iconTheme = {
      ...(base.iconTheme ?? {}),
      ...(overrides.iconTheme ?? {}),
    };
  }

  merged.success = mergeToastOptions(base.success, overrides.success);
  merged.error = mergeToastOptions(base.error, overrides.error);
  merged.loading = mergeToastOptions(base.loading, overrides.loading);

  return merged;
}

export interface ToastViewportProps {
  position?: ToastPosition;
  containerStyle?: CSSProperties;
  toastOptions?: ToastOptions;
}

export function ToastViewport({
  position = "top-center",
  containerStyle,
  toastOptions,
}: ToastViewportProps) {
  const intl = useIntl();
  const locale = intl.locale;

  useEffect(() => {
    const titleDescriptors: Record<
      ToastStatus,
      { id: string; defaultMessage: string }
    > = {
      success: {
        id: "app.toast.default.successTitle",
        defaultMessage: "Success",
      },
      error: {
        id: "app.toast.default.errorTitle",
        defaultMessage: "Something went wrong",
      },
      loading: {
        id: "app.toast.default.loadingTitle",
        defaultMessage: "Working on it",
      },
      info: {
        id: "app.toast.default.infoTitle",
        defaultMessage: "Notice",
      },
    };

    const messageDescriptors: Record<
      ToastStatus,
      { id: string; defaultMessage: string }
    > = {
      success: {
        id: "app.toast.default.successMessage",
        defaultMessage: "All set.",
      },
      error: {
        id: "app.toast.default.errorMessage",
        defaultMessage: "Please try again.",
      },
      loading: {
        id: "app.toast.default.loadingMessage",
        defaultMessage: "Processing...",
      },
      info: {
        id: "app.toast.default.infoMessage",
        defaultMessage: "Here's an update.",
      },
    };

    const contextMessageDescriptors: Partial<
      Record<ToastStatus, { id: string; defaultMessage: string }>
    > = {
      success: {
        id: "app.toast.default.contextSuccessMessage",
        defaultMessage: "{context} completed.",
      },
      error: {
        id: "app.toast.default.contextErrorMessage",
        defaultMessage: "Couldn't {context}. Try again.",
      },
      loading: {
        id: "app.toast.default.contextLoadingMessage",
        defaultMessage: "{context} in progress...",
      },
      info: {
        id: "app.toast.default.contextInfoMessage",
        defaultMessage: "{context}",
      },
    };

    const contextTitleDescriptor = {
      id: "app.toast.default.contextTitle",
      defaultMessage: "{context}",
    };

    const translator: ToastTranslator = {
      formatTitle: (status, context) => {
        const trimmedContext = context?.trim();
        if (trimmedContext) {
          return intl.formatMessage(contextTitleDescriptor, { context: trimmedContext });
        }

        const descriptor = titleDescriptors[status];
        return descriptor ? intl.formatMessage(descriptor) : undefined;
      },
      formatMessage: (status, context) => {
        const trimmedContext = context?.trim();
        if (trimmedContext) {
          const descriptor = contextMessageDescriptors[status];
          if (descriptor) {
            return intl.formatMessage(descriptor, { context: trimmedContext });
          }
        }

        const descriptor = messageDescriptors[status];
        return descriptor
          ? intl.formatMessage(descriptor)
          : intl.formatMessage(messageDescriptors.info);
      },
    };

    setToastTranslator(translator);

    return () => {
      setToastTranslator();
    };
  }, [intl, locale]);

  return (
    <Toaster
      position={position}
      containerStyle={{ ...BASE_CONTAINER_STYLE, ...containerStyle }}
      toastOptions={mergeToastOptions(BASE_TOAST_OPTIONS, toastOptions)}
    />
  );
}

export const defaultToastOptions = BASE_TOAST_OPTIONS;
