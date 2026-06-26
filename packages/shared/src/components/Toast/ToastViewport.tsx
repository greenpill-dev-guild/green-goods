import { type CSSProperties, useEffect } from "react";
import { Toaster, type ToastOptions, type ToastPosition } from "react-hot-toast";
import { useIntl } from "react-intl";
import { setToastTranslator, type ToastStatus, type ToastTranslator } from "./toast.service";

export type ToastViewportVariant = "default" | "editorial";

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
};

const EDITORIAL_CONTAINER_STYLE: CSSProperties = {
  top: "clamp(1rem, 2vw, 2rem)",
  width: "min(460px, calc(100vw - 2rem))",
};

const EDITORIAL_TOAST_OPTIONS: ToastOptions = {
  style: {
    background: "rgb(var(--editorial-warm-rgb, 241 236 226))",
    color: "var(--color-text-strong-950)",
    border: "1px solid rgb(var(--editorial-deep-rgb, 45 33 24) / 0.18)",
    boxShadow: "var(--shadow-editorial-panel, 0 30px 80px -30px rgb(45 33 24 / 0.35))",
    borderRadius: "var(--radius-md)",
    padding: "14px 18px",
    textAlign: "left",
  },
  iconTheme: {
    primary: "rgb(var(--editorial-deep-rgb, 45 33 24))",
    secondary: "rgb(var(--editorial-warm-rgb, 241 236 226))",
  },
  className: "gg-toast-editorial",
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
      primary: overrides.iconTheme?.primary ?? base.iconTheme?.primary ?? "",
      secondary: overrides.iconTheme?.secondary ?? base.iconTheme?.secondary ?? "",
    };
  }

  if (base.className || overrides.className) {
    merged.className = [base.className, overrides.className].filter(Boolean).join(" ");
  }

  return merged;
}

export interface ToastViewportProps {
  position?: ToastPosition;
  containerStyle?: CSSProperties;
  toastOptions?: ToastOptions;
  variant?: ToastViewportVariant;
}

export function ToastViewport({
  position = "top-center",
  containerStyle,
  toastOptions,
  variant = "default",
}: ToastViewportProps) {
  const intl = useIntl();
  const locale = intl.locale;
  const variantContainerStyle = variant === "editorial" ? EDITORIAL_CONTAINER_STYLE : undefined;
  const variantToastOptions = variant === "editorial" ? EDITORIAL_TOAST_OPTIONS : undefined;
  const mergedToastOptions = mergeToastOptions(
    mergeToastOptions(BASE_TOAST_OPTIONS, variantToastOptions),
    toastOptions
  );

  useEffect(() => {
    const titleDescriptors: Record<ToastStatus, { id: string; defaultMessage: string }> = {
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

    const messageDescriptors: Record<ToastStatus, { id: string; defaultMessage: string }> = {
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
      containerStyle={{ ...BASE_CONTAINER_STYLE, ...variantContainerStyle, ...containerStyle }}
      toastOptions={mergedToastOptions}
    />
  );
}
