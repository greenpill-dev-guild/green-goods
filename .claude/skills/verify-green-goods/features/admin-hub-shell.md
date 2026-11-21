# Hub shell

A steward opening the Green Goods Hub sees its header and, once their garden access loads, the
gardens they steward. Today the harness proves the shell only: garden access needs indexer data the
Hub has no shared fixture for.

## Sub-features

- `hub-chrome` shows the `Green Goods Hub` banner and the `Profile` button.
- `hub-garden-access` loads the steward's gardens (blocked here, see Gotchas).

## How to get to it (user POV)

- Open the Hub's root `/` signed in as a steward.

## Driving it with verify-control

Preconditions:

- The Hub is launched (`launch admin`) and `doctor` prints `ok`.
- Drive with the default `steward` role; the helper seeds accepted upload terms so the first-upload
  dialog stays closed.

- **Open the Hub.** `--step "goto:/"`.
- **Proof of the shell.** `--step "snapshot:hub-<width>.aria.txt" --step "screenshot:hub-<width>.png"`.
  The snapshot shows a banner with `Green Goods Hub` and a `Profile` button.
- **Garden access (blocked).** The main area shows the alert `Can't load garden access` with
  `Try Again`, and the transcript lists `[getGardens] Failed to fetch gardens`. Report that as the
  unmet precondition; it is not a pass.

## Gotchas

- The Hub's indexer mocks live in `tests/specs/admin.smoke.spec.ts` (`mockAdminHubBackend`). Until
  they move to `tests/helpers`, `drive admin` installs only the shared RPC mock, so every garden
  read fails and Hub journeys beyond the shell cannot be proved here.
- Without seeded upload terms the `Before You Share` dialog covers the Hub; the helper seeds them
  for every role except `disconnected`.
