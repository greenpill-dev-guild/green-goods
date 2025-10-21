import { useCreateGardenWorkflow } from "@green-goods/shared/hooks";
import { ADDRESS_REGEX, isValidAddress, useCreateGardenStore } from "@green-goods/shared/stores";
import { cn } from "@green-goods/shared/utils";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";

interface CreateGardenModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateGardenModal({ isOpen, onClose }: CreateGardenModalProps) {
  const form = useCreateGardenStore((state) => state.form);
  const steps = useCreateGardenStore((state) => state.steps);
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const setField = useCreateGardenStore((state) => state.setField);
  const addGardener = useCreateGardenStore((state) => state.addGardener);
  const removeGardener = useCreateGardenStore((state) => state.removeGardener);
  const addOperator = useCreateGardenStore((state) => state.addOperator);
  const removeOperator = useCreateGardenStore((state) => state.removeOperator);
  const canProceed = useCreateGardenStore((state) => state.canProceed);
  const isReviewReady = useCreateGardenStore((state) => state.isReviewReady);

  const { state, openFlow, closeFlow, goNext, goBack, submitCreation, retry, edit, createAnother } =
    useCreateGardenWorkflow();

  const [gardenerInput, setGardenerInput] = useState("");
  const [operatorInput, setOperatorInput] = useState("");
  const [gardenerError, setGardenerError] = useState<string | null>(null);
  const [operatorError, setOperatorError] = useState<string | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";
  const shouldResetOnOpenRef = useRef(true);

  useEffect(() => {
    if (isOpen && shouldResetOnOpenRef.current) {
      openFlow();
      setGardenerInput("");
      setOperatorInput("");
      setGardenerError(null);
      setOperatorError(null);
      setShowValidation(false);
      shouldResetOnOpenRef.current = false;
    }
  }, [isOpen, openFlow]);

  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  const handleAddGardener = () => {
    if (!gardenerInput.trim()) {
      setGardenerError("Enter a wallet address");
      return;
    }
    const result = addGardener(gardenerInput.trim());
    if (!result.success) {
      setGardenerError(result.error ?? "Invalid gardener address");
      return;
    }
    setGardenerInput("");
    setGardenerError(null);
  };

  const handleAddOperator = () => {
    if (!operatorInput.trim()) {
      setOperatorError("Enter a wallet address");
      return;
    }
    const result = addOperator(operatorInput.trim());
    if (!result.success) {
      setOperatorError(result.error ?? "Invalid operator address");
      return;
    }
    setOperatorInput("");
    setOperatorError(null);
  };

  const handleNext = () => {
    setShowValidation(true);
    if (!canProceed()) {
      return;
    }
    goNext();
  };

  const handleBack = () => {
    setShowValidation(false);
    goBack();
  };

  const handleSubmit = () => {
    setShowValidation(true);
    if (!isReviewReady()) {
      return;
    }
    submitCreation();
  };

  const handleCreateAnother = () => {
    setShowValidation(false);
    setGardenerInput("");
    setOperatorInput("");
    setGardenerError(null);
    setOperatorError(null);
    shouldResetOnOpenRef.current = false;
    createAnother();
  };

  const handleDismiss = () => {
    if (state.value === "success") {
      shouldResetOnOpenRef.current = true;
    }
    onClose();
  };

  const handleCancel = () => {
    shouldResetOnOpenRef.current = true;
    setShowValidation(false);
    setGardenerInput("");
    setOperatorInput("");
    setGardenerError(null);
    setOperatorError(null);
    closeFlow();
    onClose();
  };

  const detailsErrors = useMemo(
    () => ({
      name: form.name.trim().length > 0 ? null : "Garden name is required",
      description: form.description.trim().length > 0 ? null : "Description is required",
      location: form.location.trim().length > 0 ? null : "Location is required",
      communityToken: isValidAddress(form.communityToken.trim())
        ? null
        : form.communityToken.trim().length === 0
          ? "Community token address is required"
          : "Enter a valid wallet address",
    }),
    [form.name, form.description, form.location, form.communityToken]
  );

  const teamError = useMemo(
    () => (form.gardeners.length > 0 ? null : "Add at least one gardener to steward the garden"),
    [form.gardeners]
  );

  const currentStepConfig = steps[currentStep];
  const isDetailsStep = currentStepConfig?.id === "details";
  const isTeamStep = currentStepConfig?.id === "team";
  const isReviewStep = currentStepConfig?.id === "review";

  const showDetailsErrors = showValidation && isDetailsStep;
  const showTeamErrors = showValidation && isTeamStep;

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center px-4 py-10 transition",
        isOpen ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!isOpen}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        className={cn(
          "fixed inset-0 bg-black/30 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0"
        )}
        onClick={handleDismiss}
        aria-label="Dismiss create garden modal"
      />
      <div
        className={cn(
          "relative z-10 flex w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl transition-all dark:border-gray-700 dark:bg-gray-900",
          "max-h-[calc(100vh-80px)]",
          isOpen ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-6 py-4 dark:border-gray-700 dark:bg-gray-900/80">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Deploy a new garden
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Guide your community through a streamlined garden launch flow.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            aria-label="Close create garden modal"
          >
            <RiCloseLine className="h-5 w-5" />
          </button>
        </div>

        {steps.length > 0 && !isSuccess && (
          <ol className="flex flex-wrap gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4 text-sm dark:border-gray-700 dark:bg-gray-900/60">
            {steps.map((step, index) => {
              const completed = index < currentStep;
              const active = index === currentStep;
              return (
                <li key={step.id} className="flex min-w-[200px] flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium",
                      completed &&
                        "border-green-600 bg-green-100 text-green-700 dark:border-green-500 dark:bg-green-500/20 dark:text-green-300",
                      active &&
                        !completed &&
                        "border-green-600 bg-white text-green-600 dark:border-green-500 dark:bg-gray-900 dark:text-green-300",
                      !completed &&
                        !active &&
                        "border-gray-200 text-gray-400 dark:border-gray-700 dark:text-gray-500"
                    )}
                  >
                    {completed ? <RiCheckboxCircleLine className="h-4 w-4" /> : index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {step.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{step.description}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <span className="ml-auto hidden h-px flex-1 bg-gray-200 dark:bg-gray-700 lg:flex" />
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-6">
          {hasError && (
            <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300">
              <RiErrorWarningLine className="mt-0.5 h-5 w-5" />
              <div>
                <p className="font-medium text-red-700 dark:text-red-200">
                  We couldn&apos;t deploy the garden
                </p>
                <p className="mt-1 text-red-600 dark:text-red-200/80">
                  {state.context.error ?? "Please review the details and try again."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={retry}
                    className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 dark:border-red-500/60 dark:text-red-200 dark:hover:bg-red-500/20"
                  >
                    Retry deployment
                  </button>
                  <button
                    onClick={() => {
                      setShowValidation(false);
                      edit();
                    }}
                    className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Edit details
                  </button>
                </div>
              </div>
            </div>
          )}

          {isSuccess ? (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600 dark:bg-green-500/20 dark:text-green-300">
                <RiCheckboxCircleLine className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Garden deployment submitted
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  The transaction hash is{" "}
                  <span className="font-mono text-xs text-gray-500 dark:text-gray-300">
                    {state.context.txHash}
                  </span>
                  . Share the link with your community while the attestation confirms on-chain.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={handleCreateAnother}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400"
                >
                  Launch another garden
                </button>
                <button
                  onClick={handleDismiss}
                  className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <Fragment>
              {isDetailsStep && (
                <div className="space-y-5">
                  <section>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Garden profile
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Tell us where the garden lives and how to describe it.
                    </p>
                  </section>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Garden name *
                      </span>
                      <input
                        value={form.name}
                        onChange={(event) => setField("name", event.target.value)}
                        placeholder="eg. Rio rainforest lab"
                        className={cn(
                          "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
                          showDetailsErrors &&
                            detailsErrors.name &&
                            "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
                        )}
                      />
                      {showDetailsErrors && detailsErrors.name && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {detailsErrors.name}
                        </span>
                      )}
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Location *
                      </span>
                      <input
                        value={form.location}
                        onChange={(event) => setField("location", event.target.value)}
                        placeholder="City, country or coordinates"
                        className={cn(
                          "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
                          showDetailsErrors &&
                            detailsErrors.location &&
                            "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
                        )}
                      />
                      {showDetailsErrors && detailsErrors.location && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {detailsErrors.location}
                        </span>
                      )}
                    </label>
                  </div>
                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-gray-700 dark:text-gray-200">
                      Description *
                    </span>
                    <textarea
                      value={form.description}
                      onChange={(event) => setField("description", event.target.value)}
                      placeholder="Share the story, mission and unique traits of the garden."
                      rows={4}
                      className={cn(
                        "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
                        showDetailsErrors &&
                          detailsErrors.description &&
                          "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
                      )}
                    />
                    {showDetailsErrors && detailsErrors.description && (
                      <span className="text-xs text-red-600 dark:text-red-400">
                        {detailsErrors.description}
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Community token address *
                      </span>
                      <input
                        value={form.communityToken}
                        onChange={(event) => setField("communityToken", event.target.value)}
                        placeholder="0x..."
                        className={cn(
                          "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30",
                          showDetailsErrors &&
                            detailsErrors.communityToken &&
                            "border-red-300 focus:border-red-400 focus:ring-red-100 dark:border-red-500/60 dark:focus:border-red-500 dark:focus:ring-red-500/30"
                        )}
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Must match the ERC-20 token powering the community.
                      </span>
                      {showDetailsErrors && detailsErrors.communityToken && (
                        <span className="text-xs text-red-600 dark:text-red-400">
                          {detailsErrors.communityToken}
                        </span>
                      )}
                    </label>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        Banner image URL
                      </span>
                      <input
                        value={form.bannerImage}
                        onChange={(event) => setField("bannerImage", event.target.value)}
                        placeholder="https://cdn.green-goods..."
                        className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30"
                      />
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Optional link to a hero image showcasing the garden.
                      </span>
                    </label>
                  </div>
                </div>
              )}

              {isTeamStep && (
                <div className="space-y-5">
                  <section>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Community stewards
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Add wallets that can tend to the garden and coordinate future work. Gardeners
                      mint attestations and operators oversee approvals.
                    </p>
                  </section>

                  <div className="space-y-4">
                    <div>
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                        htmlFor="create-garden-gardener-address"
                      >
                        Gardeners *
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          id="create-garden-gardener-address"
                          value={gardenerInput}
                          onChange={(event) => setGardenerInput(event.target.value)}
                          placeholder="0x..."
                          className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddGardener}
                          className="flex items-center justify-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <RiAddLine className="h-4 w-4" /> Add
                        </button>
                      </div>
                      {gardenerError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {gardenerError}
                        </p>
                      )}
                      {showTeamErrors && teamError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">{teamError}</p>
                      )}
                      <ul className="mt-3 space-y-2">
                        {form.gardeners.map((gardener, index) => (
                          <li
                            key={`${gardener}-${index}`}
                            className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-200"
                          >
                            <span>{gardener}</span>
                            <button
                              type="button"
                              onClick={() => removeGardener(index)}
                              className="rounded-md p-1 text-gray-400 transition hover:bg-white hover:text-red-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-red-400"
                            >
                              <RiDeleteBinLine className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <label
                        className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-200"
                        htmlFor="create-garden-operator-address"
                      >
                        Garden operators
                      </label>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <input
                          id="create-garden-operator-address"
                          value={operatorInput}
                          onChange={(event) => setOperatorInput(event.target.value)}
                          placeholder="0x..."
                          className="flex-1 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-mono text-gray-900 shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100 dark:focus:border-green-400 dark:focus:ring-green-500/30"
                        />
                        <button
                          type="button"
                          onClick={handleAddOperator}
                          className="flex items-center justify-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                        >
                          <RiAddLine className="h-4 w-4" /> Add
                        </button>
                      </div>
                      {operatorError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {operatorError}
                        </p>
                      )}
                      <ul className="mt-3 space-y-2">
                        {form.operators.map((operator, index) => (
                          <li
                            key={`${operator}-${index}`}
                            className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700 dark:border-gray-700/60 dark:bg-gray-900/60 dark:text-gray-200"
                          >
                            <span>{operator}</span>
                            <button
                              type="button"
                              onClick={() => removeOperator(index)}
                              className="rounded-md p-1 text-gray-400 transition hover:bg-white hover:text-red-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-red-400"
                            >
                              <RiDeleteBinLine className="h-4 w-4" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {isReviewStep && (
                <div className="space-y-5">
                  <section>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                      Review deployment
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Double-check the on-chain data before sending the attestation transaction.
                    </p>
                  </section>
                  <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4 dark:border-gray-700/60 dark:bg-gray-900/60">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Garden name
                        </h4>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{form.name}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Location
                        </h4>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {form.location}
                        </p>
                      </div>
                      <div className="md:col-span-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Description
                        </h4>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                          {form.description}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Community token
                        </h4>
                        <p className="mt-1 font-mono text-xs text-gray-900 dark:text-gray-100">
                          {form.communityToken}
                        </p>
                        {!ADDRESS_REGEX.test(form.communityToken.trim()) && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            The address doesn&apos;t look valid.
                          </p>
                        )}
                      </div>
                      {form.bannerImage && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            Banner image
                          </h4>
                          <p className="mt-1 break-words text-sm text-gray-900 dark:text-gray-100">
                            {form.bannerImage}
                          </p>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Gardeners
                        </h4>
                        <ul className="mt-2 space-y-1">
                          {form.gardeners.map((gardener) => (
                            <li
                              key={gardener}
                              className="font-mono text-xs text-gray-900 dark:text-gray-100"
                            >
                              {gardener}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                          Operators
                        </h4>
                        {form.operators.length === 0 ? (
                          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            No operators assigned yet.
                          </p>
                        ) : (
                          <ul className="mt-2 space-y-1">
                            {form.operators.map((operator) => (
                              <li
                                key={operator}
                                className="font-mono text-xs text-gray-900 dark:text-gray-100"
                              >
                                {operator}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Fragment>
          )}
        </div>

        {!isSuccess && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900/70">
            <div>
              {isDetailsStep && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step 1 of 3 · Provide foundational garden info.
                </p>
              )}
              {isTeamStep && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step 2 of 3 · Invite gardeners and optional operators.
                </p>
              )}
              {isReviewStep && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Step 3 of 3 · Review details before deploying.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {currentStep > 0 && (
                <button
                  onClick={handleBack}
                  className="flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <RiArrowLeftLine className="h-4 w-4" /> Back
                </button>
              )}
              {!isReviewStep && (
                <button
                  onClick={handleNext}
                  className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400"
                >
                  Continue
                </button>
              )}
              {isReviewStep && (
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className={cn(
                    "flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-400",
                    isSubmitting && "cursor-not-allowed bg-green-400 dark:bg-green-400/70"
                  )}
                >
                  {isSubmitting ? (
                    <>
                      <RiLoader4Line className="h-4 w-4 animate-spin" /> Deploying…
                    </>
                  ) : (
                    "Deploy garden"
                  )}
                </button>
              )}
              <button
                onClick={handleCancel}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-white dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
