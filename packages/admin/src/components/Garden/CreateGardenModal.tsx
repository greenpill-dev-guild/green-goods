import { Fragment, useEffect, useMemo, useState } from "react";
import {
  RiAddLine,
  RiArrowLeftLine,
  RiCheckboxCircleLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiErrorWarningLine,
  RiLoader4Line,
} from "@remixicon/react";

import { useCreateGardenWorkflow } from "@/hooks/useCreateGardenWorkflow";
import { ADDRESS_REGEX, useCreateGardenStore, isValidAddress } from "@/stores/createGarden";
import { cn } from "@/utils/cn";

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

  useEffect(() => {
    if (isOpen) {
      openFlow();
      setGardenerInput("");
      setOperatorInput("");
      setGardenerError(null);
      setOperatorError(null);
      setShowValidation(false);
    } else {
      closeFlow();
    }
  }, [isOpen, openFlow, closeFlow]);

  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  const closeModal = () => {
    closeFlow();
    onClose();
  };

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
    createAnother();
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 backdrop-blur-sm">
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Deploy a new garden</h2>
              <p className="text-sm text-gray-500">
                Guide your community through a streamlined garden launch flow.
              </p>
            </div>
            <button
              onClick={closeModal}
              className="rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Close create garden modal"
            >
              <RiCloseLine className="h-5 w-5" />
            </button>
          </div>

          {steps.length > 0 && !isSuccess && (
            <ol className="flex items-center justify-between gap-2 border-b border-gray-100 px-6 py-4 text-sm">
              {steps.map((step, index) => {
                const completed = index < currentStep;
                const active = index === currentStep;
                return (
                  <li key={step.id} className="flex flex-1 items-center gap-3">
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full border text-xs font-medium",
                        completed && "border-green-600 bg-green-50 text-green-600",
                        active && !completed && "border-green-600 bg-white text-green-600",
                        !completed && !active && "border-gray-200 text-gray-400"
                      )}
                    >
                      {completed ? <RiCheckboxCircleLine className="h-4 w-4" /> : index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{step.title}</p>
                      <p className="text-xs text-gray-500">{step.description}</p>
                    </div>
                    {index < steps.length - 1 && (
                      <span className="ml-auto h-px flex-1 bg-gray-200" />
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          <div className="space-y-6 px-6 py-6">
            {hasError && (
              <div className="flex items-start gap-3 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
                <RiErrorWarningLine className="mt-0.5 h-5 w-5" />
                <div>
                  <p className="font-medium">We couldn't deploy the garden</p>
                  <p className="mt-1 text-red-600">
                    {state.context.error ?? "Please review the details and try again."}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={retry}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
                    >
                      Retry deployment
                    </button>
                    <button
                      onClick={() => {
                        setShowValidation(false);
                        edit();
                      }}
                      className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-100"
                    >
                      Edit details
                    </button>
                  </div>
                </div>
              </div>
            )}

            {isSuccess ? (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 text-green-600">
                  <RiCheckboxCircleLine className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    Garden deployment submitted
                  </h3>
                  <p className="mt-2 text-sm text-gray-600">
                    The transaction hash is{" "}
                    <span className="font-mono text-xs">{state.context.txHash}</span>. Share the
                    link with your community while the attestation confirms on-chain.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    onClick={handleCreateAnother}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    Launch another garden
                  </button>
                  <button
                    onClick={closeModal}
                    className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
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
                      <h3 className="text-base font-semibold text-gray-900">Garden profile</h3>
                      <p className="text-sm text-gray-500">
                        Tell us where the garden lives and how to describe it.
                      </p>
                    </section>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-gray-700">Garden name *</span>
                        <input
                          value={form.name}
                          onChange={(event) => setField("name", event.target.value)}
                          placeholder="eg. Rio rainforest lab"
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200",
                            showDetailsErrors &&
                              detailsErrors.name &&
                              "border-red-300 focus:border-red-400 focus:ring-red-100"
                          )}
                        />
                        {showDetailsErrors && detailsErrors.name && (
                          <span className="text-xs text-red-600">{detailsErrors.name}</span>
                        )}
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-gray-700">Location *</span>
                        <input
                          value={form.location}
                          onChange={(event) => setField("location", event.target.value)}
                          placeholder="City, country or coordinates"
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200",
                            showDetailsErrors &&
                              detailsErrors.location &&
                              "border-red-300 focus:border-red-400 focus:ring-red-100"
                          )}
                        />
                        {showDetailsErrors && detailsErrors.location && (
                          <span className="text-xs text-red-600">{detailsErrors.location}</span>
                        )}
                      </label>
                    </div>
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-gray-700">Description *</span>
                      <textarea
                        value={form.description}
                        onChange={(event) => setField("description", event.target.value)}
                        placeholder="Share the story, mission and unique traits of the garden."
                        rows={4}
                        className={cn(
                          "w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200",
                          showDetailsErrors &&
                            detailsErrors.description &&
                            "border-red-300 focus:border-red-400 focus:ring-red-100"
                        )}
                      />
                      {showDetailsErrors && detailsErrors.description && (
                        <span className="text-xs text-red-600">{detailsErrors.description}</span>
                      )}
                    </label>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-gray-700">Community token address *</span>
                        <input
                          value={form.communityToken}
                          onChange={(event) => setField("communityToken", event.target.value)}
                          placeholder="0x..."
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200",
                            showDetailsErrors &&
                              detailsErrors.communityToken &&
                              "border-red-300 focus:border-red-400 focus:ring-red-100"
                          )}
                        />
                        <span className="text-xs text-gray-500">
                          Must match the ERC-20 token powering the community.
                        </span>
                        {showDetailsErrors && detailsErrors.communityToken && (
                          <span className="text-xs text-red-600">
                            {detailsErrors.communityToken}
                          </span>
                        )}
                      </label>
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-gray-700">Banner image URL</span>
                        <input
                          value={form.bannerImage}
                          onChange={(event) => setField("bannerImage", event.target.value)}
                          placeholder="https://cdn.green-goods..."
                          className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                        />
                        <span className="text-xs text-gray-500">
                          Optional link to a hero image showcasing the garden.
                        </span>
                      </label>
                    </div>
                  </div>
                )}

                {isTeamStep && (
                  <div className="space-y-5">
                    <section>
                      <h3 className="text-base font-semibold text-gray-900">Community stewards</h3>
                      <p className="text-sm text-gray-500">
                        Add wallets that can tend to the garden and coordinate future work.
                        Gardeners mint attestations and operators oversee approvals.
                      </p>
                    </section>

                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Gardeners *
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            value={gardenerInput}
                            onChange={(event) => setGardenerInput(event.target.value)}
                            placeholder="0x..."
                            className="flex-1 rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                          <button
                            type="button"
                            onClick={handleAddGardener}
                            className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                          >
                            <RiAddLine className="h-4 w-4" /> Add
                          </button>
                        </div>
                        {gardenerError && (
                          <p className="mt-1 text-xs text-red-600">{gardenerError}</p>
                        )}
                        {showTeamErrors && teamError && (
                          <p className="mt-1 text-xs text-red-600">{teamError}</p>
                        )}
                        <ul className="mt-3 space-y-2">
                          {form.gardeners.map((gardener, index) => (
                            <li
                              key={`${gardener}-${index}`}
                              className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700"
                            >
                              <span>{gardener}</span>
                              <button
                                type="button"
                                onClick={() => removeGardener(index)}
                                className="rounded-md p-1 text-gray-400 transition hover:bg-white hover:text-red-600"
                              >
                                <RiDeleteBinLine className="h-4 w-4" />
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">
                          Garden operators
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            value={operatorInput}
                            onChange={(event) => setOperatorInput(event.target.value)}
                            placeholder="0x..."
                            className="flex-1 rounded-md border px-3 py-2 text-sm font-mono shadow-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                          />
                          <button
                            type="button"
                            onClick={handleAddOperator}
                            className="flex items-center gap-1 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
                          >
                            <RiAddLine className="h-4 w-4" /> Add
                          </button>
                        </div>
                        {operatorError && (
                          <p className="mt-1 text-xs text-red-600">{operatorError}</p>
                        )}
                        <ul className="mt-3 space-y-2">
                          {form.operators.map((operator, index) => (
                            <li
                              key={`${operator}-${index}`}
                              className="flex items-center justify-between rounded-md border border-gray-100 bg-gray-50 px-3 py-2 text-xs font-mono text-gray-700"
                            >
                              <span>{operator}</span>
                              <button
                                type="button"
                                onClick={() => removeOperator(index)}
                                className="rounded-md p-1 text-gray-400 transition hover:bg-white hover:text-red-600"
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
                      <h3 className="text-base font-semibold text-gray-900">Review deployment</h3>
                      <p className="text-sm text-gray-500">
                        Double-check the on-chain data before sending the attestation transaction.
                      </p>
                    </section>
                    <div className="space-y-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Garden name
                          </h4>
                          <p className="mt-1 text-sm text-gray-900">{form.name}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Location
                          </h4>
                          <p className="mt-1 text-sm text-gray-900">{form.location}</p>
                        </div>
                        <div className="md:col-span-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Description
                          </h4>
                          <p className="mt-1 text-sm text-gray-900">{form.description}</p>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Community token
                          </h4>
                          <p className="mt-1 font-mono text-xs text-gray-900">
                            {form.communityToken}
                          </p>
                          {!ADDRESS_REGEX.test(form.communityToken.trim()) && (
                            <p className="mt-1 text-xs text-red-600">
                              The address doesn't look valid.
                            </p>
                          )}
                        </div>
                        {form.bannerImage && (
                          <div>
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Banner image
                            </h4>
                            <p className="mt-1 break-words text-sm text-gray-900">
                              {form.bannerImage}
                            </p>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Gardeners
                          </h4>
                          <ul className="mt-2 space-y-1">
                            {form.gardeners.map((gardener) => (
                              <li key={gardener} className="font-mono text-xs text-gray-900">
                                {gardener}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Operators
                          </h4>
                          {form.operators.length === 0 ? (
                            <p className="mt-2 text-xs text-gray-500">No operators assigned yet.</p>
                          ) : (
                            <ul className="mt-2 space-y-1">
                              {form.operators.map((operator) => (
                                <li key={operator} className="font-mono text-xs text-gray-900">
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
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
              <div>
                {isDetailsStep && (
                  <p className="text-xs text-gray-500">
                    Step 1 of 3 · Provide foundational garden info.
                  </p>
                )}
                {isTeamStep && (
                  <p className="text-xs text-gray-500">
                    Step 2 of 3 · Invite gardeners and optional operators.
                  </p>
                )}
                {isReviewStep && (
                  <p className="text-xs text-gray-500">
                    Step 3 of 3 · Review details before deploying.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {currentStep > 0 && (
                  <button
                    onClick={handleBack}
                    className="flex items-center gap-1 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-white"
                  >
                    <RiArrowLeftLine className="h-4 w-4" /> Back
                  </button>
                )}
                {!isReviewStep && (
                  <button
                    onClick={handleNext}
                    className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700"
                  >
                    Continue
                  </button>
                )}
                {isReviewStep && (
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={cn(
                      "flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-green-700",
                      isSubmitting && "cursor-not-allowed bg-green-400"
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
                {!isReviewStep && (
                  <button
                    onClick={closeModal}
                    className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-white"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
