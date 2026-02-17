import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiLoader4Line, RiCheckLine, RiExchangeDollarLine } from "@remixicon/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import {
  useCreateListing,
  LISTING_DEFAULTS,
  type CreateListingParams,
  type ListingStep,
  DEFAULT_CHAIN_ID,
} from "@green-goods/shared";
import { type Address, parseEther, zeroAddress } from "viem";

interface CreateListingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gardenAddress: Address;
  hypercertId: bigint;
  fractionId: bigint;
}

interface ListingFormValues {
  currency: string;
  pricePerUnit: string;
  minUnits: string;
  maxUnits: string;
  minUnitsToKeep: string;
  durationDays: number;
  sellLeftover: boolean;
}

const DURATION_OPTIONS = [
  { label: "30 days", value: 30 },
  { label: "60 days", value: 60 },
  { label: "90 days", value: 90 },
  { label: "180 days", value: 180 },
];

const STEP_LABELS: Record<ListingStep, string> = {
  idle: "",
  building: "Building order...",
  signing: "Waiting for signature...",
  registering: "Registering on-chain...",
  confirming: "Confirming transaction...",
  done: "Listing created!",
  error: "Failed to create listing",
};

/**
 * Dialog for creating a marketplace listing for a hypercert.
 * Two steps: configure pricing -> sign & submit.
 */
export function CreateListingDialog({
  open,
  onOpenChange,
  gardenAddress,
  hypercertId,
  fractionId,
}: CreateListingDialogProps) {
  const { formatMessage } = useIntl();
  const { createListing, step, isCreating, error, reset } = useCreateListing(gardenAddress);
  const [phase, setPhase] = useState<"configure" | "progress">("configure");

  const {
    register,
    handleSubmit,
    formState: { errors: formErrors },
  } = useForm<ListingFormValues>({
    defaultValues: {
      currency: zeroAddress, // Native/WETH
      pricePerUnit: "0.00001",
      minUnits: "1",
      maxUnits: "",
      minUnitsToKeep: "0",
      durationDays: LISTING_DEFAULTS.durationDays,
      sellLeftover: LISTING_DEFAULTS.sellLeftover,
    },
  });

  const onSubmit = async (values: ListingFormValues) => {
    setPhase("progress");

    const params: CreateListingParams = {
      hypercertId,
      fractionId,
      currency: values.currency as Address,
      pricePerUnit: parseEther(values.pricePerUnit),
      minUnitAmount: BigInt(values.minUnits || "1"),
      maxUnitAmount: values.maxUnits ? BigInt(values.maxUnits) : LISTING_DEFAULTS.maxUnitAmount,
      minUnitsToKeep: BigInt(values.minUnitsToKeep || "0"),
      sellLeftover: values.sellLeftover,
      durationDays: values.durationDays,
    };

    try {
      await createListing(params);
    } catch {
      // Error handled by hook
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setPhase("configure");
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-200" />
        <Dialog.Content
          className="fixed z-50 w-full max-w-lg overflow-hidden bg-bg-white shadow-2xl focus:outline-none bottom-0 left-1/2 -translate-x-1/2 rounded-t-2xl sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom duration-300"
          onPointerDownOutside={(e) => {
            if (isCreating) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isCreating) e.preventDefault();
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stroke-soft p-4">
            <Dialog.Title className="flex items-center gap-2 text-lg font-semibold text-text-strong">
              <RiExchangeDollarLine className="h-5 w-5 text-primary-base" />
              List for Yield
            </Dialog.Title>
            {!isCreating && (
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-text-soft transition hover:bg-bg-soft"
                >
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            )}
          </div>

          {/* Content */}
          <div className="p-4 sm:p-6">
            {phase === "configure" ? (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                {/* Price per unit */}
                <div>
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    Price per Unit (ETH)
                  </label>
                  <input
                    type="text"
                    {...register("pricePerUnit", { required: "Price is required" })}
                    className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
                    placeholder="0.00001"
                  />
                  {formErrors.pricePerUnit && (
                    <p className="mt-1 text-xs text-error-base">
                      {formErrors.pricePerUnit.message}
                    </p>
                  )}
                </div>

                {/* Min / Max units row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-text-strong mb-1">
                      Min Units
                    </label>
                    <input
                      type="text"
                      {...register("minUnits")}
                      className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-text-strong mb-1">
                      Max Units
                    </label>
                    <input
                      type="text"
                      {...register("maxUnits")}
                      className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
                      placeholder="Unlimited"
                    />
                  </div>
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-sm font-medium text-text-strong mb-1">
                    Duration
                  </label>
                  <select
                    {...register("durationDays", { valueAsNumber: true })}
                    className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
                  >
                    {DURATION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sell leftover toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    {...register("sellLeftover")}
                    className="h-4 w-4 rounded border-stroke-soft text-primary-base focus:ring-primary-base"
                  />
                  <span className="text-sm text-text-sub">Sell leftover fraction</span>
                </label>

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2 border-t border-stroke-soft">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="rounded-md px-4 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker"
                  >
                    Sign &amp; List
                  </button>
                </div>
              </form>
            ) : (
              /* Progress phase */
              <div className="space-y-4">
                <ListingProgress step={step} />

                {error && (
                  <div className="rounded-md bg-error-lighter p-3">
                    <p className="text-sm text-error-dark">{error.message}</p>
                  </div>
                )}

                {step === "done" && (
                  <div className="rounded-md bg-success-lighter p-3 text-center">
                    <p className="text-sm font-medium text-success-dark">
                      Listing created successfully!
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-stroke-soft">
                  {(step === "done" || step === "error") && (
                    <button
                      type="button"
                      onClick={handleClose}
                      className="rounded-md px-4 py-2 text-sm font-medium text-text-sub transition hover:bg-bg-soft"
                    >
                      {step === "done" ? "Done" : "Close"}
                    </button>
                  )}
                  {step === "error" && (
                    <button
                      type="button"
                      onClick={() => {
                        reset();
                        setPhase("configure");
                      }}
                      className="rounded-md bg-primary-base px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary-darker"
                    >
                      Try Again
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const PROGRESS_STEPS: ListingStep[] = ["building", "signing", "registering", "confirming"];

function ListingProgress({ step }: { step: ListingStep }) {
  return (
    <div className="space-y-3">
      {PROGRESS_STEPS.map((s) => {
        const isActive = s === step;
        const isDone = PROGRESS_STEPS.indexOf(s) < PROGRESS_STEPS.indexOf(step) || step === "done";
        const isPending = !isActive && !isDone;

        return (
          <div key={s} className="flex items-center gap-3">
            <div className="flex h-6 w-6 items-center justify-center">
              {isDone ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success-base">
                  <RiCheckLine className="h-3 w-3 text-white" />
                </div>
              ) : isActive ? (
                <RiLoader4Line className="h-5 w-5 animate-spin text-primary-base" />
              ) : (
                <div className="h-2.5 w-2.5 rounded-full bg-stroke-soft" />
              )}
            </div>
            <span
              className={`text-sm ${
                isDone
                  ? "text-text-soft"
                  : isActive
                    ? "font-medium text-text-strong"
                    : "text-text-disabled"
              }`}
            >
              {STEP_LABELS[s]}
            </span>
          </div>
        );
      })}
    </div>
  );
}
