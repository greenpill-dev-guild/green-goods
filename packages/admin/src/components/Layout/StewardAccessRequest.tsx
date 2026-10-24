// Command surface: a signed request with a clear target, review and explicit outcome.
import { AddressDisplay } from "@green-goods/shared/components/AddressDisplay";
import { Alert } from "@green-goods/shared/components/Alert";
import { Button } from "@green-goods/shared/components/Button";
import { EmptyState } from "@green-goods/shared/components/ListPrimitives";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import {
  type StewardAccessRequestController,
  useStewardAccessRequestController,
} from "@green-goods/shared/hooks/admin-ui/layout/useStewardAccessRequestController";
import { gardenJoinRequestErrorMessage } from "@green-goods/shared/modules/garden-join-requests";
import { GARDEN_JOIN_REQUEST_NOTE_MAX_LENGTH } from "@green-goods/shared/public-contracts/join-requests";
import { RiErrorWarningLine, RiLoader4Line, RiSeedlingLine } from "@remixicon/react";
import { useRef } from "react";
import { useIntl } from "react-intl";
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
    <Button type="button" emphasis="secondary" size="lg" onClick={() => c.setOpen(false)}>
      {formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
    </Button>
  ) : statusView ? (
    <>
      {request?.state === "pending" ? (
        <Button
          type="button"
          emphasis="secondary"
          size="lg"
          disabled={c.busy}
          loading={c.activity === "withdrawing"}
          onClick={() => action(c.withdraw)}
        >
          {formatMessage({ id: "cockpit.stewardAccess.withdraw" })}
        </Button>
      ) : null}
      <Button
        type="button"
        size="lg"
        disabled={c.busy}
        loading={c.activity === "checking"}
        onClick={() => action(c.check)}
      >
        {formatMessage({ id: "cockpit.stewardAccess.checkStatus" })}
      </Button>
    </>
  ) : c.step === "review" && c.selectedGarden ? (
    <>
      <Button
        type="button"
        emphasis="secondary"
        size="lg"
        disabled={c.busy}
        onClick={() => c.setStep("choose")}
      >
        {formatMessage({ id: "cockpit.stewardAccess.changeGarden" })}
      </Button>
      <Button
        type="button"
        size="lg"
        disabled={c.busy || c.outcomeUnknown || !c.accountAddress}
        loading={c.activity === "sending"}
        onClick={() => action(c.send)}
      >
        {formatMessage({ id: "cockpit.stewardAccess.send" })}
      </Button>
    </>
  ) : (
    <Button
      type="button"
      emphasis="secondary"
      size="lg"
      disabled={c.busy}
      onClick={() => c.setOpen(false)}
    >
      {formatMessage({ id: "app.common.close", defaultMessage: "Close" })}
    </Button>
  );
  return (
    <div className="space-y-3" data-component="StewardAccessRequest">
      {showStatus && request && c.selectedGarden ? (
        <div className="space-y-2 text-left" aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="type-body font-semibold text-text-strong">{c.selectedGarden.name}</p>
            <StatusBadge variant={request.state === "welcomed" ? "success" : "neutral"}>
              {statusLabel}
            </StatusBadge>
          </div>
          <p className="type-body text-text-sub">
            {formatMessage({ id: `cockpit.stewardAccess.outcome.${request.state}` })}
          </p>
        </div>
      ) : null}
      <Button
        ref={opener}
        type="button"
        emphasis={showStatus ? "primary" : "secondary"}
        size="sm"
        onClick={() => {
          if (request && c.selectedGarden) c.setStep("review");
          c.setOpen(true);
        }}
      >
        {formatMessage({
          id: request ? "cockpit.stewardAccess.viewRequest" : "cockpit.stewardAccess.request",
        })}
      </Button>
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
        sheetSize="tall"
        tone="home"
        preventClose={c.busy}
        actions={actions}
        actionsClassName="min-h-[calc(4rem+env(safe-area-inset-bottom))] flex-row items-center justify-end bg-transparent [&>button]:min-w-0 [&>button]:flex-1 [&>button]:max-h-none [&>button]:whitespace-normal [&>button]:px-3 [&>button]:py-0 [&>button]:leading-tight sm:[&>button]:flex-none sm:[&>button]:whitespace-nowrap sm:[&>button]:px-5"
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
                <p role="status" className="type-body text-text-sub">
                  {formatMessage({ id: "cockpit.stewardAccess.checkingAvailability" })}
                </p>
              ) : (
                <>
                  <Alert
                    variant="warning"
                    action={
                      c.serviceError ? (
                        <Button
                          type="button"
                          emphasis="secondary"
                          size="compact"
                          onClick={() => void c.retryAvailability()}
                        >
                          {formatMessage({ id: "app.common.retry", defaultMessage: "Retry" })}
                        </Button>
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
              <p className="type-body text-text-sub">
                {formatMessage({ id: `cockpit.stewardAccess.outcome.${request?.state}` })}
              </p>
              {request?.reason ? (
                <p className="whitespace-pre-wrap type-body text-text-strong">{request.reason}</p>
              ) : null}
              <Button
                type="button"
                emphasis="tertiary"
                size="compact"
                disabled={c.busy}
                onClick={() => c.setStep("choose")}
              >
                {formatMessage({ id: "cockpit.stewardAccess.changeGarden" })}
              </Button>
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
                <EmptyState
                  busy
                  className="min-h-0 flex-1"
                  icon={<RiLoader4Line className="animate-spin motion-reduce:animate-none" />}
                  title={formatMessage({ id: "cockpit.stewardAccess.loadingGardens" })}
                />
              ) : c.catalogError ? (
                <EmptyState
                  tone="error"
                  className="min-h-0 flex-1"
                  icon={<RiErrorWarningLine />}
                  title={formatMessage({ id: "cockpit.stewardAccess.gardensError.title" })}
                  description={formatMessage({
                    id: "cockpit.stewardAccess.gardensError.description",
                  })}
                  action={
                    <Button
                      type="button"
                      emphasis="secondary"
                      size="sm"
                      onClick={() => void c.reloadGardens()}
                    >
                      {formatMessage({ id: "app.common.retry", defaultMessage: "Retry" })}
                    </Button>
                  }
                />
              ) : c.candidates.length === 0 ? (
                // A search that finds nothing is still read out as the steward types.
                <div role="status" className="flex min-h-0 flex-1 flex-col">
                  <EmptyState
                    className="min-h-0 flex-1"
                    icon={<RiSeedlingLine />}
                    title={formatMessage({
                      id: c.invalidLink
                        ? "cockpit.stewardAccess.invalidLink.title"
                        : "cockpit.stewardAccess.noGardens.title",
                    })}
                    description={formatMessage({
                      id: c.invalidLink
                        ? "cockpit.stewardAccess.invalidLink.description"
                        : "cockpit.stewardAccess.noGardens.description",
                    })}
                  />
                </div>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-stroke-soft overflow-y-auto">
                  {c.candidates.map((garden) => (
                    <li key={garden.id}>
                      <Button
                        type="button"
                        emphasis="tertiary"
                        size="sm"
                        onClick={() => c.selectGarden(garden)}
                        className="h-auto max-h-none min-h-11 w-full justify-start gap-3 whitespace-normal rounded-[var(--m3-shape-sm)] px-3 py-3 text-left"
                      >
                        <RiSeedlingLine
                          className="h-5 w-5 shrink-0 text-text-sub"
                          aria-hidden="true"
                        />
                        <span className="min-w-0">
                          <span className="block type-body font-semibold text-text-strong">
                            {garden.name}
                          </span>
                          <span className="block type-body text-text-sub">{garden.location}</span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : c.selectedGarden ? (
            <>
              <section className="space-y-2">
                <h3 className="type-body font-semibold text-text-strong">
                  {formatMessage({ id: "cockpit.stewardAccess.reviewTitle" })}
                </h3>
                <p className="type-body text-text-sub">
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
              <p className="type-body text-text-sub">
                {formatMessage({ id: "cockpit.stewardAccess.signingHelp" })}
              </p>
              <Button
                type="button"
                emphasis="tertiary"
                size="compact"
                disabled={c.busy}
                loading={c.activity === "checking"}
                onClick={() => action(c.check)}
              >
                {formatMessage({ id: "cockpit.stewardAccess.checkStatus" })}
              </Button>
              {c.hasCheckedStatus && !request ? (
                <p role="status" className="type-body text-text-sub">
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
