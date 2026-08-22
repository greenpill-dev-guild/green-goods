import {
  type Address,
  AddressDisplay,
  cn,
  formatAddress,
  MAX_EVIDENCE_LINKS,
} from "@green-goods/shared";
import { RiAddLine, RiCloseLine } from "@remixicon/react";
import { useState } from "react";
import { useIntl } from "react-intl";

export interface ProofRosterMember {
  address: Address;
  isLead: boolean;
}

export interface ProofDetailsProps {
  /** The active roster: the only people who may be credited. */
  roster: ProofRosterMember[];
  credited: Address[];
  onToggleCredit: (address: Address) => void;
  viewer: Address | null;
  note: string;
  onNote: (value: string) => void;
  links: string[];
  onLinks: (value: string[]) => void;
  linkInvalid: boolean;
}

/**
 * Who did this, and the words that go with it.
 *
 * Credit is a labelled, bounded choice over the active roster, never an
 * invisible default: the first proof that credits someone gives them their
 * share of recognition, so the list is shown in full and the member ticks it.
 * The signed-in member is preselected visibly when they are on the roster.
 */
export function ProofDetails({
  roster,
  credited,
  onToggleCredit,
  viewer,
  note,
  onNote,
  links,
  onLinks,
  linkInvalid,
}: ProofDetailsProps) {
  const { formatMessage } = useIntl();
  const [pendingLink, setPendingLink] = useState("");

  const isCredited = (address: Address) =>
    credited.some((entry) => entry.toLowerCase() === address.toLowerCase());
  // The pinned document keeps only the first MAX_EVIDENCE_LINKS, so the limit
  // is held here instead: a link that would be dropped is never accepted, and
  // the member is not told their proof was saved whole when it was not.
  const linksFull = links.length >= MAX_EVIDENCE_LINKS;
  const addLink = () => {
    const url = pendingLink.trim();
    if (!url || linksFull) return;
    onLinks([...links, url]);
    setPendingLink("");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-medium text-text-strong-950">
        {formatMessage({ id: "app.proof.details.legend" })}
      </h1>

      <fieldset>
        <legend className="text-sm font-medium text-text-strong-950">
          {formatMessage({ id: "app.proof.details.credit" })}
        </legend>
        <p className="mt-1 text-xs text-text-sub-600">
          {formatMessage({ id: "app.proof.details.creditHelp" })}
        </p>
        {roster.length === 0 ? (
          <p className="mt-3 text-sm text-text-sub-600">
            {formatMessage({ id: "app.proof.details.noRoster" })}
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roster.map((member) => {
              const selected = isCredited(member.address);
              const isYou = viewer?.toLowerCase() === member.address.toLowerCase();
              const id = `proof-credit-${member.address.toLowerCase()}`;
              return (
                <li
                  key={member.address}
                  className={cn(
                    "flex items-center gap-3 rounded-[var(--radius-lg)] border p-3",
                    selected
                      ? "border-primary-alpha-24 bg-primary-alpha-10"
                      : "border-stroke-soft-200 bg-bg-white-0"
                  )}
                >
                  {/* The row's own control carries the name, because the address
                    display beside it is itself interactive and cannot sit inside
                    a label. */}
                  <input
                    id={id}
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleCredit(member.address)}
                    aria-label={formatMessage(
                      { id: "app.proof.details.creditOne" },
                      { who: formatAddress(member.address) }
                    )}
                    className="h-5 w-5 shrink-0 accent-[var(--color-primary)]"
                  />
                  <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                    <AddressDisplay address={member.address} />
                    {member.isLead ? (
                      <span className="shrink-0 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
                        {formatMessage({ id: "app.proof.details.lead" })}
                      </span>
                    ) : null}
                    {isYou ? (
                      <span className="shrink-0 rounded-full bg-bg-weak-50 px-2 py-0.5 text-[10px] font-medium text-text-sub-600">
                        {formatMessage({ id: "app.commitment.people.you" })}
                      </span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="proof-note">
          {formatMessage({ id: "app.proof.details.noteLabel" })}
        </label>
        <textarea
          id="proof-note"
          value={note}
          rows={3}
          maxLength={2000}
          placeholder={formatMessage({ id: "app.proof.details.notePlaceholder" })}
          onChange={(event) => onNote(event.target.value)}
          className="mt-1.5 w-full rounded-[var(--radius-lg)] border border-stroke-soft-200 bg-bg-weak-50 p-3 text-sm text-text-strong-950"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-strong-950" htmlFor="proof-link">
          {formatMessage({ id: "app.compose.details.linkLabel" })}
        </label>
        <div className="mt-1.5 flex gap-2">
          <input
            id="proof-link"
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
            disabled={pendingLink.trim().length === 0 || linksFull}
            className="flex shrink-0 items-center gap-1 rounded-[var(--radius-lg)] border border-stroke-soft-200 px-3 text-sm font-medium text-text-strong-950 tap-target-lg disabled:opacity-60"
          >
            <RiAddLine className="h-4 w-4" aria-hidden="true" />
            {formatMessage({ id: "app.compose.details.addLink" })}
          </button>
        </div>
        {linkInvalid ? (
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
                  onClick={() => onLinks(links.filter((_, i) => i !== index))}
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
    </div>
  );
}
