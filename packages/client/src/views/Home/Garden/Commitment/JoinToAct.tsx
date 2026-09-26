import { Button } from "@green-goods/shared/components/Button";
import { toastService } from "@green-goods/shared/components/Toast/toast.service";
import { useJoinGarden } from "@green-goods/shared/hooks/garden/useJoinGarden";
import type { Address } from "@green-goods/shared/types/domain";
import { RiSearchLine, RiUserAddLine } from "@remixicon/react";
import { useIntl } from "react-intl";
import { useNavigate } from "react-router-dom";

export interface JoinToActGarden {
  address: Address;
  name: string;
  openJoining: boolean;
}

/** Which door the card opens: join outright, ask a steward, or find a garden first. */
export type JoinToActMode = "join" | "request" | "find";

export interface JoinToActCardProps {
  mode: JoinToActMode;
  /** The garden to join, or null on the protocol pool where any garden of the reader's own counts. */
  gardenName: string | null;
  isBusy: boolean;
  disabled?: boolean;
  onAct: () => void;
}

const LABEL_IDS: Record<JoinToActMode, string> = {
  join: "app.commitment.join.open",
  request: "app.commitment.join.request",
  find: "app.commitment.join.find",
};

/**
 * What a signed-in reader who does not belong to the garden sees in place of
 * an act bar: one sentence and one door.
 *
 * A disabled Take This Up would be a question mark; the chain refuses a
 * personal claim without a garden role, so the honest act is the join itself
 * (or the request for it) rather than the act it unlocks. The card sits under
 * the status band, where the bar's absence is otherwise unexplained.
 */
export function JoinToActCard({
  mode,
  gardenName,
  isBusy,
  disabled = false,
  onAct,
}: JoinToActCardProps) {
  const { formatMessage } = useIntl();
  const line = gardenName
    ? formatMessage({ id: "app.commitment.join.line" }, { garden: gardenName })
    : formatMessage({ id: "app.commitment.join.anyLine" });
  const Icon = mode === "find" ? RiSearchLine : RiUserAddLine;
  return (
    <section
      className="rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-4"
      data-component="JoinToAct"
      data-mode={mode}
    >
      <p className="text-sm text-text-sub-600">{line}</p>
      <Button
        type="button"
        size="sm"
        emphasis={mode === "join" ? undefined : "secondary"}
        className="mt-3"
        onClick={onAct}
        loading={isBusy}
        disabled={disabled}
        leadingIcon={<Icon className="h-4 w-4" aria-hidden="true" />}
      >
        {formatMessage({ id: LABEL_IDS[mode] })}
      </Button>
    </section>
  );
}

const CANCELLED = /reject|cancel|denied|user refused/i;

/**
 * The card wired to the app: joins an open garden in place, sends a reader to
 * the garden screen when a steward has to let them in, and to Home when no
 * one garden is named (the protocol pool).
 */
export function JoinToAct({
  garden,
  isOnline,
}: {
  garden: JoinToActGarden | null;
  isOnline: boolean;
}) {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { joinGarden, isJoining } = useJoinGarden();

  if (!garden) {
    return (
      <JoinToActCard mode="find" gardenName={null} isBusy={false} onAct={() => navigate("/home")} />
    );
  }
  if (!garden.openJoining) {
    return (
      <JoinToActCard
        mode="request"
        gardenName={garden.name}
        isBusy={false}
        onAct={() => navigate("../..", { relative: "path" })}
      />
    );
  }
  const join = () => {
    void joinGarden(garden.address).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      if (CANCELLED.test(message)) return;
      toastService.error({ title: formatMessage({ id: "app.commitment.join.failed" }) });
    });
  };
  return (
    <JoinToActCard
      mode="join"
      gardenName={garden.name}
      isBusy={isJoining}
      disabled={!isOnline}
      onAct={join}
    />
  );
}
