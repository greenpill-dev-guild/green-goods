import {
  findInput,
  outstandingFieldQuestions,
  pageChoices,
  type ReportRequirement,
  reportQuestionPosition,
} from "@green-goods/shared/modules/agent-reporting";
import type { WorkInput } from "@green-goods/shared/types/domain";
import type { DraftRecord } from "../drafts";
import { type PromptOption, promptsAsked } from "../prompts";
import { profiledInput, profiledQuestion, type QuestionProfile } from "../questions";
import { questionProfileOf } from "./draft-commit";
import type { ConversationWriter } from "./writer";

/**
 * How a report asks for one of its activity's fields, and shows the answer: the question's place
 * among the others, its wording (the report's profile, or the definition's own title and hint),
 * its choices, and the value as the summary prints it.
 */
export const option = (id: string, label: string, value: string): PromptOption => ({
  id,
  label,
  value,
});

export function formatDetail(input: WorkInput, value: unknown): string {
  const labels = input.type === "band" ? input.bandLabels : input.optionLabels;
  if (Array.isArray(value)) return value.map((key) => labels?.[key] ?? key).join(", ");
  if (typeof value === "number") return `${value}${input.unit ? ` ${input.unit}` : ""}`;
  return labels?.[String(value)] ?? String(value);
}

/** The field questions this report has already put to the gardener, from its own prompts. */
function askedQuestions(writer: ConversationWriter, draft: DraftRecord): ReportRequirement[] {
  return promptsAsked(writer.core, "draft", draft.id).flatMap(
    ({ kind, fieldKey }): ReportRequirement[] => {
      if (kind === "field") return fieldKey ? [{ kind: "detail", key: fieldKey }] : [];
      if (kind === "fields")
        return (fieldKey ?? "").split(",").map((key) => ({ kind: "detail", key }));
      if (kind === "time" || kind === "time_unit") return [{ kind: "time" }];
      if (kind === "title" || kind === "feedback") return [{ kind }];
      return kind === "evidence" ? [{ kind: "evidence", minimum: 0, have: 0 }] : [];
    }
  );
}

/**
 * A field question with its place among the ones this report asks, "2 of 3 · ", so the count the
 * conversation opened with is the count it is numbered against. Garden, activity and contradiction
 * questions stay unnumbered, and so does a field asked again to change it.
 */
export function fieldQuestionText(
  writer: ConversationWriter,
  draft: DraftRecord,
  requirement: ReportRequirement,
  question: string
): string {
  const place = reportQuestionPosition(
    draft.content,
    draft.snapshot,
    requirement,
    askedQuestions(writer, draft)
  );
  if (!place) return question;
  // Questions are put one at a time, so this one follows those already answered, whatever its
  // place in the activity's own list.
  const waiting = outstandingFieldQuestions(draft.content, draft.snapshot).length;
  const position = place.total - waiting + 1;
  return `${writer.text("report.questionPosition", { position, total: place.total })}${question}`;
}

/** What the activity's own definition says about a field, when that adds to its title. */
export function fieldHint(input: WorkInput): string {
  const hint = (input.placeholder ?? "").trim().replace(/[.:…]+$/u, "");
  return hint && hint.toLowerCase() !== input.title.trim().toLowerCase() ? hint : "";
}

/** A field's name as its question opens: with the definition's hint when it has one. */
function fieldLead(writer: ConversationWriter, input: WorkInput): string {
  const hint = fieldHint(input);
  return hint
    ? writer.text("report.fieldLeadHint", { title: input.title, hint })
    : writer.text("report.fieldLead", { title: input.title });
}

export function askField(
  writer: ConversationWriter,
  draft: DraftRecord,
  definition: WorkInput,
  pageIndex = 0
): void {
  const base = {
    subjectKind: "draft" as const,
    resourceId: draft.id,
    resourceRevision: draft.revision,
    kind: "field",
    fieldKey: definition.key,
  };
  // The report's profile may give the field a reviewed question, and a number its unit.
  const profile = questionProfileOf(writer.core, draft);
  const input = profiledInput(profile, definition, draft.content.details);
  const asked = profiledQuestion(profile, input.key, draft.content.details);
  const reviewed = asked ? writer.text(asked) : null;
  const numbered = (question: string) =>
    fieldQuestionText(writer, draft, { kind: "detail", key: input.key }, question);
  if (input.type === "number") {
    writer.ask(base, () =>
      numbered(
        reviewed ??
          writer.text("report.askNumber", {
            title: fieldLead(writer, input),
            unit: input.unit ? ` (${input.unit})` : "",
          })
      )
    );
    return;
  }
  if (input.type === "text" || input.type === "textarea") {
    writer.ask(base, () =>
      numbered(reviewed ?? writer.text("report.askText", { title: fieldLead(writer, input) }))
    );
    return;
  }
  const page = pageChoices(input, pageIndex, writer.core.settings.choicePageSize);
  const options = page.keys.map((key, index) => option(`${index}`, page.labels[index] ?? key, key));
  if (page.hasMore)
    options.push(option("more", writer.text("report.moreChoices"), `page:${pageIndex + 1}`));
  writer.ask({ ...base, options, page: pageIndex }, () =>
    numbered(
      writer.text(input.type === "multi-select" ? "report.askMulti" : "report.askChoice", {
        title: reviewed ?? fieldLead(writer, input),
      })
    )
  );
}

/**
 * Two related fields in one question. The answer may give either, both or more. A choice field's
 * choices are listed under it, since the question has no buttons to show them.
 */
export function askFieldGroup(
  writer: ConversationWriter,
  draft: DraftRecord,
  group: NonNullable<QuestionProfile["groups"]>[number]
): void {
  const listed = group.fields
    .map((key) => findInput(draft.snapshot, key))
    .filter((input) => input?.type === "select" || input?.type === "multi-select")
    .map((input) => {
      const choices = (input as WorkInput).options.map(
        (key) => (input as WorkInput).optionLabels?.[key] ?? key
      );
      return `\n${(input as WorkInput).title}: ${choices.join(", ")}`;
    })
    .join("");
  writer.ask(
    {
      subjectKind: "draft",
      resourceId: draft.id,
      resourceRevision: draft.revision,
      kind: "fields",
      fieldKey: group.fields.join(","),
    },
    () =>
      fieldQuestionText(
        writer,
        draft,
        { kind: "detail", key: group.fields[0] },
        `${writer.text(group.ask)}${listed}`
      )
  );
}
