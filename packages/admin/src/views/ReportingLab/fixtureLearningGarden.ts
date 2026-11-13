/**
 * Garden reporting lab: Hilltop Learning Garden, a synthetic education garden with
 * intermittent sessions and attendance records. Every name and number is invented.
 */
import { learningLedger } from "./fixtureLedgers";
import type { PromiseItem, ReportGarden } from "./model";

export const LEARNING_ZONE = { timeZone: "Etc/GMT+3", utcOffsetMinutes: -180 } as const;

export const EDU_ACTIONS = {
  publish: "edu.publish_session",
  deliver: "edu.deliver_session",
  attendance: "edu.verify_attendance",
  followUp: "edu.followup_action",
  check: "edu.learning_assessment",
} as const;

const { publish, deliver, attendance, followUp, check } = EDU_ACTIONS;

const PROMISES: PromiseItem[] = [
  {
    id: "p-term1",
    title: "Twice-weekly soil science sessions",
    direction: "offer",
    windowId: "term-1",
    leadId: "facilitator.wren",
    due: "2025-12-12",
    doneOn: "2025-12-11",
    actionId: deliver,
  },
  {
    id: "p-seeds",
    title: "Seed library restock",
    direction: "ask",
    windowId: "term-1",
    leadId: "facilitator.moss",
    due: "2025-12-05",
  },
  {
    id: "p-club",
    title: "Saturday reading club",
    direction: "offer",
    windowId: "reading-club",
    leadId: "facilitator.sage",
    due: "2026-01-10",
    doneOn: "2026-01-10",
    actionId: deliver,
  },
  {
    id: "p-open-day",
    title: "Parent open day",
    direction: "offer",
    windowId: "term-2",
    leadId: "facilitator.wren",
    due: "2026-01-24",
  },
  {
    id: "p-term2",
    title: "Twice-weekly sessions, Term 2",
    direction: "offer",
    windowId: "term-2",
    leadId: "facilitator.sage",
    due: "2026-03-27",
    actionId: deliver,
  },
];

export function learningGarden(): ReportGarden {
  return {
    id: "garden-hilltop",
    name: "Hilltop Learning Garden",
    domainLabel: "Education",
    ...LEARNING_ZONE,
    zoneLabel: "UTC-3",
    recordsBegin: "2025-09-15",
    media: "edu",
    accounts: [
      { id: "classroom-tablet", name: "Classroom tablet", kind: "shared-device" },
      ...["facilitator.moss", "facilitator.sage", "facilitator.wren"].map((id) => ({
        id,
        name: id,
        kind: "person" as const,
      })),
    ],
    team: ["steward.elm", "evaluator.ash"].map((id) => ({ id, name: id, kind: "person" as const })),
    sites: [
      { id: "upper-terrace", name: "Upper terrace classroom", east: 0, north: 0 },
      { id: "seed-library", name: "Seed library shed", east: 200, north: -150 },
      { id: "community-hall", name: "Community hall", east: -700, north: 500 },
    ],
    actions: [
      { id: publish, title: "Publish Session", shortTitle: "Planned session", planned: true },
      { id: deliver, title: "Deliver Session", shortTitle: "Session" },
      { id: attendance, title: "Verify Attendance", shortTitle: "Attendance" },
      { id: followUp, title: "Follow-up Action", shortTitle: "Follow-up" },
      { id: check, title: "Learning Assessment", shortTitle: "Learning check" },
    ],
    measures: [
      {
        id: "sessions",
        label: "Sessions delivered",
        unit: "sessions",
        kind: "count",
        actionId: deliver,
      },
      {
        id: "attendance",
        label: "Attendance recorded",
        unit: "attendances",
        kind: "sum",
        actionId: attendance,
        quantityKey: "attendees",
        note: "Attendance, not people: one learner at three sessions counts three times.",
      },
      { id: "hours", label: "Reported work time", unit: "hours", kind: "hours" },
    ],
    windows: [
      {
        id: "term-1",
        kind: "season",
        name: "Term 1 Learning Season",
        start: "2025-09-15",
        end: "2025-12-12",
      },
      {
        id: "reading-club",
        kind: "campaign",
        name: "Holiday Reading Club",
        start: "2025-12-15",
        end: "2026-01-09",
      },
      {
        id: "term-2",
        kind: "season",
        name: "Term 2 Learning Season",
        start: "2026-01-12",
        end: "2026-03-27",
      },
    ],
    promises: PROMISES,
    milestones: [
      {
        id: "m-baseline",
        title: "Soil Learning Baseline",
        on: "2025-09-10",
        kind: "assessment",
        proposed: false,
      },
      {
        id: "m-term-check",
        title: "End-of-term learning check",
        on: "2025-12-11",
        kind: "check-in",
        proposed: true,
      },
      {
        id: "m-midpoint",
        title: "Term 2 mid-point review",
        on: "2026-02-20",
        kind: "report",
        proposed: true,
      },
    ],
    baseline: {
      title: "Soil Learning Baseline",
      createdOn: "2025-09-10",
      authorId: "evaluator.ash",
      diagnosis:
        "Learners can name compost inputs, but few have built or turned a pile themselves.",
      outcome: "Learners can build and keep a working compost pile.",
      metric: "Learners who complete the composting practical",
      target: "8 of every 10 enrolled learners by Dec 12, 2025",
      observation: "1 of every 10 learners had built a pile",
      observedOn: "2025-09-12",
      method: "Intake survey",
      outputMeasureId: "sessions",
      evidenceActionId: check,
    },
    followUp: null,
    ledger: learningLedger(LEARNING_ZONE.utcOffsetMinutes),
  };
}
