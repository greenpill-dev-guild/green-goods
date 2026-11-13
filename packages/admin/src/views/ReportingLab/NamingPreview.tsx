/**
 * Garden reporting lab: the naming candidates in the places a steward meets the name,
 * next to the control that picks one. The lab's own nav dock follows the Hub-label pick,
 * so the overlap shows in the real chrome too.
 */
import { StatusBadge } from "@green-goods/shared/components/StatusBadge";
import { cn } from "@green-goods/shared/utils/styles/cn";
import type { ReactNode } from "react";
import {
  candidateName,
  type HubLabel,
  NAME_CANDIDATES,
  type NameId,
  sharedWords,
  workspaceLabels,
} from "./naming";

interface NamingPreviewProps {
  nameId: NameId;
  hubLabel: HubLabel;
}

function Specimen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-(--admin-radius-md) border border-stroke-soft bg-bg-white p-3">
      <span className="type-meta-sm font-medium uppercase tracking-[0.06em] text-text-soft">
        {label}
      </span>
      {children}
    </div>
  );
}

export function NamingPreview({ nameId, hubLabel }: NamingPreviewProps) {
  const name = candidateName(nameId);
  const labels = workspaceLabels(hubLabel);
  const shared = sharedWords(name, hubLabel);
  const review = labels[0];

  return (
    <div className="flex flex-col gap-3" data-component="NamingPreview">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Specimen label="Browser tab">
          <span className="truncate type-body text-text-strong">Reports · Garden · {name}</span>
        </Specimen>
        <Specimen label="Sign-in">
          <span className="type-title-sm font-semibold text-text-strong">Sign in to {name}</span>
        </Specimen>
        <Specimen label="Workspaces">
          <span className="flex flex-wrap gap-1">
            {labels.map((label) => (
              <span
                key={label}
                className={cn(
                  "rounded-(--admin-radius-full) border px-2 type-meta",
                  shared.includes(label)
                    ? "border-warning-light bg-warning-lighter text-warning-dark"
                    : "border-stroke-soft text-text-sub"
                )}
              >
                {label}
              </span>
            ))}
          </span>
        </Specimen>
        <Specimen label="In a sentence">
          <span className="type-body text-text-strong">
            Open {name}, then {review} › Work to review submissions.
          </span>
        </Specimen>
      </div>
      <p className="type-body text-text-sub">
        {shared.length === 0
          ? `"${name}" repeats no workspace name.`
          : `"${name}" repeats ${shared.map((word) => `"${word}"`).join(" and ")}, so "open the ${shared[0]}" could mean the dashboard or the workspace.`}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] type-meta">
          <caption className="sr-only">
            Every candidate against both labels for the review workspace
          </caption>
          <thead>
            <tr className="border-b border-stroke-soft text-left text-text-sub">
              <th scope="col" className="py-1.5 pr-3 font-medium">
                Name
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                With the workspace called Hub
              </th>
              <th scope="col" className="py-1.5 pr-3 font-medium">
                With it called Review
              </th>
              <th scope="col" className="py-1.5 font-medium">
                Note
              </th>
            </tr>
          </thead>
          <tbody>
            {NAME_CANDIDATES.map((candidate) => (
              <tr
                key={candidate.id}
                className={cn(
                  "border-b border-stroke-soft last:border-0",
                  candidate.id === nameId && "bg-bg-weak"
                )}
              >
                <th scope="row" className="py-1.5 pr-3 text-left font-semibold text-text-strong">
                  {candidate.name}
                </th>
                {(["hub", "review"] as const).map((label) => {
                  const words = sharedWords(candidate.name, label);
                  return (
                    <td key={label} className="py-1.5 pr-3">
                      {words.length === 0 ? (
                        <StatusBadge variant="success">No overlap</StatusBadge>
                      ) : (
                        <StatusBadge variant="warning">Repeats {words.join(", ")}</StatusBadge>
                      )}
                    </td>
                  );
                })}
                <td className="py-1.5 text-text-sub">{candidate.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
