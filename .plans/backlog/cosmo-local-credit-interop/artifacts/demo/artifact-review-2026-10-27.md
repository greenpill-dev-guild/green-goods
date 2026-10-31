# Artifact review · clickable demo · 27 October 2026

What a judge meets in the published demo, read after the layout change below, and where it could
be stronger to review, understand and reason about. The first section says what changed today;
the rest are findings in the order a judge meets them, each with the evidence, why it matters and
a proposed fix. Nothing in the app changed. Rendered proof below is CI Playwright (headless
Chromium on the built page), not an authenticated session.

## Done today: the screens are larger

Afo's feedback: the devices were too small because the words sat under them, with empty space on
both sides. On a wide landscape window (1000px and up) the words now stand in a column of fixed
width at the right, so Back and Next keep one place, and the device takes the whole height under
the bar in the space that remains. A phone screen fills that height; a desktop screen fills the
width beside the column. The caption is set in the deck's serif as the screen's headline, with the
chips and who you are above it and the counter and controls below. Narrower, or in portrait, the
words sit under the device as before, and the 390px layout is unchanged to the pixel.

| Window | Phone screen, before → after | Desktop screen, before → after |
|---|---|---|
| 1280x720 | 220px → 300px wide (+36%) | 704px → 883px wide (+25%) |
| 1440x900 | 301px → 383px (+27%) | 987px → 1012px (+3%) |
| 1536x864 | 284px → 367px (+29%) | 926px → 1082px (+17%) |
| 1920x1080 | 383px → 467px (+22%) | 1269px → 1384px (+9%) |

A first version centered the device and the column as a pair, which `check.mjs` caught: the column
then moved about 300px sideways whenever the story went from a phone screen to a desktop one, so
Next would have jumped under the cursor. The column is fixed instead. `check.mjs` now measures the
body rather than the stage, requires the device's middle to hold beside the words, and keeps the
shared top and bottom under them; it passes with 0 problems (62 screens, 35 back regions, at
1440x900, 1280x720, 768x1024 and 390x844, light and dark). Every caption holds two lines from
1024x768 to 2560x1440. Published to the artifact as version 17; the Drive copy still needs the
new `output/green-goods-sf-live-demo.html`.

## Applied on 28 October

Afo took areas 1, 2, 3, 4, 5, 7, 8 and 9, and added three of his own from a laptop: the intro and
the close still scrolled a little, the column stood at the window's edge away from a phone screen,
and every site link should open the beta. All of it is in the page now, with the README's
[task record](README.md#task-record--the-judges-review-applied) as the evidence: area 1 by the
reorder (the split stays an option), 2 by `focus` regions on the three desktop story screens, 4 by
captions (the re-capture stays the stronger fix), 5 with the Drive PDFs, 6 left to the pitch owner
with the link now on beta.greengoods.app. The findings below are kept as they were read.

## 1. The page is one 8.8 MB file, and the intro finishes last

Served over a 20 Mbps connection the page takes about 4.2 seconds to arrive, and about 2 seconds
at 50 Mbps (headless Chromium, throttled). The headline and lede show at once, since their markup
comes first, but the chapter list and the hero phone are drawn by the script at the end of the
file, after the 8.8 MB of inlined screens. A judge on venue wifi sees a finished headline, an
empty phone frame and no chapters for a few seconds, which reads as broken.

Two fixes, in order of effort:

- **Reorder.** Move the inlined screens after the main script and have `src()` resolve them
  lazily (a marker in the head says they are inline, so a screen shows nothing rather than a broken
  image until the block has arrived, then a render on `DOMContentLoaded` fills it). The intro is
  then complete at first paint and the hero fills in. `build.mjs` and the page's script change;
  the Drive copy stays one file.
- **Split.** Publish the screens as the artifact's own files (the Artifact tool takes supporting
  files beside the page) so the page is about 90 KB, each screen loads when shown and the next one
  preloads, which the script already does. The page already falls back to `assets/screens/<file>.jpg`
  when no block is inlined. Needs a test that the artifact serves its files through a shared link,
  and a build variant; the Drive copy stays single-file.

## 2. Desktop screens shrink the one dialog a judge must read

Desktop screens are captured at 1440x900 (at 1.5x) and shown at 883px wide on a 1280x720 laptop
and 1012px at 1440x900, so the dashboard's body text renders at about 8 to 10px. The story's
desktop screens each turn on one dialog: the steward's review (approval-3, Approve), Green Goods'
Accept (swap-7), the evidence ledger (impact-2) and the donation (funding-5). swap-7 is already
captured at 1152x720 for this reason; approval-3 stays at 1440x900 because its form needs the
height.

Fix: give a story screen an optional `focus` rectangle in `#flows` that the player scales the
image into (a transform on the image, with the hotspot and back regions mapped through it), so
the story shows the dialog about a third larger while the appendix keeps the whole screen. Medium
effort; the capture stays as it is.

## 3. A cold judge is not told who the people are, or what "In pilot" means

The intro's lede carries the framing, but the three people appear only inside the player, as
"You are Ifeoma, a member of the hub", "You are Obinna, the hub's steward" and "You are Funmi, a
supporter". The hand-offs at screens 4→5 and 9→10 land without warning. The "In pilot" chip is on
the intro, the hero and every voucher screen, and the only definition is "vouchers are in pilot"
in the facts line; a judge can read "pilot" as "not working".

Fix: one line on the intro naming the hub and the three people ("Obinna runs Tech and Sun's hub in
Awka; Ifeoma is a member; Funmi supports it"), and one sentence defining the chip, worded by the
[claim ledger](../../research/claim-ledger.md) (the voucher contracts are deployed on public
networks; the screens show demo data). A `title` on the chip would carry the same sentence on
hover. Low effort.

## 4. Numbers a judge has to reconcile across screens

- Screen 3 says the promise pays "2 vouchers and $20 in G$"; screen 6 shows "2 Tech and Sun
  vouchers and 155,460 G$". The caption on screen 3 bridges the G$ figure once; screen 6 does not.
- Screen 8 says "She swaps 8 of her 9 earned vouchers". This promise paid 2, so the 9 come from
  promises the story never shows (the README says so; the page does not).
- Screen 8 shows her receiving 8 Green Goods vouchers; screen 9 shows her giving 10 and "You hold
  10". The appendix's swap-5 ("She holds 10 now, enough to book") bridges the gap, and the story
  skips it.

Fix, either: re-capture the swap so the figures add up on their own (hold the vouchers this season
earned, swap exactly what the seat costs, hold no Green Goods vouchers before), or carry the
bridges in the captions ("She swaps 8 of the 9 vouchers her promises earned", "With 10 she books
the seat") and keep swap-5 in the story, which the twelve-screen budget allows if screen 7 goes.
The capture is the stronger fix; captions are an hour.

## 5. The close points at the deck, and nothing links to it

The close says "The deck covers the revenue model and how this grows from one hub to more places",
and the demo has no link to the deck or the brief. A judge who opens only the demo (the artifact
link stands on its own in the submission) cannot follow that pointer.

Fix: link the deck and brief PDFs where the submission allows (the Drive folder in the artifacts
README), or cut the sentence. Low effort.

## 6. "See TAS HUB on Green Goods" opens a page with known read failures

The close's live link opens the hub's public page on greengoods.app. The
[UI review](ui-review-2026-10-27.md) found the Impact page showing "Not available right now" twice
and "Some figures are unavailable right now" on develop, and Green Goods' own pool failing to load
voucher bookings on the hosted indexer. A judge who clicks through from a polished demo into a
page with read failures loses trust in the demo.

Fix: walk the live hub page and the record it links before the pitch, and point the link at a page
that renders cleanly (the bootcamp's public record, impact-3, if the hub page does not). Low
effort; a decision for the pitch owner.

## 7. The nine chapter intros never render

Every appendix chapter carries a one- or two-sentence `intro` in `#flows` ("Obinna signs in to the
dashboard, looks over the hub's earlier assessment, and records this season's need…") that
`check.mjs` checks and the page never shows. A judge who opens a chapter from the list lands on its
first screen with a five-word caption.

Fix: show the chapter's intro in the side column under the caption on the every-step track, in a
box of fixed height (three lines), and on the chapter tile. Low effort now that the column exists.

## 8. The ways to move on are not announced

The pulsing ring says where to tap, and the arrow keys, the strip's bars and the app's own back
buttons all work, but nothing says so. A judge who reads the ring as a highlight rather than a
button reaches for Next every time, which works, and never learns the faster way.

Fix: one hint on the story's first screen, under the counter ("Tap the ring, or press →"), gone
after the first move; and a slightly stronger hover on the strip's bars. Low effort.

## 9. Smaller points

- **The intro scrolls by 63px at 1280x720.** The chapter list's last line sits under the fold, so
  "See every step" and the chapters read as the whole intro. Tightening the hero's vertical
  padding at short heights fixes it.
- **The hand-offs could carry a visual cue.** The DASHBOARD and APP chips share one green. A
  second tint for the dashboard (or the website) would mark the change of hands on screens 5, 10
  and 11 before the words do.
- **The hero phone is small (216px at 1440).** It is a teaser, not a screen to read, and the
  intro's height is the constraint; leave it unless the intro is rebuilt.
- **Thumbnails on the close and the chapter list** are recognisable as shapes, not readable. Fine
  for navigation.
- **Fonts load from Google Fonts.** Offline, Georgia and the system sans apply, as documented; the
  page still works.

What already serves a judge well: the twelve-screen story with its chapter strip, the "You are…"
line on every screen, the counter, the fixed layout, the appendix behind "See every step", the
alt text on every screen, the live caption for screen readers, focus management, reduced motion,
dark mode, and deep links to any screen.
