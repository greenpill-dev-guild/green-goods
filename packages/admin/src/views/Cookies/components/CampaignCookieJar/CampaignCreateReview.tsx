import { AdminButton } from "@/components/AdminButton";
import { AdminCard } from "@/components/AdminCard";
import { ReviewLine } from "./ReviewLine";
import type { CampaignCookieJarCreateFormProps } from "./CampaignCookieJarCreateForm";

export function CampaignCreateReview(props: CampaignCookieJarCreateFormProps) {
  const {
    formatMessage,
    payoutLabel,
    aggregation,
    publicCampaignUrl,
    canCreate,
    createPending,
    gardensLoading,
    factoryLoading,
    onCreate,
    onCancel,
    createError,
  } = props;
  return (
    <>
      <aside className="sticky top-20 hidden space-y-4 lg:block">
        <AdminCard variant="outlined" className="space-y-2">
          <h2 className="text-title-md font-semibold text-[rgb(var(--m3-on-surface))]">
            {formatMessage({
              id: "cockpit.community.cookies.review",
              defaultMessage: "Review",
            })}
          </h2>
          <ReviewLine
            label={formatMessage({
              id: "cockpit.community.cookies.reviewPayout",
              defaultMessage: "Payout",
            })}
            value={payoutLabel}
          />
          <ReviewLine
            label={formatMessage({
              id: "cockpit.community.cookies.selectedGardens",
              defaultMessage: "Selected gardens",
            })}
            value={aggregation.sources.length}
          />
          <ReviewLine
            label={formatMessage({
              id: "cockpit.community.cookies.generatedOperators",
              defaultMessage: "Generated operators",
            })}
            value={aggregation.allowlist.length}
          />
          <ReviewLine
            label={formatMessage({
              id: "cockpit.community.cookies.missingOperators",
              defaultMessage: "Missing operators",
            })}
            value={aggregation.missingOperatorGardens.length}
          />
          <ReviewLine
            label={formatMessage({
              id: "cockpit.community.cookies.generatedCampaignLink",
              defaultMessage: "Campaign page",
            })}
            value={publicCampaignUrl}
          />
          <div className="pt-3">
            <AdminButton
              type="button"
              className="w-full"
              onClick={onCreate}
              disabled={!canCreate || createPending || gardensLoading || factoryLoading}
              loading={createPending}
            >
              {formatMessage({
                id: "cockpit.community.cookies.create",
                defaultMessage: "Create cookie jar",
              })}
            </AdminButton>
            <AdminButton type="button" variant="text" className="mt-2 w-full" onClick={onCancel}>
              {formatMessage({ id: "app.common.cancel", defaultMessage: "Cancel" })}
            </AdminButton>
          </div>
          {createError ? (
            <p className="text-body-sm text-[rgb(var(--m3-error))]">{createError.message}</p>
          ) : null}
        </AdminCard>
      </aside>

      <div className="fixed inset-x-0 bottom-[calc(80px+env(safe-area-inset-bottom))] z-sticky border-t border-[rgb(var(--m3-outline-variant))] bg-[rgb(var(--m3-surface-container-high))] p-3 shadow-[var(--m3-elevation-2)] lg:hidden">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-label-md font-semibold text-[rgb(var(--m3-on-surface))]">
              {payoutLabel}
            </p>
            <p className="text-label-sm text-[rgb(var(--m3-on-surface-variant))]">
              {formatMessage(
                {
                  id: "cockpit.community.cookies.mobileReviewSummary",
                  defaultMessage:
                    "{gardens, plural, one {# garden} other {# gardens}} - {operators, plural, one {# operator} other {# operators}}",
                },
                { gardens: aggregation.sources.length, operators: aggregation.allowlist.length }
              )}
            </p>
          </div>
          <AdminButton
            type="button"
            onClick={onCreate}
            disabled={!canCreate || createPending || gardensLoading || factoryLoading}
            loading={createPending}
          >
            {formatMessage({
              id: "cockpit.community.cookies.create",
              defaultMessage: "Create cookie jar",
            })}
          </AdminButton>
        </div>
      </div>
    </>
  );
}
