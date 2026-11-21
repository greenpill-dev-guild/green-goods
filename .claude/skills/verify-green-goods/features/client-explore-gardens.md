# Explore gardens

A signed-in member opens Explore, sees the gardens they can visit as cards, and opens one to reach
that garden's page with its Work, Insights and Gardeners sections.

## Sub-features

- `explore-list` shows each garden as a card with its name, members and place.
- `explore-open` opens a garden's page from its card.
- `garden-page` shows the garden's heading, place, founding date and section switcher.

## How to get to it (user POV)

- Go to `/home/explore` (Explore from the Home tab).
- Open a garden link directly: `/home/<garden address>`.

## Driving it with verify-control

Preconditions:

- The client is launched and `doctor` prints `ok`.
- The fixture garden `Test Community Garden` exists (it always does under the client fixtures).

- **Open Explore.** `--step "goto:/home/explore?presentation=pwa"`. The heading `Explore Gardens`
  and a card whose heading is `Test Community Garden` appear (`--step "expect:heading:Test Community Garden"`).
- **Capture the list.** `--step "snapshot:list-<width>.aria.txt" --step "screenshot:list-<width>.png"`.
  The snapshot shows a button `Member Test Community Garden 1 member · Nairobi`.
- **Open the garden.** `--step "click:heading:Test Community Garden"`, then
  `--step "expect-url:/home/0x1234567890abcdef1234567890abcdef12345678"` and
  `--step "expect-hidden:heading:Explore Gardens"`, then wait for the garden page itself with
  `--step "expect:group:Garden sections"` (the page shows `Loading garden...` first).
- **Proof.** `--step "snapshot:detail-<width>.aria.txt" --step "screenshot:detail-<width>.png"`.
  The snapshot shows heading level 1 `Test Community Garden`, `Nairobi`, a `Garden sections` group
  with `Work`, `Insights` and `Gardeners`, and the empty-work heading
  `No work yet, get started by submitting new work.`

## Gotchas

- The URL changes before the garden page renders; capturing right after `expect-url` records the
  Explore list, and leaving Explore does not mean the garden has loaded. Wait with
  `expect-hidden:heading:Explore Gardens`, then `expect:group:Garden sections`.
- The card heading and the page heading share the name, so `expect:heading:Test Community Garden`
  alone cannot tell the two pages apart.
- The list's `Filters` button is disabled until the gardens load; it says nothing about the journey.
- Two 403s (avatars) and a blocked `localhost:3005` request appear in the console on every run.
