import type { RoleRemovalOutcome } from "@green-goods/shared/hooks/garden/useGardenOperations";
import { GARDEN_ROLE_ORDER } from "@green-goods/shared/utils/blockchain/garden-roles";
import type { IntlShape } from "react-intl";
import type { FlowStatusRowProps } from "../Layout/FlowStatusRow";
import { type MemberPerson, type RolePair, rolePairKey } from "./manageRoles";
import type { ReviewPairStatus, ReviewPerson } from "./RoleRemovalReview";

/**
 * A removal review: `checking` while the chain is read before anything is signed, `ready` to
 * sign, `running` while signatures go out, and `done` once a run has settled.
 */
export interface ReviewState {
  phase: "checking" | "ready" | "running" | "done";
  people: ReviewPerson[];
  /** The pairs the current or last run sent, by `rolePairKey`. */
  run: string[];
}

/** Pairs a steward can send again as they are. */
const RETRYABLE: ReadonlySet<ReviewPairStatus> = new Set(["failed", "declined", "notSent"]);
const IN_FLIGHT: ReadonlySet<ReviewPairStatus> = new Set(["ready", "sending"]);

function statusOf(review: ReviewState, key: string): ReviewPairStatus | undefined {
  for (const { person, pairs } of review.people) {
    for (const pair of pairs) {
      if (rolePairKey({ address: person.address, role: pair.role }) === key) return pair.status;
    }
  }
  return undefined;
}

function pairsOf(review: ReviewState, statuses: ReadonlySet<ReviewPairStatus>): RolePair[] {
  return review.people.flatMap(({ person, pairs }) =>
    pairs
      .filter((pair) => statuses.has(pair.status))
      .map((pair) => ({ address: person.address, role: pair.role }))
  );
}

/** The review with each of these pairs at one status; a pair's old reason goes with it. */
export function withPairsStatus(
  review: ReviewState,
  rows: readonly RolePair[],
  status: ReviewPairStatus,
  reason?: string
): ReviewState {
  const keys = new Set(rows.map(rolePairKey));
  return {
    ...review,
    people: review.people.map((entry) => ({
      ...entry,
      pairs: entry.pairs.map((pair) =>
        keys.has(rolePairKey({ address: entry.person.address, role: pair.role }))
          ? { role: pair.role, status, reason }
          : pair
      ),
    })),
  };
}

/** The review a set of picks opens: people in roster order, their roles in role order. */
export function reviewFromPicks(picks: readonly RolePair[], people: readonly MemberPerson[]) {
  const order = new Map(people.map((person, index) => [person.address.toLowerCase(), index]));
  const byPerson = new Map<string, ReviewPerson>();
  for (const pair of picks) {
    const key = pair.address.toLowerCase();
    const person = people[order.get(key) ?? -1];
    if (!person) continue;
    const entry = byPerson.get(key) ?? {
      person: { address: person.address, roles: [...person.roles] },
      pairs: [],
    };
    entry.pairs.push({ role: pair.role, status: "checking" });
    byPerson.set(key, entry);
  }
  const review: ReviewState = {
    phase: "checking",
    run: [],
    people: [...byPerson.entries()]
      .sort(([a], [b]) => (order.get(a) ?? 0) - (order.get(b) ?? 0))
      .map(([, entry]) => ({
        ...entry,
        pairs: [...entry.pairs].sort(
          (a, b) => GARDEN_ROLE_ORDER.indexOf(a.role) - GARDEN_ROLE_ORDER.indexOf(b.role)
        ),
      })),
  };
  return { review, rows: pairsOf(review, new Set(["checking"])) };
}

/** The review once the chain has answered: a pair it found gone is left out, the rest wait. */
export function withCheckAnswers(
  review: ReviewState,
  rows: readonly RolePair[],
  held: readonly (boolean | null)[]
): ReviewState {
  const ready = withPairsStatus({ ...review, phase: "ready" }, rows, "ready");
  return withPairsStatus(
    ready,
    rows.filter((_, index) => held[index] === false),
    "alreadyRemoved"
  );
}

/** A run starting: its pairs ready again, and the run kept for its count. */
export const startRun = (review: ReviewState, pairs: readonly RolePair[]) =>
  withPairsStatus({ ...review, phase: "running", run: pairs.map(rolePairKey) }, pairs, "ready");

/** A run that broke: whatever it had not settled may or may not have landed. */
export const withUnsettledUnknown = (review: ReviewState, pairs: readonly RolePair[]) =>
  withPairsStatus(
    review,
    pairs.filter((pair) => IN_FLIGHT.has(statusOf(review, rolePairKey(pair)) ?? "checking")),
    "unknown"
  );

/** Check Again's answers: a pair found gone was removed, one still held can be sent again. */
export function withCheckAgainAnswers(
  review: ReviewState,
  rows: readonly RolePair[],
  held: readonly (boolean | null)[]
): ReviewState {
  return rows.reduce(
    (next, row, index) =>
      withPairsStatus(
        next,
        [row],
        held[index] === false ? "removed" : held[index] === true ? "failed" : "unknown"
      ),
    review
  );
}

/** The pairs a run settled for good; a declined or unsent one stays picked for Back. */
export const settledPairs = (pairs: readonly RolePair[], outcomes: readonly RoleRemovalOutcome[]) =>
  pairs.filter((_, index) =>
    ["removed", "alreadyRemoved", "refused"].includes(outcomes[index]?.status ?? "")
  );

export interface ReviewMomentAction {
  act: "back" | "send" | "checkAgain" | "done";
  label: string;
  /** The pairs a `send` signs for, or a `checkAgain` reads again. */
  pairs?: RolePair[];
  /** The destructive confirm: the flow's only danger fill (RUI p. 62). */
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
}

interface ReviewMoment {
  status: FlowStatusRowProps;
  /** How often the wallet will ask, said once, in the footer (DL-072). */
  note: string | null;
  primary: ReviewMomentAction;
  secondary: ReviewMomentAction | null;
}

/**
 * What the status row says, and the two acts the footer offers, wherever a review stands. A
 * result says what landed before it offers anything again. `hostBusy` holds every send while
 * another membership write (Add Members) is out.
 */
export function reviewMoment(
  review: ReviewState,
  formatMessage: IntlShape["formatMessage"],
  hostBusy: boolean
): ReviewMoment {
  const say = (id: string, values?: Record<string, string | number>) =>
    formatMessage({ id }, values);
  const count = (status: ReviewPairStatus) => pairsOf(review, new Set([status])).length;
  const signatures = (pairs: number) =>
    pairs > 0 ? say("admin.manageRoles.signatures", { count: pairs }) : null;
  const removeLabel = (pairs: number) => say("admin.manageRoles.removeCount", { count: pairs });
  const back: ReviewMomentAction = { act: "back", label: say("app.common.back") };
  const done: ReviewMomentAction = { act: "done", label: say("app.common.done") };
  const checking: FlowStatusRowProps = {
    tone: "neutral",
    busy: true,
    title: say("admin.manageRoles.checking.title"),
    description: say("admin.manageRoles.checking.body"),
  };

  if (review.phase === "checking" || review.phase === "ready") {
    const ready = pairsOf(review, new Set(["ready"]));
    const people = review.people.filter(({ pairs }) => pairs.some((p) => p.status === "ready"));
    const gone = count("alreadyRemoved");
    const stale = gone > 0 ? ` ${say("admin.manageRoles.ready.stale", { count: gone })}` : "";
    const total = review.people.reduce((sum, { pairs }) => sum + pairs.length, 0);
    let status = checking;
    if (review.phase === "ready") {
      status =
        ready.length > 0
          ? {
              tone: "neutral",
              title: say("admin.manageRoles.ready.title", {
                roles: ready.length,
                people: people.length,
              }),
              description: `${say("admin.manageRoles.ready.body")}${stale}`,
            }
          : {
              tone: "neutral",
              title: say("admin.manageRoles.nothingLeft.title"),
              description: say("admin.manageRoles.nothingLeft.body"),
            };
    }
    return {
      status,
      note: signatures(ready.length),
      secondary: back,
      primary: {
        act: "send",
        pairs: ready,
        label: removeLabel(ready.length || total),
        danger: true,
        disabled: review.phase === "checking" || ready.length === 0 || hostBusy,
      },
    };
  }

  if (review.phase === "running") {
    const total = review.run.length;
    const settled = review.run.filter((key) => !IN_FLIGHT.has(statusOf(review, key) ?? "removed"));
    return {
      status: {
        tone: "info",
        busy: true,
        title: say("admin.manageRoles.sending.title", {
          current: Math.min(total, settled.length + 1),
          total,
        }),
        description: say("admin.manageRoles.sending.body"),
        progress: total > 0 ? Math.round((settled.length / total) * 100) : null,
      },
      note: signatures(pairsOf(review, IN_FLIGHT).length),
      secondary: null,
      primary: {
        act: "send",
        label: say("admin.manageRoles.removing"),
        danger: true,
        loading: true,
      },
    };
  }

  const unknown = pairsOf(review, new Set(["unknown"]));
  const checkingAgain = count("checking") > 0;
  if (unknown.length > 0 || checkingAgain) {
    return {
      status: checkingAgain
        ? checking
        : {
            tone: "warning",
            title: say("admin.manageRoles.unknown.title", { count: unknown.length }),
            description: say("admin.manageRoles.unknown.body"),
          },
      note: null,
      secondary: done,
      primary: {
        act: "checkAgain",
        pairs: unknown,
        label: say("admin.manageRoles.checkAgain"),
        loading: checkingAgain,
      },
    };
  }

  const removed = count("removed");
  const retry = pairsOf(review, RETRYABLE);
  if (retry.length > 0) {
    const nothingLanded = removed === 0;
    const label = nothingLanded
      ? removeLabel(retry.length)
      : say("admin.manageRoles.removeRemaining", { count: retry.length });
    return {
      status:
        nothingLanded && count("declined") > 0
          ? {
              tone: "warning",
              title: say("admin.manageRoles.declined.title"),
              description: say("admin.manageRoles.declined.body"),
            }
          : {
              tone: "warning",
              title: say("admin.manageRoles.partial.title", { removed, left: retry.length }),
              description: say("admin.manageRoles.partial.body", { action: label }),
            },
      note: signatures(retry.length),
      secondary: nothingLanded ? back : done,
      primary: { act: "send", pairs: retry, label, danger: true, disabled: hostBusy },
    };
  }

  const refused = count("refused");
  return {
    status:
      removed > 0
        ? {
            tone: "success",
            title: say("admin.manageRoles.done.title", { count: removed }),
            description:
              refused > 0
                ? say("admin.manageRoles.done.someRefused", { count: refused })
                : say("admin.manageRoles.done.body"),
          }
        : {
            tone: "neutral",
            title: say("admin.manageRoles.declined.title"),
            description: say("admin.manageRoles.noneRemoved.body"),
          },
    note: null,
    secondary: null,
    primary: done,
  };
}
