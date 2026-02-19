import {
  gardenStepFields,
  toastService,
  useCreateGardenForm,
  useCreateGardenStore,
  useCreateGardenWorkflow,
  useOffline,
} from "@green-goods/shared";
import * as Dialog from "@radix-ui/react-dialog";
import { RiCloseLine, RiErrorWarningLine, RiLoader4Line } from "@remixicon/react";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";
import { FormWizard } from "@/components/Form/FormWizard";
import { DetailsStep } from "@/components/Garden/CreateGardenSteps/DetailsStep";
import { ReviewStep } from "@/components/Garden/CreateGardenSteps/ReviewStep";
import { TeamStep } from "@/components/Garden/CreateGardenSteps/TeamStep";

export default function CreateGarden() {
  const intl = useIntl();
  const navigate = useNavigate();
  const steps = useCreateGardenStore((state) => state.steps);
  const currentStep = useCreateGardenStore((state) => state.currentStep);
  const form = useCreateGardenStore((state) => state.form);
  const resetForm = useCreateGardenStore((state) => state.reset);
  const { isOnline } = useOffline();
  const { trigger, reset: resetValidationForm } = useCreateGardenForm();

  const {
    state,
    openFlow,
    closeFlow,
    goNext,
    goBack,
    submitCreation,
    estimateCreationCost,
    retry,
  } = useCreateGardenWorkflow();

  const [showValidation, setShowValidation] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<{
    txFeeEth: string;
    ccipFeeEth: string;
    totalEth: string;
  } | null>(null);

  const isSubmitting = state.value === "submitting";
  const hasError = state.value === "error";
  const isSuccess = state.value === "success";

  useEffect(() => {
    openFlow();
  }, [openFlow]);

  useEffect(() => {
    if (isSuccess) {
      toastService.success({
        title: intl.formatMessage({
          id: "admin.garden.created.title",
          defaultMessage: "Garden created",
        }),
        message: intl.formatMessage({
          id: "admin.garden.created.message",
          defaultMessage: "Your garden has been deployed successfully",
        }),
        context: "garden creation",
        suppressLogging: true,
      });
      resetForm();
      navigate("/gardens");
    }
  }, [isSuccess, navigate, resetForm, intl]);

  useEffect(() => {
    setShowValidation(false);
  }, [currentStep]);

  useEffect(() => {
    resetValidationForm(form);
  }, [form, resetValidationForm]);

  const handleNext = async () => {
    setShowValidation(true);
    const currentStepId = steps[currentStep]?.id;
    if (currentStepId && currentStepId !== "review") {
      const fields = gardenStepFields[currentStepId];
      const isStepValid = await trigger([...fields], { shouldFocus: true });
      if (!isStepValid) return;
    }
    goNext();
  };

  const handleBack = () => {
    setShowValidation(false);
    goBack();
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    const isFormValid = await trigger(undefined, { shouldFocus: true });
    if (!isFormValid) return;

    if (!isOnline) {
      toastService.error({
        title: intl.formatMessage({
          id: "app.admin.garden.create.offline.title",
          defaultMessage: "You're offline",
        }),
        message: intl.formatMessage({
          id: "app.admin.garden.create.offline.message",
          defaultMessage: "Reconnect to the internet before deploying this garden.",
        }),
        context: "garden creation",
      });
      return;
    }

    setShowConfirmDialog(true);
    setIsEstimating(true);
    setEstimateError(null);

    try {
      const estimate = await estimateCreationCost();
      setFeeEstimate(estimate.formatted);
    } catch (error) {
      setFeeEstimate(null);
      setEstimateError(
        error instanceof Error
          ? error.message
          : intl.formatMessage({
              id: "app.admin.garden.create.confirm.estimateFallback",
              defaultMessage: "Unable to estimate deployment gas right now.",
            })
      );
    } finally {
      setIsEstimating(false);
    }
  };

  const handleConfirmDeploy = () => {
    setShowConfirmDialog(false);
    submitCreation();
  };

  const handleCancel = () => {
    closeFlow();
    navigate("/gardens");
  };

  const currentStepConfig = steps[currentStep];
  const isDetailsStep = currentStepConfig?.id === "details";
  const isTeamStep = currentStepConfig?.id === "team";
  const isReviewStepActive = currentStepConfig?.id === "review";

  return (
    <>
      {hasError && (
        <div className="fixed inset-x-0 top-[120px] z-20 mx-auto max-w-4xl px-4 sm:px-6">
          <div className="flex items-start gap-3 rounded-lg border border-error-light bg-error-lighter p-4 text-sm text-error-dark shadow-lg">
            <RiErrorWarningLine className="mt-0.5 h-5 w-5 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-error-dark">
                {intl.formatMessage({
                  id: "admin.garden.deploy.error.title",
                  defaultMessage: "We couldn't deploy the garden",
                })}
              </p>
              <p className="mt-1 text-error-dark/80">
                {state.context.error ??
                  intl.formatMessage({
                    id: "admin.garden.deploy.error.fallback",
                    defaultMessage: "Please review the details and try again.",
                  })}
              </p>
              <button
                onClick={retry}
                className="mt-3 rounded-md border border-error-light px-3 py-1.5 text-xs font-medium text-error-dark transition hover:bg-error-lighter"
              >
                {intl.formatMessage({
                  id: "admin.garden.deploy.retry",
                  defaultMessage: "Retry deployment",
                })}
              </button>
            </div>
          </div>
        </div>
      )}

      <FormWizard
        steps={steps}
        currentStep={currentStep}
        onNext={handleNext}
        onBack={handleBack}
        onCancel={handleCancel}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
        nextLabel={intl.formatMessage({
          id: "admin.garden.form.continue",
          defaultMessage: "Continue",
        })}
        submitLabel={intl.formatMessage({
          id: "admin.garden.form.deploy",
          defaultMessage: "Deploy garden",
        })}
      >
        {isDetailsStep && <DetailsStep showValidation={showValidation} />}
        {isTeamStep && <TeamStep showValidation={showValidation} />}
        {isReviewStepActive && <ReviewStep />}
      </FormWizard>

      <Dialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[92vw] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border border-stroke-soft bg-bg-strong p-5 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-2">
              <div>
                <Dialog.Title className="text-lg font-semibold text-text-strong">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.title",
                    defaultMessage: "Confirm garden deployment",
                  })}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-text-soft">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.description",
                    defaultMessage: "Review the summary and estimated gas cost before deploying.",
                  })}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button className="rounded-md p-1 text-text-soft hover:bg-bg-weak">
                  <RiCloseLine className="h-5 w-5" />
                </button>
              </Dialog.Close>
            </div>

            <div className="space-y-3 rounded-lg bg-bg-weak p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-text-soft">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.name",
                    defaultMessage: "Garden name",
                  })}
                </span>
                <span className="font-medium text-text-strong">{form.name}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-soft">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.slug",
                    defaultMessage: "ENS subdomain",
                  })}
                </span>
                <span className="font-mono text-xs text-text-strong">
                  {form.slug}.greengoods.eth
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text-soft">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.members",
                    defaultMessage: "Team members",
                  })}
                </span>
                <span className="font-medium text-text-strong">
                  {form.gardeners.length + form.operators.length}
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-stroke-soft p-3 text-sm">
              {isEstimating ? (
                <div className="flex items-center gap-2 text-text-soft">
                  <RiLoader4Line className="h-4 w-4 animate-spin" />
                  <span>
                    {intl.formatMessage({
                      id: "app.admin.garden.create.confirm.estimating",
                      defaultMessage: "Estimating gas...",
                    })}
                  </span>
                </div>
              ) : estimateError ? (
                <p className="text-error-base">{estimateError}</p>
              ) : feeEstimate ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-text-soft">
                      {intl.formatMessage({
                        id: "app.admin.garden.create.confirm.gasFee",
                        defaultMessage: "Estimated gas fee",
                      })}
                    </span>
                    <span className="font-mono text-xs text-text-strong">
                      {feeEstimate.txFeeEth} ETH
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-text-soft">
                      {intl.formatMessage({
                        id: "app.admin.garden.create.confirm.ensFee",
                        defaultMessage: "ENS registration fee",
                      })}
                    </span>
                    <span className="font-mono text-xs text-text-strong">
                      {feeEstimate.ccipFeeEth} ETH
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between border-t border-stroke-soft pt-2">
                    <span className="font-medium text-text-strong">
                      {intl.formatMessage({
                        id: "app.admin.garden.create.confirm.total",
                        defaultMessage: "Estimated total",
                      })}
                    </span>
                    <span className="font-mono text-sm font-semibold text-text-strong">
                      {feeEstimate.totalEth} ETH
                    </span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <Dialog.Close asChild>
                <button className="rounded-md border border-stroke-soft px-3 py-2 text-sm text-text-sub hover:bg-bg-weak">
                  {intl.formatMessage({
                    id: "app.admin.garden.create.confirm.cancel",
                    defaultMessage: "Cancel",
                  })}
                </button>
              </Dialog.Close>
              <button
                onClick={handleConfirmDeploy}
                disabled={isSubmitting || isEstimating || Boolean(estimateError)}
                className="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {intl.formatMessage({
                  id: "app.admin.garden.create.confirm.deploy",
                  defaultMessage: "Confirm and deploy",
                })}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
