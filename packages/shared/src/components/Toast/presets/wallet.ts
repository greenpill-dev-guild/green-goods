import { toastService } from "../toast.service";
import { type FormatMessageFn, toastMessageIds } from "./types";

/** Default (English) fallback messages for wallet progress toasts */
const walletDefaults = {
  validating: { title: "Checking membership", message: "Verifying garden access..." },
  uploading: { title: "Uploading media", message: "Saving images to IPFS..." },
  confirming: { title: "Confirm in wallet", message: "Waiting for your signature..." },
  syncing: { title: "Almost there", message: "Syncing with blockchain..." },
  success: { title: "Work submitted!", message: "Your contribution is now on-chain" },
  error: { title: "Submission failed", recoverable: "You can try again with the same data." },
  timeout: {
    title: "Taking longer than usual",
    message: "Your transaction is still processing. Check your wallet for status.",
  },
};

/**
 * Progressive feedback toasts for wallet-based work submissions.
 * Provides real-time stage updates to reduce perceived wait time.
 */
export const walletProgressToasts = {
  /** Show validating state */
  validating: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.validating.title,
      message: walletDefaults.validating.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show uploading media state */
  uploading: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.uploading.title,
      message: walletDefaults.uploading.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show wallet confirmation state */
  confirming: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.confirming.title,
      message: walletDefaults.confirming.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show syncing state */
  syncing: () =>
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.syncing.title,
      message: walletDefaults.syncing.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show success state */
  success: () =>
    toastService.success({
      id: "wallet-submission",
      title: walletDefaults.success.title,
      message: walletDefaults.success.message,
      context: "wallet submission",
      suppressLogging: true,
    }),

  /** Show error state with recoverable info */
  error: (message: string, recoverable: boolean = false) =>
    toastService.error({
      id: "wallet-submission",
      title: walletDefaults.error.title,
      message,
      context: "wallet submission",
      description: recoverable ? walletDefaults.error.recoverable : undefined,
    }),

  /** Show timeout warning (transaction may still succeed) */
  timeout: () =>
    toastService.info({
      id: "wallet-submission",
      title: walletDefaults.timeout.title,
      message: walletDefaults.timeout.message,
      context: "wallet submission",
    }),

  /** Dismiss the wallet submission toast */
  dismiss: () => toastService.dismiss("wallet-submission"),
};

/**
 * Create i18n-aware wallet progress toasts
 * @param formatMessage - react-intl formatMessage function
 */
export function createWalletProgressToasts(formatMessage: FormatMessageFn) {
  return {
    validating: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.validating.title,
          defaultMessage: walletDefaults.validating.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.validating.message,
          defaultMessage: walletDefaults.validating.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    uploading: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.uploading.title,
          defaultMessage: walletDefaults.uploading.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.uploading.message,
          defaultMessage: walletDefaults.uploading.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    confirming: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.confirming.title,
          defaultMessage: walletDefaults.confirming.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.confirming.message,
          defaultMessage: walletDefaults.confirming.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    syncing: () =>
      toastService.loading({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.syncing.title,
          defaultMessage: walletDefaults.syncing.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.syncing.message,
          defaultMessage: walletDefaults.syncing.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    success: () =>
      toastService.success({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.success.title,
          defaultMessage: walletDefaults.success.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.success.message,
          defaultMessage: walletDefaults.success.message,
        }),
        context: "wallet submission",
        suppressLogging: true,
      }),

    error: (message: string, recoverable: boolean = false) =>
      toastService.error({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.error.title,
          defaultMessage: walletDefaults.error.title,
        }),
        message,
        context: "wallet submission",
        description: recoverable
          ? formatMessage({
              id: toastMessageIds.wallet.error.recoverable,
              defaultMessage: walletDefaults.error.recoverable,
            })
          : undefined,
      }),

    timeout: () =>
      toastService.info({
        id: "wallet-submission",
        title: formatMessage({
          id: toastMessageIds.wallet.timeout.title,
          defaultMessage: walletDefaults.timeout.title,
        }),
        message: formatMessage({
          id: toastMessageIds.wallet.timeout.message,
          defaultMessage: walletDefaults.timeout.message,
        }),
        context: "wallet submission",
      }),

    dismiss: () => toastService.dismiss("wallet-submission"),
  };
}

/**
 * Helper to show progressive wallet submission feedback
 * @param stage - Current submission stage
 */
export function showWalletProgress(
  stage: "validating" | "uploading" | "confirming" | "syncing" | "success",
  message?: string
): void {
  if (stage === "uploading" && message) {
    toastService.loading({
      id: "wallet-submission",
      title: walletDefaults.uploading.title,
      message,
      context: "wallet submission",
      suppressLogging: true,
    });
    return;
  }
  walletProgressToasts[stage]();
}
