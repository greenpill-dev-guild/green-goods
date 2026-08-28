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

# Words a patch op deletes outright (a replace whose new_string is empty).
# Counted in words rather than characters: a short body is still a body, so
# `replace("Short but complete problem statement.", "")` must be caught even
# though it is under any sensible character threshold, while deleting a stray
# word or two stays ordinary editing.
patch_deleted_words="$(printf '%s' "$payload" | jq -r '
  [ .tool_input.patch // []
    | .[]
    | select((.op // "") | test("^replace"))
    | select(((.new_string // "") | gsub("\\s"; "")) == "")
    | ((.old_string // .from // "") | [splits("\\s+")] | map(select(length > 0)) | length)
  ] | max // 0')"

# Nothing at all to judge: a property-only write (state, labels, relations).
# An explicitly supplied `description` still counts as something to judge even
# when it is empty — that is a body erase, not an untouched body.
# A patch that only deletes has no inserted text to inspect, so it must not be
# mistaken for a property-only write.
if [ -z "$title" ] && [ -z "$description" ] && [ -z "${patch_text//[$'\n\t ']/}" ] &&
  [ "$sent_description" = "no" ] && [ "${patch_deleted_words:-0}" -eq 0 ]; then
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

# Emoji whose first codepoint is ordinary text: keycaps (`1️⃣` = digit + VS16 +
# U+20E3) and variation-selector forms (`©️`). The lead character is ASCII or
# Latin-1, so the codepoint test above passes them; they are still an emoji-led
# title.
#
# Only the FIRST grapheme counts. Scanning a byte window instead would reject
# "A ©️ licensing notice is wrong" — compliant prose that merely contains such a
# sequence later on — so measure the leading character's width and look only at
# the bytes attached directly to it.
leads_with_emoji_sequence() {
  stripped="${1#"${1%%[![:space:]]*}"}"
  [ -n "$stripped" ] || return 1

  bytes="$(printf '%s' "$stripped" | od -An -tx1 -N8 | tr -d ' \n')"
  [ -n "$bytes" ] || return 1
  lead=$((16#${bytes:0:2}))
  if [ "$lead" -ge 240 ]; then
    width=8
  elif [ "$lead" -ge 224 ]; then
    width=6
  elif [ "$lead" -ge 192 ]; then
    width=4
  else
    width=2
  fi

  # VS16 (EF B8 8F) or the combining enclosing keycap (E2 83 A3), attached
  # directly to the leading character.
  case "${bytes:$width:6}" in
    efb88f | e283a3) return 0 ;;
    *) return 1 ;;
  esac
}

# --- Title -----------------------------------------------------------------
# Trim before matching: every prefix rule below is anchored, so a title that
# merely opens with a space would slip all of them and reach Linear looking
# exactly as prefixed as one that did not.
title="${title#"${title%%[![:space:]]*}"}"
title="${title%"${title##*[![:space:]]}"}"

if [ -n "$title" ]; then
  # Retired 2026-08-27: prefixes are carried by labels and state, not the title.
  if printf '%s' "$title" | grep -qiE '^\[tracking\]'; then
    add "Title starts with [tracking]. That prefix is retired — the 'maintenance' label plus Backlog state already say this is uncommitted signal."
  fi
  # Lane names, record types, work types, package names, and team names — the
  # categories that Linear's own fields already carry. Enumerated rather than
  # matched as a generic `Word:` shape, because a colon is legitimate inside a
  # real sentence and blocking those would cost more than the prefixes do.
  if printf '%s' "$title" | grep -qiE '^(plan|backlog|idea|ui|ux|state/api|contracts|docs|documentation|community|editorial|release ops|release|qa pass [0-9]+|qa|chore|spike|recurring|epic|ethonline|bug|fix|hotfix|feature|task|improvement|refactor|incident|research|design|infra|ops|security|perf|performance|test|a11y|i18n|admin|client|shared|indexer|agent|network|growth|marketing)[[:space:]]*:'; then
    add "Title starts with a lane, record-type, or category prefix. Write what a person would say broke or should exist; labels and Linear's own fields carry the rest."
  fi
  # Bare (`P1 …`, `P0: …`) and bracketed (`[P1] …`) review-style forms alike.
  if printf '%s' "$title" | grep -qE '^\[?P[0-9]\]?[[:space:]:]'; then
    add "Title carries a priority prefix. Linear's priority field owns that."
  fi
  if starts_with_emoji "$title" || leads_with_emoji_sequence "$title"; then
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

# A patch carries a fragment, never the resulting document, so a large deletion
# cannot be checked against the caps or the never-optional body rule. Ask for a
# full description in that case: the same erase sent as `description: ""` is
# rejected above, and the patch path must not be the cheaper way to do it.
if [ "${patch_deleted_words:-0}" -ge 5 ]; then
  add "This patch deletes $patch_deleted_words words of the body without replacing them. Send the full description instead, so the result can be checked against the contract."
fi

# Absolute rules — banned tokens and empty scaffolding — hold for any prose the
# call carries, whether it replaces the body or patches into it. Cumulative
# rules (heading count, word count) are checked on `description` only, since a
# patch fragment cannot tell us the size of the resulting document.
# Blank out fenced code blocks, keeping line numbering intact. Structural rules
# — heading count, emoji headings, empty placeholders — are about what Linear
# renders, and it renders a fence as code: four `##` comment lines in a shell
# example are not four headings, and blocking that valid body is the expensive
# kind of mistake. Banned-token checks deliberately still read the fence, since
# citing plan internals inside one is still citing them.
# Tracks the opening delimiter rather than toggling on any fence marker: a
# four-backtick fence demonstrating a three-backtick example stays open in
# Markdown, and closing early would count the inner example's `##` lines as
# headings and reject a valid body.
strip_fenced_code() {
  printf '%s\n' "$1" | awk '
    {
      line = $0
      # Markdown allows a fence up to three spaces of indentation; at four it is
      # an indented code line, not a fence opener. Treating one as an opener
      # starts a block that never closes and masks the whole rest of the body,
      # which would hide every heading after it from the cap.
      if (line ~ /^ {0,3}[^ ]/) sub(/^ {0,3}/, "", line)
      else line = ""
      marker = ""
      if (line ~ /^`{3,}/) marker = "`"
      else if (line ~ /^~{3,}/) marker = "~"

      if (marker != "") {
        run = 0
        while (substr(line, run + 1, 1) == marker) run++
        if (open_marker == "") { open_marker = marker; open_run = run; print ""; next }
        if (marker == open_marker && run >= open_run) { open_marker = ""; print ""; next }
      }

      if (open_marker != "") { print ""; next }
      print
    }
  '
}

check_banned_tokens() {
  scope="$1"
  text="$2"
  [ -n "$text" ] || return 0
  prose="$(strip_fenced_code "$text")"

  if printf '%s' "$text" | grep -qE 'status\.json|execution_sub_lanes|laneSyncMode|plan\.todo\.md'; then
    add "$scope cites plan-hub internals (status.json / execution_sub_lanes). Link the plan directory instead."
  fi
  if printf '%s' "$text" | grep -qE '\bW[0-9]{1,2}\b'; then
    add "$scope uses screen codes (W12 and similar). Use the screen's human name."
  fi
  # The named shorthand forms from AGENTS.md: section signs, register numbers,
  # and decision-log numbers. Deliberately NOT a bare `#\d+` ban — a PR or issue
  # reference ("fixed in #778") is legitimate and useful in a body.
  if printf '%s' "$text" | grep -qE '§[0-9]'; then
    add "$scope carries a spec citation (§5.1). Drop it, or link the file if the reader truly needs it."
  fi
  if printf '%s' "$text" | grep -qiE '\bregister #[0-9]+|\bdecision[ -]log #?[0-9]+'; then
    add "$scope cites internal shorthand (register #90, decision log 4). Those live in .plans — say what it means, or link the file."
  fi
  # Empty scaffolding — the failure that produced sections reading "—" and
  # paragraphs explaining that telemetry found nothing.
  # Bare (`—`) and list-form (`- TBD`, `* N/A`, `1. needs repro`) alike: a
  # bullet does not make an empty slot any more informative.
  if printf '%s' "$prose" | grep -qiE '^[[:space:]]*([-*+]|[0-9]+\.)?[[:space:]]*(—|-|N/A|TBD|None|needs repro|needs definition|needs investigation)[[:space:]]*$'; then
    add "$scope renders an empty section placeholder. Drop the section instead — a heading with nothing under it costs the reader a stop."
  fi
  # Strip any heading level generically: an H1 (`# 🔴 Counts`) must be caught
  # alongside an H2, so the marker run and its following space both go.
  while IFS= read -r heading; do
    [ -n "$heading" ] || continue
    stripped_heading="${heading#"${heading%%[![:space:]#]*}"}"
    if starts_with_emoji "$stripped_heading" || leads_with_emoji_sequence "$stripped_heading"; then
      add "$scope has an emoji heading. Plain headings only."
      break
    fi
  done <<EOF
$(printf '%s\n' "$prose" | grep -E '^[[:space:]]*#{1,6} ' || true)
EOF
}

# --- Body ------------------------------------------------------------------
if [ -n "$description" ]; then
  # ATX (`## Section`) plus Setext — a text line followed directly by `===` or
  # `---`, which Linear renders as a heading whether or not the author meant a
  # separator, so it counts toward the cap the same way.
  # Counted on fence-stripped prose: Linear renders a fenced block as code, so
  # `##` comment lines in a shell example are not headings.
  description_prose="$(strip_fenced_code "$description")"
  atx_headings=$(printf '%s\n' "$description_prose" | grep -cE '^ {0,3}#{1,6} ' || true)
  setext_headings=$(printf '%s\n' "$description_prose" |
    awk 'prev ~ /[^[:space:]]/ && prev !~ /^ {0,3}#/ && /^ {0,3}(=+|-+)[[:space:]]*$/ { n++ } { prev = $0 } END { print n + 0 }')
  headings=$((atx_headings + setext_headings))
  words=$(printf '%s' "$description" | wc -w | tr -d ' ')
  # Umbrella trackers and roadmaps legitimately run long; they still obey the
  # heading cap and the banned-token rules.
  # Callers pass labels either as bare child names (`plans`, what save_issue
  # accepts) or in the namespaced display form (`source:plans`, what plan-hub
  # writes into its manifest). Accept both so the exemption cannot depend on
  # which spelling a given writer happens to use.
  # `plans` alone is not enough: plan-hub stamps it on every mirror it emits,
  # lane issues included, so exempting on it would lift the ceiling for ordinary
  # build and QA work merely because it originated in `.plans`. The roadmap
  # parent is the one that legitimately runs long, and it is the only mirror
  # carrying the architecture activity label.
  is_umbrella=no
  case ",$labels," in
    *,plans,* | *,source:plans,*)
      case ",$labels," in
        *,architecture,* | *,activity:architecture,*) is_umbrella=yes ;;
      esac
      ;;
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
  # The field label is what makes this a metadata line, not the inline-code
  # formatting around its value — `Source plan: .plans/active/x/` is the same
  # metadata-first opening as the backticked form.
  meta_re='^[[:space:]]*(Source plan|Source|Status JSON|Lane|Owner/status|Owner|Handoff|Plan hub):[[:space:]]*[`.a-zA-Z0-9]'
  first_line="$(printf '%s\n' "$description" | grep -vE '^[[:space:]]*$' | head -1)"
  meta_count=$(printf '%s\n' "$description" | grep -cE "$meta_re" || true)

  if printf '%s' "$first_line" | grep -qE "$meta_re"; then
    add "Body opens with lane metadata instead of the problem. Lead with what breaks or what should exist; put the link at the end."
  elif [ "$meta_count" -ge 2 ]; then
    add "Body stacks $meta_count metadata lines (Source / Lane / Owner / Handoff). Say what matters in a sentence and keep one link line at most."
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
