#!/usr/bin/env bash
# PreToolUse gate for Linear issue writes.
#
# Reads a Claude Code hook payload on stdin and blocks `save_issue` calls whose
# title or description break the issue contract in
# `.claude/context/linear-routing-rules.md`. Exit 2 rejects the tool call and
# returns stderr to the model, which then rewrites and retries.
#
# Deliberately narrow: it checks shape (prefixes, headings, length, lane
# metadata), never content quality. A rule here must be mechanically decidable
# and near-zero false positive, because the cost of a wrong block is an agent
# stuck in a retry loop.
#
# Skipped when the call carries no prose to judge — a state transition, a label
# change, or a `patch` edit that never sends a full description.

set -uo pipefail

payload="$(cat)"

tool="$(printf '%s' "$payload" | jq -r '.tool_name // empty')"
case "$tool" in
  *save_issue) ;;
  *) exit 0 ;;
esac

title="$(printf '%s' "$payload" | jq -r '.tool_input.title // empty')"
description="$(printf '%s' "$payload" | jq -r '.tool_input.description // empty')"
labels="$(printf '%s' "$payload" | jq -r '(.tool_input.labels // []) | join(",")')"
has_patch="$(printf '%s' "$payload" | jq -r 'if (.tool_input.patch // empty) | length > 0 then "yes" else "no" end')"

# Nothing to judge: property-only update, or a patch edit that carries no full body.
if [ -z "$title" ] && [ -z "$description" ]; then exit 0; fi
if [ "$has_patch" = "yes" ] && [ -z "$description" ]; then exit 0; fi

violations=""
add() { violations="${violations}  - $1"$'\n'; }

# --- Title -----------------------------------------------------------------
if [ -n "$title" ]; then
  # Retired 2026-08-27: prefixes are carried by labels and state, not the title.
  if printf '%s' "$title" | grep -qiE '^\[tracking\]'; then
    add "Title starts with [tracking]. That prefix is retired — the 'maintenance' label plus Backlog state already say this is uncommitted signal."
  fi
  if printf '%s' "$title" | grep -qE '^(plan|backlog|idea|UI|State/API|Contracts|Docs|Community|Editorial|Release Ops|QA Pass [0-9]+|QA|Chore|Spike):'; then
    add "Title starts with a lane or record-type prefix. Write what a person would say broke or should exist; labels carry the rest."
  fi
  if printf '%s' "$title" | grep -qE '^P[0-9][: ]'; then
    add "Title carries a priority prefix. Linear's priority field owns that."
  fi
  if printf '%s' "$title" | grep -qP '^\s*[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' 2>/dev/null; then
    add "Title starts with an emoji. Plain text only."
  fi
fi

# --- Body ------------------------------------------------------------------
if [ -n "$description" ]; then
  headings=$(printf '%s\n' "$description" | grep -cE '^#{1,6} ' || true)
  words=$(printf '%s' "$description" | wc -w | tr -d ' ')
  # Umbrella trackers and roadmaps legitimately run long; they still obey the
  # heading cap and the banned-token rules below.
  is_umbrella=no
  case ",$labels," in *,plans,*) is_umbrella=yes ;; esac

  if [ "$headings" -gt 3 ]; then
    add "Body has $headings headings (cap 3). Most defects need none — problem, 'Done when', one source line."
  fi
  if [ "$is_umbrella" = "no" ] && [ "$words" -gt 300 ]; then
    add "Body is $words words (cap 300, target ~150). Move evidence dumps, repro transcripts, and file inventories into the first comment."
  fi

  # Lane metadata and raw agent output. These are the exact tokens that made
  # plan mirrors and routine reports unreadable in the 2026-08-27 board audit.
  # A single trailing link line ("Handoff: `path`") is fine and useful; what
  # broke those issues was a body that OPENED with metadata, or stacked several
  # such lines into a block where the problem statement should have been.
  meta_re='^[[:space:]]*(Source plan|Source|Status JSON|Lane|Owner/status|Owner|Handoff|Plan hub):[[:space:]]*`'
  first_line="$(printf '%s\n' "$description" | grep -vE '^[[:space:]]*$' | head -1)"
  meta_count=$(printf '%s\n' "$description" | grep -cE "$meta_re" || true)

  if printf '%s' "$first_line" | grep -qE "$meta_re"; then
    add "Body opens with lane metadata instead of the problem. Lead with what breaks or what should exist; put the link at the end."
  elif [ "$meta_count" -ge 2 ]; then
    add "Body stacks $meta_count metadata lines (Source / Lane / Owner / Handoff). Linear's assignee and state fields own that — keep one link line at most."
  fi
  if printf '%s' "$description" | grep -qE 'status\.json|execution_sub_lanes|laneSyncMode|plan\.todo\.md'; then
    add "Body cites plan-hub internals (status.json / execution_sub_lanes). Link the plan directory instead."
  fi
  if printf '%s' "$description" | grep -qE '\bW[0-9]{1,2}\b'; then
    add "Body uses screen codes (W12 and similar). Use the screen's human name."
  fi
  if printf '%s' "$description" | grep -qE '§[0-9]'; then
    add "Body carries a spec citation (§5.1). Drop it, or link the file if the reader truly needs it."
  fi
  if printf '%s' "$description" | grep -qP '^#{1,6} +[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]' 2>/dev/null; then
    add "Body has an emoji heading. Plain headings only."
  fi

  # Empty scaffolding — the failure that produced sections reading "—" and
  # paragraphs explaining that telemetry found nothing.
  if printf '%s' "$description" | grep -qE '^[[:space:]]*(—|-|N/A|TBD|None|needs repro|needs definition|needs investigation)[[:space:]]*$'; then
    add "Body renders an empty section placeholder. Drop the section instead — a heading with nothing under it costs the reader a stop."
  fi
fi

if [ -n "$violations" ]; then
  {
    echo "BLOCKED: this Linear issue breaks the issue contract."
    echo
    printf '%s' "$violations"
    echo "Contract: .claude/context/linear-routing-rules.md § Issue structure"
    echo "Shape: problem or outcome in plain prose -> 'Done when' bullets -> one source line."
    echo "Rewrite and call save_issue again."
  } >&2
  exit 2
fi

exit 0
