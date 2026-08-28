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
# Guard against `// empty` here: on a missing key it collapses the whole
# expression to no output, so the variable silently becomes "" and the check it
# guards never runs. Use a concrete fallback value instead.
has_patch="$(printf '%s' "$payload" | jq -r 'if ((.tool_input.patch // []) | length) > 0 then "yes" else "no" end')"
# `id` distinguishes an update from a create. Only a create can be required to
# carry a body: an update may legitimately touch state, labels, or relations
# alone, and blocking those would wedge routine triage.
is_update="$(printf '%s' "$payload" | jq -r 'if (.tool_input.id // "") != "" then "yes" else "no" end')"
# An absent `description` key means "leave the body alone"; an explicitly empty
# one means "erase it". Only the second is a contract violation, and `// empty`
# renders both as "", so the key has to be probed separately.
sent_description="$(printf '%s' "$payload" | jq -r 'if (.tool_input | has("description")) then "yes" else "no" end')"

# Text a `patch` edit inserts into an existing body. The patch ops carry only a
# fragment, never the resulting document, so the cumulative caps (heading count,
# word count) cannot be evaluated here — but the absolute rules can, and without
# this a caller could smuggle lane metadata or extra headings into a body by
# patching it instead of replacing it.
patch_text="$(printf '%s' "$payload" | jq -r '[.tool_input.patch // [] | .[] | (.text // ""), (.new_string // "")] | join("\n")')"

# Nothing at all to judge: a property-only write (state, labels, relations).
# An explicitly supplied `description` still counts as something to judge even
# when it is empty — that is a body erase, not an untouched body.
if [ -z "$title" ] && [ -z "$description" ] && [ -z "${patch_text//[$'\n\t ']/}" ] &&
  [ "$sent_description" = "no" ]; then
  exit 0
fi

violations=""
add() { violations="${violations}  - $1"$'\n'; }

# Emoji detection without `grep -P`: BSD grep (macOS, where humans run this) has
# no PCRE support, while the routines run on Linux — a -P-only check would fire
# on one platform and silently pass on the other. Decode the first character's
# codepoint from its UTF-8 bytes instead, which behaves the same everywhere.
#
# Testing the lead byte alone is not good enough: E2 also leads the general
# punctuation block, so a title opening with a curly quote (“Offline mode” …),
# an em dash, or an ellipsis would be rejected as an emoji. Those are ordinary
# prose, and a wrong block wedges an agent in a retry loop it cannot satisfy —
# so match the actual symbol and emoji ranges and let punctuation through.
starts_with_emoji() {
  stripped="${1#"${1%%[![:space:]]*}"}"
  [ -n "$stripped" ] || return 1

  # shellcheck disable=SC2046 # deliberate word-splitting of the byte list
  set -- $(printf '%s' "$stripped" | od -An -tu1 -N4 | tr -s ' ' '\n' | grep -v '^$')
  b1=${1:-0}
  b2=${2:-0}
  b3=${3:-0}
  b4=${4:-0}

  if [ "$b1" -ge 240 ]; then
    codepoint=$(((b1 - 240) * 262144 + (b2 - 128) * 4096 + (b3 - 128) * 64 + (b4 - 128)))
  elif [ "$b1" -ge 224 ]; then
    codepoint=$(((b1 - 224) * 4096 + (b2 - 128) * 64 + (b3 - 128)))
  else
    # ASCII, or a 2-byte sequence (Latin-1 supplement, accented letters).
    return 1
  fi

  # U+1F000-U+1FBFF emoji planes · U+2600-U+27BF symbols and dingbats ·
  # U+2B00-U+2BFF arrows and stars · U+231A-U+23F3 watch, hourglass, media.
  # U+2000-U+206F punctuation is deliberately absent.
  if [ "$codepoint" -ge 126976 ] && [ "$codepoint" -le 130047 ]; then return 0; fi
  if [ "$codepoint" -ge 9728 ] && [ "$codepoint" -le 10175 ]; then return 0; fi
  if [ "$codepoint" -ge 11008 ] && [ "$codepoint" -le 11263 ]; then return 0; fi
  if [ "$codepoint" -ge 8986 ] && [ "$codepoint" -le 9203 ]; then return 0; fi
  return 1
}

# --- Title -----------------------------------------------------------------
if [ -n "$title" ]; then
  # Retired 2026-08-27: prefixes are carried by labels and state, not the title.
  if printf '%s' "$title" | grep -qiE '^\[tracking\]'; then
    add "Title starts with [tracking]. That prefix is retired — the 'maintenance' label plus Backlog state already say this is uncommitted signal."
  fi
  if printf '%s' "$title" | grep -qiE '^(plan|backlog|idea|ui|state/api|contracts|docs|community|editorial|release ops|qa pass [0-9]+|qa|chore|spike|recurring|epic):'; then
    add "Title starts with a lane or record-type prefix. Write what a person would say broke or should exist; labels carry the rest."
  fi
  if printf '%s' "$title" | grep -qE '^P[0-9][: ]'; then
    add "Title carries a priority prefix. Linear's priority field owns that."
  fi
  if starts_with_emoji "$title"; then
    add "Title starts with an emoji. Plain text only."
  fi
fi

# A create must carry the problem/outcome block; the contract calls it the one
# section that is never optional. An update may legitimately touch state,
# labels, or relations alone, so only creates are required to have a body.
if [ "$is_update" = "no" ] && [ -z "${description//[$'\n\t ']/}" ] && [ "$has_patch" = "no" ]; then
  add "New issue has no body. Say what breaks and for whom, or what should exist and why — that block is never optional."
elif [ "$is_update" = "yes" ] && [ "$sent_description" = "yes" ] && [ -z "${description//[$'\n\t ']/}" ]; then
  add "This update erases the body. The problem/outcome block is never optional — rewrite it rather than blanking it."
fi

# Absolute rules — banned tokens and empty scaffolding — hold for any prose the
# call carries, whether it replaces the body or patches into it. Cumulative
# rules (heading count, word count) are checked on `description` only, since a
# patch fragment cannot tell us the size of the resulting document.
check_banned_tokens() {
  scope="$1"
  text="$2"
  [ -n "$text" ] || return 0

  if printf '%s' "$text" | grep -qE 'status\.json|execution_sub_lanes|laneSyncMode|plan\.todo\.md'; then
    add "$scope cites plan-hub internals (status.json / execution_sub_lanes). Link the plan directory instead."
  fi
  if printf '%s' "$text" | grep -qE '\bW[0-9]{1,2}\b'; then
    add "$scope uses screen codes (W12 and similar). Use the screen's human name."
  fi
  if printf '%s' "$text" | grep -qE '§[0-9]'; then
    add "$scope carries a spec citation (§5.1). Drop it, or link the file if the reader truly needs it."
  fi
  # Empty scaffolding — the failure that produced sections reading "—" and
  # paragraphs explaining that telemetry found nothing.
  if printf '%s' "$text" | grep -qE '^[[:space:]]*(—|-|N/A|TBD|None|needs repro|needs definition|needs investigation)[[:space:]]*$'; then
    add "$scope renders an empty section placeholder. Drop the section instead — a heading with nothing under it costs the reader a stop."
  fi
  # Strip any heading level generically: an H1 (`# 🔴 Counts`) must be caught
  # alongside an H2, so the marker run and its following space both go.
  while IFS= read -r heading; do
    [ -n "$heading" ] || continue
    stripped_heading="${heading#"${heading%%[![:space:]#]*}"}"
    if starts_with_emoji "$stripped_heading"; then
      add "$scope has an emoji heading. Plain headings only."
      break
    fi
  done <<EOF
$(printf '%s\n' "$text" | grep -E '^[[:space:]]*#{1,6} ' || true)
EOF
}

# --- Body ------------------------------------------------------------------
if [ -n "$description" ]; then
  headings=$(printf '%s\n' "$description" | grep -cE '^ {0,3}#{1,6} ' || true)
  words=$(printf '%s' "$description" | wc -w | tr -d ' ')
  # Umbrella trackers and roadmaps legitimately run long; they still obey the
  # heading cap and the banned-token rules.
  # Callers pass labels either as bare child names (`plans`, what save_issue
  # accepts) or in the namespaced display form (`source:plans`, what plan-hub
  # writes into its manifest). Accept both so the exemption cannot depend on
  # which spelling a given writer happens to use.
  is_umbrella=no
  case ",$labels," in
    *,plans,* | *,source:plans,*) is_umbrella=yes ;;
  esac

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

  check_banned_tokens "Body" "$description"
fi

if [ -n "${patch_text//[$'\n\t ']/}" ]; then
  check_banned_tokens "Patched text" "$patch_text"
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
