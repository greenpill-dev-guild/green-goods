import type { CommitmentComposerValues } from "@green-goods/shared/commitment-pooling";
import { RiAddLine, RiCloseLine, RiShieldCheckLine } from "@remixicon/react";
import { useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { useIntl } from "react-intl";

export interface ComposeDetailsProps {
  form: UseFormReturn<CommitmentComposerValues>;
}

/**
 * Who confirms, who may join, and anything else worth attaching.
 *
 * Who confirms leads, because it is the one decision about another person and
 * the one that decides whether this commitment can ever be closed. The default
 * is stated rather than hidden: on an offer whoever takes it up confirms it, on
 * a request the asker does. A named confirmer group is not modelled by the
 * shared form yet, so nothing here pretends to offer one.
 *
 * The note and links travel inside the commitment's metadata document, pinned
 * when the commitment sends. Photos and voice notes ride the same document in
 * the spec; they wait on the proof composer's media pipeline.
 */
export function ComposeDetails({ form }: ComposeDetailsProps) {
  const { formatMessage } = useIntl();
  const direction = useWatch({ control: form.control, name: "direction" });
  const kind = useWatch({ control: form.control, name: "kind" });
  const note = useWatch({ control: form.control, name: "note" }) ?? "";
  const links = useWatch({ control: form.control, name: "links" });
  const openTeam = useWatch({ control: form.control, name: "openTeam" });
  const protocolFallbackEnabled = useWatch({
    control: form.control,
    name: "protocolFallbackEnabled",
  });
  const isRequest = direction === "REQUEST";
  const [pendingLink, setPendingLink] = useState("");

  const confirmerId = isRequest
    ? kind === "GARDEN_WORK"
      ? "app.compose.details.confirmer.requestWork"
      : "app.compose.details.confirmer.request"
    : "app.compose.details.confirmer.offer";

  const addLink = () => {
    const url = pendingLink.trim();
    if (!url) return;
    form.setValue("links", [...links, url], { shouldValidate: true, shouldDirty: true });
    setPendingLink("");
  };
  const removeLink = (index: number) =>
    form.setValue(
      "links",
      links.filter((_, i) => i !== index),
      { shouldValidate: true, shouldDirty: true }
    );
  const linkError = form.formState.errors.links;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.compose.details.legend" })}
      </h1>

      <section aria-labelledby="compose-confirms-heading" className="space-y-3">
        <h2 id="compose-confirms-heading" className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.details.whoConfirms" })}
        </h2>
        <p className="flex items-start gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 p-3 text-sm text-text-strong-950">
          <RiShieldCheckLine
            className="mt-0.5 h-4 w-4 shrink-0 text-text-sub-600"
            aria-hidden="true"
          />
          {formatMessage({ id: confirmerId })}
        </p>
        <Toggle
          id="compose-fallback"
          checked={protocolFallbackEnabled}
          onChange={(next) => form.setValue("protocolFallbackEnabled", next, { shouldDirty: true })}
          label={formatMessage({ id: "app.compose.terms.fallback" })}
          help={formatMessage({ id: "app.compose.terms.fallbackHelp" })}
        />
      </section>

      <section aria-labelledby="compose-team-heading" className="space-y-3">
        <h2 id="compose-team-heading" className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.details.team" })}
        </h2>
        <Toggle
          id="compose-open-team"
          checked={openTeam}
          onChange={(next) => form.setValue("openTeam", next, { shouldDirty: true })}
          label={formatMessage({ id: "app.compose.terms.openTeam" })}
          help={formatMessage({ id: "app.compose.terms.openTeamHelp" })}
        />
      </section>

      <section aria-labelledby="compose-note-heading" className="space-y-3">
        <h2 id="compose-note-heading" className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.compose.details.addDetails" })}
        </h2>
        <div>
          <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-note">
            {formatMessage({ id: "app.compose.what.descriptionLabel" })}
          </label>
          <textarea
            id="compose-note"
            value={note}
            rows={3}
            maxLength={2000}
            placeholder={formatMessage({ id: "app.compose.what.descriptionPlaceholder" })}
            onChange={(event) =>
              form.setValue("note", event.target.value, { shouldValidate: true, shouldDirty: true })
            }
            className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-text-strong-950" htmlFor="compose-link">
            {formatMessage({ id: "app.compose.details.linkLabel" })}
          </label>
          <div className="mt-1.5 flex gap-2">
            <input
              id="compose-link"
              type="url"
              inputMode="url"
              value={pendingLink}
              placeholder="https://"
              onChange={(event) => setPendingLink(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addLink();
                }
              }}
              className="min-w-0 flex-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
            />
            <button
              type="button"
              onClick={addLink}
              disabled={pendingLink.trim().length === 0}
              className="flex shrink-0 items-center gap-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 text-sm font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
            >
              <RiAddLine className="h-4 w-4" aria-hidden="true" />
              {formatMessage({ id: "app.compose.details.addLink" })}
            </button>
          </div>
          {linkError ? (
            <p className="mt-1.5 text-xs text-error-base" role="alert">
              {formatMessage({ id: "app.compose.details.linkInvalid" })}
            </p>
          ) : null}
          {links.length > 0 ? (
            <ul
              className="mt-2 space-y-1"
              aria-label={formatMessage({ id: "app.compose.details.links" })}
            >
              {links.map((url, index) => (
                <li
                  key={`${url}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-white-0 px-3 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-text-strong-950" title={url}>
                    {url}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeLink(index)}
                    aria-label={formatMessage({ id: "app.compose.details.removeLink" }, { url })}
                    className="shrink-0 rounded-full p-1 text-text-sub-600 tap-target-lg"
                  >
                    <RiCloseLine className="h-4 w-4" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-xs text-text-soft-400">
          {formatMessage({ id: "app.compose.details.savedWithDraft" })}
        </p>
      </section>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  help,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  help: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="min-w-0">
        <label className="block text-sm font-medium text-text-strong-950" htmlFor={id}>
          {label}
        </label>
        <span className="mt-0.5 block text-xs text-text-sub-600">{help}</span>
      </span>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-primary)]"
      />
    </div>
  );
}
