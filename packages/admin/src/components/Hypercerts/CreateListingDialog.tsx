import {
  type Address,
  Alert,
  type CreateListingParams,
  DialogShell,
  LISTING_DEFAULTS,
  type ListingStep,
  logger,
  NativeSelect,
  TextInput,
  useCreateListing,
} from "@green-goods/shared";
import { RiCheckLine, RiExchangeDollarLine, RiLoader4Line } from "@remixicon/react";
import { AdminButton } from "../AdminButton";
import { AdminCheckbox } from "../AdminCheckbox";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useIntl } from "react-intl";
import { parseEther, zeroAddress } from "viem";

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

const DURATION_VALUES = [30, 60, 90, 180] as const;

const STEP_LABEL_KEYS: Record<ListingStep, { id: string; defaultMessage: string } | null> = {
  idle: null,
  building: { id: "app.listing.stepBuilding", defaultMessage: "Building order..." },
  signing: { id: "app.listing.stepSigning", defaultMessage: "Waiting for signature..." },
  registering: { id: "app.listing.stepRegistering", defaultMessage: "Registering on-chain..." },
  confirming: { id: "app.listing.stepConfirming", defaultMessage: "Confirming transaction..." },
  done: { id: "app.listing.stepDone", defaultMessage: "Listing created!" },
  error: { id: "app.listing.stepError", defaultMessage: "Failed to create listing" },
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
  const [submissionError, setSubmissionError] = useState<Error | null>(null);

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
    setSubmissionError(null);
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
    } catch (error) {
      logger.error("Failed to create listing", { error });
      setSubmissionError(
        error instanceof Error
          ? error
          : new Error(
              formatMessage({
                id: "app.listing.stepError",
                defaultMessage: "Failed to create listing",
              })
            )
      );
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setPhase("configure");
      setSubmissionError(null);
      reset();
      onOpenChange(false);
    }
  };

  const sellLeftoverRegistration = register("sellLeftover");
  const visibleError = error ?? submissionError;
  const isErrorState = step === "error" || visibleError !== null;

  return (
    <DialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
      size="lg"
      title={formatMessage({ id: "app.listing.title", defaultMessage: "List for Yield" })}
      icon={<RiExchangeDollarLine className="h-5 w-5 text-primary-base" />}
      iconContainerClassName="bg-primary-alpha-10"
      preventClose={isCreating}
      hideCloseButton={isCreating}
    >
      {phase === "configure" ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Price per unit */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-1">
              {formatMessage({
                id: "app.listing.pricePerUnit",
                defaultMessage: "Price per Unit (ETH)",
              })}
            </label>
            <TextInput
              surface="admin"
              type="text"
              {...register("pricePerUnit", {
                required: formatMessage({
                  id: "app.listing.priceRequired",
                  defaultMessage: "Price is required",
                }),
              })}
              className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
              placeholder="0.00001"
            />
            {formErrors.pricePerUnit && (
              <p className="mt-1 text-xs text-error-base">{formErrors.pricePerUnit.message}</p>
            )}
          </div>

          {/* Min / Max units row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-text-strong mb-1">
                {formatMessage({ id: "app.listing.minUnits", defaultMessage: "Min Units" })}
              </label>
              <TextInput
                surface="admin"
                type="text"
                {...register("minUnits")}
                className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
                placeholder="1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-strong mb-1">
                {formatMessage({ id: "app.listing.maxUnits", defaultMessage: "Max Units" })}
              </label>
              <TextInput
                surface="admin"
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
              {formatMessage({ id: "app.listing.duration", defaultMessage: "Duration" })}
            </label>
            <NativeSelect
              surface="admin"
              {...register("durationDays", { valueAsNumber: true })}
              className="w-full rounded-md border border-stroke-soft bg-bg-white px-3 py-2 text-sm text-text-strong focus:border-primary-base focus:outline-none focus:ring-1 focus:ring-primary-base"
            >
              {DURATION_VALUES.map((days) => (
                <option key={days} value={days}>
                  {formatMessage(
                    { id: "app.listing.durationDays", defaultMessage: "{days} days" },
                    { days }
                  )}
                </option>
              ))}
            </NativeSelect>
          </div>

          {/* Sell leftover toggle */}
          <AdminCheckbox
            ref={sellLeftoverRegistration.ref}
            name={sellLeftoverRegistration.name}
            onChange={sellLeftoverRegistration.onChange}
            label={formatMessage({
              id: "app.listing.sellLeftover",
              defaultMessage: "Sell leftover fraction",
            })}
            className="[&>span:nth-child(2)>span]:text-sm [&>span:nth-child(2)>span]:text-text-sub"
          />

          <div className="flex justify-end gap-2 pt-2 border-t border-stroke-soft">
            <AdminButton type="button" variant="text" onClick={handleClose}>
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
            <AdminButton type="submit">
              {formatMessage({
                id: "app.listing.signAndList",
                defaultMessage: "Sign & List",
              })}
            </AdminButton>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          <ListingProgress step={step} />

          {visibleError && <Alert variant="error">{visibleError.message}</Alert>}

          {step === "done" && (
            <Alert variant="success">
              {formatMessage({
                id: "app.listing.createdSuccessfully",
                defaultMessage: "Listing created successfully!",
              })}
            </Alert>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-stroke-soft">
            {(step === "done" || isErrorState) && (
              <AdminButton type="button" variant="text" onClick={handleClose}>
                {step === "done"
                  ? formatMessage({ id: "app.common.done", defaultMessage: "Done" })
                  : formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
              </AdminButton>
            )}
            {isErrorState && (
              <AdminButton
                type="button"
                onClick={() => {
                  setSubmissionError(null);
                  reset();
                  setPhase("configure");
                }}
              >
                {formatMessage({ id: "app.common.tryAgain", defaultMessage: "Try Again" })}
              </AdminButton>
            )}
          </div>
        </div>
      )}
    </DialogShell>
  );
}

const PROGRESS_STEPS: ListingStep[] = ["building", "signing", "registering", "confirming"];

function ListingProgress({ step }: { step: ListingStep }) {
  const { formatMessage } = useIntl();
  return (
    <div className="space-y-3">
      {PROGRESS_STEPS.map((s) => {
        const isActive = s === step;
        const isDone = PROGRESS_STEPS.indexOf(s) < PROGRESS_STEPS.indexOf(step) || step === "done";

        const labelKey = STEP_LABEL_KEYS[s];
        const label = labelKey ? formatMessage(labelKey) : "";

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
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
