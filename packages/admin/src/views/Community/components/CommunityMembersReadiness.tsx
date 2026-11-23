/**
 * Gardeners' readiness mode (PRD-1537, decided 22 November 2026): each member's stage read from
 * what the garden records of them, the evidence beside it and one fixed hint for the next step.
 * Nothing is set by hand or stored. One row is one account, so people who share a phone are not
 * counted apart (DEC-H).
 */
import type { MemberReadiness } from "@green-goods/shared/hooks/garden/useGardenMemberContributions";
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import type {
  ItemRowDetail,
  ItemRowTone,
} from "@green-goods/shared/components/Cards/ItemRow/ItemRow";
import { type IntlShape, useIntl } from "react-intl";
import { AdminCard, AdminCardTitle } from "@/components/AdminCard";

/** A member's stage, or "unknown" while their evidence is unread or could not be read. */
export type ReadinessStage = "registered" | "gettingStarted" | "contributing" | "unknown";

export const READINESS_STAGES: readonly ReadinessStage[] = [
  "registered",
  "gettingStarted",
  "contributing",
  "unknown",
];

export function readinessStageOf(readiness: MemberReadiness | undefined): ReadinessStage {
  return readiness?.status === "read" ? readiness.stage : "unknown";
}

// Stages are information, never an alarm: only demonstrated participation takes a colour.
const STAGE_TONE: Record<ReadinessStage, ItemRowTone> = {
  registered: "neutral",
  gettingStarted: "info",
  contributing: "success",
  unknown: "neutral",
};

export function readinessStageLabel(stage: ReadinessStage, intl: IntlShape): string {
  return intl.formatMessage({ id: `hub.community.readiness.stage.${stage}` });
}

const DATE_FORMAT = { year: "numeric", month: "short", day: "numeric" } as const;

function dated(id: string, at: number, intl: IntlShape): ItemRowDetail {
  return {
    text: intl.formatMessage({ id }, { date: intl.formatDate(at, DATE_FORMAT) }),
    dateTime: new Date(at).toISOString(),
  };
}

/** The row's pill, its hint and its evidence: the person row's status and two details. */
export function readinessRowParts(
  readiness: MemberReadiness | undefined,
  joinedAt: number | undefined,
  intl: IntlShape
): {
  status: { label: string; tone: ItemRowTone };
  details: readonly [ItemRowDetail] | readonly [ItemRowDetail, ItemRowDetail];
} {
  const stage = readinessStageOf(readiness);
  const status = { label: readinessStageLabel(stage, intl), tone: STAGE_TONE[stage] };
  if (readiness?.status !== "read") {
    return {
      status,
      details: [
        intl.formatMessage({
          id:
            readiness?.status === "loading"
              ? "hub.community.readiness.evidence.loading"
              : "hub.community.readiness.evidence.unavailable",
        }),
      ],
    };
  }
  // The latest step taken is the evidence for the stage.
  const evidence =
    readiness.firstApprovedAt !== null
      ? dated("hub.community.readiness.evidence.firstApproved", readiness.firstApprovedAt, intl)
      : readiness.firstSentAt !== null
        ? dated("hub.community.readiness.evidence.firstSent", readiness.firstSentAt, intl)
        : joinedAt
          ? dated("app.garden.membership.joinedOn", joinedAt, intl)
          : undefined;
  const hint = {
    text: intl.formatMessage({ id: `hub.community.readiness.hint.${readiness.stage}` }),
    tone: "soft" as const,
  };
  // The next step leads: on a phone the second detail is the first to be cut.
  return { status, details: evidence ? [hint, evidence] : [hint] };
}

/** The rail's count of members at each stage, with what one row stands for. */
export function CommunityReadinessCard({ counts }: { counts: Record<ReadinessStage, number> }) {
  const intl = useIntl();
  return (
    <AdminCard variant="elevated" className="space-y-3">
      <AdminCardTitle>{intl.formatMessage({ id: "hub.community.readiness.title" })}</AdminCardTitle>
      <FactList frame="inset">
        {READINESS_STAGES.filter((stage) => stage !== "unknown" || counts.unknown > 0).map(
          (stage) => (
            <FactRow key={stage} label={readinessStageLabel(stage, intl)} value={counts[stage]} />
          )
        )}
      </FactList>
      <p className="type-meta text-text-sub">
        {intl.formatMessage({ id: "hub.community.readiness.sharedPhones" })}
      </p>
    </AdminCard>
  );
}
