// Command surface: a signed request with a clear target, review and explicit outcome.
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  type StewardAccessRequestController,
  useStewardAccessRequestController,
} from "@green-goods/shared/hooks/admin-ui/layout/useStewardAccessRequestController";
import { gardenJoinRequestErrorMessage } from "@green-goods/shared/modules/garden-join-requests";
import { GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH } from "@green-goods/shared/public-contracts/join-requests";
import { RiSeedlingLine } from "@remixicon/react";
import { useRef } from "react";
import { useIntl } from "react-intl";
import { AdminButton } from "../AdminButton";
import { AdminDialog } from "../AdminDialog";
import { AdminTextArea, AdminTextField } from "../AdminTextField";

export function StewardAccessRequest({
  controller,
  showStatus = false,
}: {
  controller: StewardAccessRequestController;
  showStatus?: boolean;
}) {
  const { formatMessage } = useIntl();
  const c = controller;
  const opener = useRef<HTMLButtonElement>(null);
  const request = c.request;
  const statusView = Boolean(
    request && (request.state === "welcomed" || !request.canAskAgain) && c.step === "review"
  );
  const action = (operation: () => Promise<unknown>) => {
    void operation().catch(() => undefined);
  };
  const statusLabel = request
    ? formatMessage({ id: `cockpit.stewardAccess.status.${request.state}` })
    : "";
  const actions = !c.available ? (
    <AdminButton variant="outlined" onClick={() => c.setOpen(false)}>
      {formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
    </AdminButton>
  ) : statusView ? (
    <>
      {request?.state === "pending" ? (
        <AdminButton
          variant="outlined"
          disabled={c.busy}
          loading={c.activity === "withdrawing"}
          onClick={() => action(c.withdraw)}
        >
          {formatMessage({ id: "cockpit.stewardAccess.withdraw" })}
        </AdminButton>
      ) : null}
      <AdminButton
        disabled={c.busy}
        loading={c.activity === "checking"}
        onClick={() => action(c.check)}
      >
        {formatMessage({ id: "cockpit.stewardAccess.checkStatus" })}
      </AdminButton>
    </>
  ) : c.step === "review" && c.selectedGarden ? (
    <>
      <AdminButton variant="outlined" disabled={c.busy} onClick={() => c.setStep("choose")}>
        {formatMessage({ id: "cockpit.stewardAccess.changeGarden" })}
      </AdminButton>
      <AdminButton
        disabled={c.busy || c.outcomeUnknown || !c.accountAddress}
        loading={c.activity === "sending"}
        onClick={() => action(c.send)}
      >
        {formatMessage({ id: "cockpit.stewardAccess.send" })}
      </AdminButton>
    </>
  ) : (
    <AdminButton variant="outlined" disabled={c.busy} onClick={() => c.setOpen(false)}>
      {formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
    </AdminButton>
  );
  return (
    <div className="space-y-3" data-component="StewardAccessRequest">
      {showStatus && request && c.selectedGarden ? (
        <div className="space-y-2 text-left" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="body-sm font-semibold text-text-strong">{c.selectedGarden.name}</p>
            <StatusBadge variant={request.state === "welcomed" ? "success" : "neutral"}>
              {statusLabel}
            </StatusBadge>
          </div>
          <p className="body-sm text-text-sub">
            {formatMessage({ id: `cockpit.stewardAccess.outcome.${request.state}` })}
          </p>
        </div>
      ) : null}
      <AdminButton
        ref={opener}
        variant={showStatus ? "filled" : "outlined"}
        onClick={() => {
          if (request && c.selectedGarden) c.setStep("review");
          c.setOpen(true);
        }}
      >
        {formatMessage({
          id: request ? "cockpit.stewardAccess.viewRequest" : "cockpit.stewardAccess.request",
        })}
      </AdminButton>
      <AdminDialog
        open={c.open}
        onOpenChange={c.setOpen}
        title={formatMessage({ id: "cockpit.stewardAccess.request" })}
        description={formatMessage({ id: "cockpit.stewardAccess.description" })}
        target={
          <span className="block truncate" title={c.selectedGarden?.name}>
            {c.selectedGarden?.name ?? formatMessage({ id: "cockpit.gardenChip.selectGarden" })}
          </span>
        }
        size="md"
        height="stable"
        tone="home"
        preventClose={c.busy}
        actions={actions}
        actionsClassName="min-h-[calc(8rem+env(safe-area-inset-bottom))] sm:min-h-20"
        finalFocusRef={opener}
      >
        <div
          className={
            c.available && c.step === "choose" ? "flex h-full min-h-0 flex-col gap-4" : "space-y-4"
          }
        >
          {!c.available ? (
            <>
              {c.serviceLoading ? (
                <p role="status" className="body-sm text-text-sub">
                  {formatMessage({ id: "cockpit.stewardAccess.checkingAvailability" })}
                </p>
              ) : (
                <>
                  <Alert
                    variant="warning"
                    action={
                      c.serviceError ? (
                        <AdminButton
                          variant="outlined"
                          size="sm"
                          onClick={() => void c.retryAvailability()}
                        >
                          {formatMessage({ id: "app.common.retry", defaultMessage: "Retry" })}
                        </AdminButton>
                      ) : undefined
                    }
                  >
                    {formatMessage({
                      id: c.serviceError
                        ? "cockpit.stewardAccess.availabilityError"
                        : "cockpit.stewardAccess.unavailable",
                    })}
                  </Alert>
                  {c.accountAddress ? (
                    <AddressDisplay address={c.accountAddress} showCopyButton />
                  ) : null}
                </>
              )}
            </>
          ) : statusView ? (
            <div className="space-y-3" aria-live="polite">
              <StatusBadge variant={request?.state === "welcomed" ? "success" : "neutral"}>
                {statusLabel}
              </StatusBadge>
              <p className="body-sm text-text-sub">
                {formatMessage({ id: `cockpit.stewardAccess.outcome.${request?.state}` })}
              </p>
              {request?.reason ? (
                <p className="whitespace-pre-wrap body-sm text-text-strong">{request.reason}</p>
              ) : null}
              <AdminButton
                variant="text"
                size="sm"
                disabled={c.busy}
                onClick={() => c.setStep("choose")}
              >
                {formatMessage({ id: "cockpit.stewardAccess.changeGarden" })}
              </AdminButton>
            </div>
          ) : c.step === "choose" ? (
            <>
              <div className="shrink-0">
                <AdminTextField
                  label={formatMessage({ id: "cockpit.stewardAccess.gardenSearch" })}
                  value={c.search}
                  onChange={(event) => c.setSearch(event.currentTarget.value)}
                  helperText={formatMessage({ id: "cockpit.stewardAccess.gardenSearchHelp" })}
                />
              </div>
              {c.catalogLoading ? (
                <p role="status" className="body-sm text-text-sub">
                  {formatMessage({ id: "cockpit.stewardAccess.loadingGardens" })}
                </p>
              ) : c.catalogError ? (
                <Alert
                  variant="error"
                  action={
                    <AdminButton
                      variant="outlined"
                      size="sm"
                      onClick={() => void c.reloadGardens()}
                    >
                      {formatMessage({ id: "app.common.retry", defaultMessage: "Retry" })}
                    </AdminButton>
                  }
                >
                  {formatMessage({ id: "cockpit.stewardAccess.gardensError" })}
                </Alert>
              ) : c.candidates.length === 0 ? (
                <p role="status" className="body-sm text-text-sub">
                  {formatMessage({
                    id: c.invalidLink
                      ? "cockpit.stewardAccess.invalidLink"
                      : "cockpit.stewardAccess.noGardens",
                  })}
                </p>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-stroke-soft overflow-y-auto">
                  {c.candidates.map((garden) => (
                    <li key={garden.id}>
                      <AdminButton
                        variant="text"
                        onClick={() => c.selectGarden(garden)}
                        className="h-auto min-h-11 w-full justify-start gap-3 whitespace-normal rounded-[var(--m3-shape-sm)] px-3 py-3 text-left"
                      >
                        <RiSeedlingLine
                          className="h-5 w-5 shrink-0 text-text-sub"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block body-sm font-semibold text-text-strong">
                            {garden.name}
                          </span>
                          <span className="block body-sm text-text-sub">{garden.location}</span>
                        </span>
                      </AdminButton>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : c.selectedGarden ? (
            <>
              <section className="space-y-2">
                <h3 className="body-sm font-semibold text-text-strong">
                  {formatMessage({ id: "cockpit.stewardAccess.reviewTitle" })}
                </h3>
                <p className="body-sm text-text-sub">
                  {formatMessage({ id: "cockpit.stewardAccess.account" })}
                </p>
                {c.accountAddress ? (
                  <AddressDisplay address={c.accountAddress} showCopyButton />
                ) : null}
              </section>
              <AdminTextArea
                label={formatMessage({ id: "cockpit.stewardAccess.note" })}
                value={c.note}
                onChange={(event) => c.setNote(event.currentTarget.value)}
                textareaProps={{ maxLength: GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH }}
                showCount
                helperText={formatMessage({ id: "cockpit.stewardAccess.noteHelp" })}
              />
              <p className="body-sm text-text-sub">
                {formatMessage({ id: "cockpit.stewardAccess.signingHelp" })}
              </p>
              <AdminButton
                variant="text"
                size="sm"
                disabled={c.busy}
                loading={c.activity === "checking"}
                onClick={() => action(c.check)}
              >
                {formatMessage({ id: "cockpit.stewardAccess.checkStatus" })}
              </AdminButton>
              {c.hasCheckedStatus && !request ? (
                <p role="status" className="body-sm text-text-sub">
                  {formatMessage({ id: "cockpit.stewardAccess.noRequest" })}
                </p>
              ) : null}
            </>
          ) : null}
          {request?.state === "declined" && request.canAskAgain ? (
            <Alert variant="info">
              {formatMessage({ id: "cockpit.stewardAccess.outcome.declined" })}
              {request.reason ? ` ${request.reason}` : ""}
            </Alert>
          ) : null}
          {c.outcomeUnknown ? (
            <Alert variant="warning">
              {formatMessage({ id: "cockpit.stewardAccess.outcomeUnknown" })}
            </Alert>
          ) : null}
          {c.error ? (
            <Alert variant="error">{formatMessage(gardenJoinRequestErrorMessage(c.error))}</Alert>
          ) : null}
        </div>
      </AdminDialog>
    </div>
  );
}

export function StewardAccessRequestContainer({ showStatus = false }: { showStatus?: boolean }) {
  const controller = useStewardAccessRequestController(
    showStatus ? "admin_access" : "account_profile"
  );
  return <StewardAccessRequest controller={controller} showStatus={showStatus} />;
}
