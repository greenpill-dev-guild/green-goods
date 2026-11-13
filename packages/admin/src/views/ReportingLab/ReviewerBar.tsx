/**
 * Garden reporting lab: the reviewer's controls, kept apart from the product preview
 * below them. Scenario, interface, viewer role and naming candidate are lab controls;
 * the garden, month and filters stay in the product's own chrome. The notes and the
 * naming preview open right under the controls that change them.
 */
import { FactList, FactRow } from "@green-goods/shared/components/Cards/FactRow";
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { AdminFilterChip } from "@/components/AdminFilterChip";
import { AdminSortSelect } from "@/components/AdminSortSelect";
import { REPORT_ORDER, VIEW_COPY } from "./labCopy";
import type { ViewerRole } from "./model";
import { type HubLabel, NAME_CANDIDATES, type NameId } from "./naming";
import { NamingPreview } from "./NamingPreview";
import { REPORT_NOTES } from "./reportNotes";
import { SCENARIOS, type ScenarioId } from "./scenarios";
import type { ReportView } from "./scope";

export type LabPanel = "notes" | "naming" | "none";

export interface LabControls {
  scenario: ScenarioId;
  view: ReportView;
  role: ViewerRole;
  nameId: NameId;
  hubLabel: HubLabel;
  panel: LabPanel;
}

interface ReviewerBarProps {
  controls: LabControls;
  onChange: (patch: Partial<LabControls>) => void;
}

const ROLES: { value: ViewerRole; label: string }[] = [
  { value: "steward", label: "Steward" },
  { value: "evaluator", label: "Evaluator" },
  { value: "funder", label: "Funder" },
];

function Notes({ view }: { view: ReportView }) {
  const note = REPORT_NOTES[view];
  return (
    <FactList frame="card" aria-label={`Notes on ${VIEW_COPY[view].title}`}>
      <FactRow label="Steward question" value={VIEW_COPY[view].question} />
      <FactRow label="Reuses" value={note.reuses} />
      <FactRow label="Data it could read today" value={note.data} />
      <FactRow label="Missing for production" value={note.missing} />
      <FactRow label="Decisions needed" value={note.decisions} />
      <FactRow label="Proposed new parts" value={note.proposed} />
      <FactRow label="Proposed home" value={note.home} />
    </FactList>
  );
}

export function ReviewerBar({ controls, onChange }: ReviewerBarProps) {
  return (
    <aside
      aria-label="Prototype review controls"
      data-component="ReviewerBar"
      className="border-b-2 border-dashed border-stroke-sub bg-bg-weak px-3 py-3 min-[600px]:px-6"
    >
      <div className="mx-auto flex max-w-[87.5rem] flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2 type-label font-semibold text-text-strong">
              Garden Reporting Lab <StatusBadge variant="info">Reviewer controls</StatusBadge>
            </p>
            <p className="mt-0.5 type-meta text-text-sub">
              A prototype for review, not product UI. Synthetic sample data, fixed at Jan 16, 2026.
              Nothing here writes.
            </p>
          </div>
          <div role="group" aria-label="Lab panel" className="flex flex-wrap gap-1.5">
            <AdminFilterChip
              label="Notes"
              selected={controls.panel === "notes"}
              onToggle={() => onChange({ panel: controls.panel === "notes" ? "none" : "notes" })}
            />
            <AdminFilterChip
              label="Naming"
              selected={controls.panel === "naming"}
              onToggle={() => onChange({ panel: controls.panel === "naming" ? "none" : "naming" })}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AdminSortSelect
            label="Scenario"
            value={controls.scenario}
            onChange={(value) => onChange({ scenario: value as ScenarioId })}
            options={SCENARIOS.map((scenario) => ({ value: scenario.id, label: scenario.label }))}
          />
          <AdminSortSelect
            label="Interface"
            value={controls.view}
            onChange={(value) => onChange({ view: value as ReportView })}
            options={REPORT_ORDER.map((view, index) => ({
              value: view,
              label: index === 0 ? "Overview" : `${index}. ${VIEW_COPY[view].title}`,
            }))}
          />
          <AdminSortSelect
            label="Viewer"
            value={controls.role}
            onChange={(value) => onChange({ role: value as ViewerRole })}
            options={ROLES}
          />
          <AdminSortSelect
            label="Name"
            value={controls.nameId}
            onChange={(value) => onChange({ nameId: value as NameId, panel: "naming" })}
            options={NAME_CANDIDATES.map((candidate) => ({
              value: candidate.id,
              label: candidate.name,
            }))}
          />
          <AdminSortSelect
            label="Review workspace"
            value={controls.hubLabel}
            onChange={(value) => onChange({ hubLabel: value as HubLabel, panel: "naming" })}
            options={[
              { value: "hub", label: "Hub (today)" },
              { value: "review", label: "Review (exploration)" },
            ]}
          />
        </div>
        {controls.panel === "notes" ? <Notes view={controls.view} /> : null}
        {controls.panel === "naming" ? (
          <NamingPreview nameId={controls.nameId} hubLabel={controls.hubLabel} />
        ) : null}
      </div>
    </aside>
  );
}
