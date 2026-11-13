// The garden reporting walkthrough: its chapters, its screens (each a Storybook story of the
// reporting lab), what each screen's hotspot and "new" markers point at, and the words the
// player shows beside it. capture.mjs measures the targets; build.mjs writes the player.

export const VIEWPORT = { width: 1440, height: 900 };

const S = "admin-prototypes-garden-reporting-walkthrough-";

export const PERSONA = "You are a steward of Riverbend Compost Collective, a sample garden.";

export const END = {
  title: "That's the walk",
  text: "Every report sits in the tab it improves, built from the cockpit's own components with sample data. See Every Step adds the other states: one band of the queue, a stalled garden, and evidence still missing.",
};

export const CHAPTERS = [
  {
    id: "review",
    title: "Start where you review",
    where: "Hub › Work",
  },
  {
    id: "month",
    title: "What happened this month?",
    where: "Garden › Activity",
  },
  {
    id: "health",
    title: "Is review keeping up?",
    where: "Garden › Health",
  },
  {
    id: "promises",
    title: "Are the season's promises on track?",
    where: "Garden › Promises",
  },
  {
    id: "impact",
    title: "What did the work produce, and what changed?",
    where: "Garden › Impact",
  },
  {
    id: "community",
    title: "Who takes part, and where does the money go?",
    where: "Community › Members, Endowment",
  },
];

// story: the Storybook story id. hotspot: what the steward presses to go on. back: an app
// control that goes back a screen (a dialog's close). fresh: the parts this prototype adds.
// extra: shown only in "See every step".
export const SCREENS = [
  {
    id: "hub-queue",
    chapter: "review",
    story: `${S}hub-work--queue`,
    title: "Your queue says how long work has waited",
    caption:
      "The Hub's Work tab as it ships today, with one addition: chips for how long pending work has waited. Each chip carries its count and filters the queue. Age stays plain ink, never a warning color, as the Hub's own stat says it.",
    fresh: [{ css: '[role="group"][aria-label="Waiting"]', label: "New" }],
    hotspot: { css: '[data-region="canvas-area-bottom"] button', hasText: "Garden" },
    hint: "Open Garden",
    alt: "The Hub's Work tab with 47 pending works, 15 of them waiting over a week, and chips for how long work has waited.",
  },
  {
    id: "hub-band",
    chapter: "review",
    extra: true,
    story: `${S}hub-work--waited-one-to-two-weeks`,
    title: "One chip narrows the queue",
    caption:
      "Choosing 1 to 2 weeks keeps the 15 works that have waited that long, oldest first. A card still opens Review Work, as it does today.",
    fresh: [{ css: '[role="group"][aria-label="Waiting"]', label: "New" }],
    hotspot: { css: '[data-region="canvas-area-bottom"] button', hasText: "Garden" },
    hint: "Open Garden",
    alt: "The Hub's Work tab filtered to work that has waited one to two weeks, oldest first.",
  },
  {
    id: "garden-month",
    chapter: "month",
    story: `${S}garden-activity--month`,
    title: "The month at a glance",
    caption:
      "Garden's Activity tab keeps its Activity Feed and gains a month calendar above it. Each day shows how many works came in and where they stand (approved, waiting or rejected) as an icon and a number, never color alone. Today is marked, and days still to come stay empty.",
    fresh: [{ css: '[data-component="ActivityCalendar"]', label: "New" }],
    hotspot: { role: "button", name: /^Saturday, January 3:/ },
    hint: "Open January 3",
    alt: "Garden's Activity tab with a January calendar above the Activity Feed, and Attention Needed and Key Metrics in the rail.",
  },
  {
    id: "garden-day",
    chapter: "month",
    story: `${S}garden-activity--day-chosen`,
    dialog: true,
    title: "A day opens its work",
    caption:
      "January 3 opens its four works in a dialog over the calendar, the way records open across the cockpit. One was approved and three are waiting, and each row says who sent it and when.",
    fresh: [{ css: '[role="dialog"]', label: "New" }],
    back: { css: '[role="dialog"] button[aria-label="Close"]' },
    hotspot: { css: '[role="dialog"] li button', hasText: "fennel" },
    hint: "Open fennel's cleanup",
    alt: "A dialog titled Saturday, January 3 listing four Ward 4 cleanups over the calendar.",
  },
  {
    id: "garden-work",
    chapter: "month",
    story: `${S}garden-activity--work-open`,
    dialog: true,
    title: "Every date, kept apart",
    caption:
      "Fennel's cleanup was performed on January 2, sent from the device at 5:24 AM on January 3 and recorded at 7:12 AM, and it is still waiting. The record keeps those moments apart, and says so when a date was never recorded. Stewards review it in the Hub.",
    back: { css: '[role="dialog"] button', hasText: "Back to" },
    reveal: { css: '[role="dialog"] button', hasText: "Review in Hub" },
    hotspot: { css: '[role="dialog"] button[aria-label="Close"]' },
    hint: "Close",
    alt: "One Ward 4 cleanup's record: its photo, who sent it, when it was performed, sent and submitted, and its quantities.",
  },
  {
    id: "garden-places",
    chapter: "month",
    story: `${S}garden-activity--month`,
    scrollTo: '[data-component="PlaceActivity"]',
    title: "Where the work happened",
    caption:
      "Below the calendar, Places shows January's sites on a schematic map, not to scale, beside the site list. 50 of 71 works shared a location; the other 21 stay in their own No location row instead of being dropped.",
    fresh: [{ css: '[data-component="PlaceActivity"]', label: "New" }],
    hotspot: { css: '[data-region="canvas-area-bottom"] button', hasText: "Garden" },
    hint: "Open Garden Health",
    alt: "Places on Garden's Activity tab: a schematic map of five sites beside a list with a No location row.",
  },
  {
    id: "garden-health",
    chapter: "health",
    story: `${S}garden-health--review`,
    title: "Review Health joins Garden Health",
    caption:
      "Garden Health stays as it ships. Under it, Review Health gives the shipped stall rule's verdict, how long work has waited, and what came in against what was reviewed each week. An age band opens the Hub's Work tab with that chip chosen.",
    fresh: [{ css: '[data-component="ReviewHealthPanel"]', label: "New" }],
    hotspot: { role: "tab", name: "Promises" },
    hint: "Open Promises",
    alt: "Garden's Health tab: the Garden Health card, and a new Review Health card under it with waiting work by age and a weekly chart.",
  },
  {
    id: "garden-health-stalled",
    chapter: "health",
    extra: true,
    story: `${S}garden-health--review-stalled`,
    title: "When review stalls",
    caption:
      "Hilltop Learning Garden has had no review in over a week while work waits. Review Health and the rail's alert say so in the shipped rule's words.",
    fresh: [{ css: '[data-component="ReviewHealthPanel"]', label: "New" }],
    hotspot: { role: "tab", name: "Promises" },
    hint: "Open Promises",
    alt: "Hilltop Learning Garden's Health tab, with Review Health saying review has stalled.",
  },
  {
    id: "garden-promises",
    chapter: "promises",
    story: `${S}garden-promises--season`,
    title: "The season, drawn",
    caption:
      "What needs you, Offers and Asks and the rail stay as they ship. The season becomes a timeline: the season and its campaign, each promise's deadline, milestones, and planned against recorded work, with today marked. Every item is also a row below it.",
    scrollTo: '[data-component="SeasonTimeline"]',
    fresh: [{ css: '[data-component="SeasonTimeline"]', label: "New" }],
    hotspot: { css: '[data-component="SeasonTimeline"] li button', hasText: "October transfer" },
    hint: "Open October's transfer",
    alt: "Garden's Promises tab with a season timeline between What needs you and Offers and Asks.",
  },
  {
    id: "garden-promise",
    chapter: "promises",
    story: `${S}garden-promises--promise-open`,
    dialog: true,
    title: "A promise and its work",
    caption:
      "October's transfer to the recycler was due October 31 and kept on the 30th. Its dialog lists the transfers recorded toward it and says how work is matched: by the promise's action, within its dates.",
    back: { css: '[role="dialog"] button[aria-label="Close"]' },
    hotspot: { css: '[role="dialog"] button[aria-label="Close"]' },
    hint: "Close",
    alt: "October's transfer promise open in a dialog, with its due date and the transfer work that kept it.",
  },
  {
    id: "garden-impact",
    chapter: "impact",
    story: `${S}garden-impact--outputs`,
    title: "What the work produced",
    caption:
      "Above the shipped Recent Hypercerts and Assessments, Output Trends charts each measure by week in its own unit, reported against approved. The backlog shows here too: the week of January 5 reported 941 kg sorted, and 321 kg are approved so far.",
    fresh: [{ css: '[data-component="OutputTrends"]', label: "New" }],
    hotspot: { role: "button", name: /^Week of Jan 5: 941 reported/ },
    hint: "Open the week of Jan 5",
    alt: "Garden's Impact tab with Output Trends: waste sorted, sent to the recycler and compost batch input, each by week.",
  },
  {
    id: "garden-week",
    chapter: "impact",
    story: `${S}garden-impact--outputs`,
    click: { role: "button", name: /^Week of Jan 5: 941 reported/ },
    dialog: true,
    title: "A week opens its records",
    caption:
      "The week of January 5 opens the sorting records behind its bar, each with its status, so the gap between reported and approved has names and dates.",
    back: { css: '[role="dialog"] button[aria-label="Close"]' },
    hotspot: { css: '[role="dialog"] button[aria-label="Close"]' },
    hint: "Close",
    alt: "The week of January 5's sorting records in a dialog over Output Trends.",
  },
  {
    id: "garden-evidence",
    chapter: "impact",
    story: `${S}garden-impact--outputs`,
    scrollTo: '[data-component="EvidenceOutcomes"]',
    title: "What changed, and what shows it",
    caption:
      "Evidence and Outcomes keeps activity, output and outcome apart. Riverbend's baseline found 4 of every 10 sacks at the River Road dump; a later site walk, marked proposed, found 2, with dated evidence beside it.",
    fresh: [{ css: '[data-component="EvidenceOutcomes"]', label: "New" }],
    hotspot: { css: '[data-region="canvas-area-bottom"] button', hasText: "Community" },
    hint: "Open Community",
    alt: "Evidence and Outcomes on the Impact tab: the baseline, a proposed later observation, and dated evidence.",
  },
  {
    id: "garden-evidence-missing",
    chapter: "impact",
    extra: true,
    story: `${S}garden-impact--evidence-missing`,
    scrollTo: '[data-component="EvidenceOutcomes"]',
    title: "When evidence is missing",
    caption:
      "Hilltop has a baseline but no later observation yet. The card says the gap plainly instead of drawing a change it cannot show.",
    fresh: [{ css: '[data-component="EvidenceOutcomes"]', label: "New" }],
    hotspot: { css: '[data-region="canvas-area-bottom"] button', hasText: "Community" },
    hint: "Open Community",
    alt: "Hilltop's Evidence and Outcomes with a baseline and no later observation.",
  },
  {
    id: "community-members",
    chapter: "community",
    story: `${S}community--members`,
    title: "Who takes part",
    caption:
      "Participation sits above the Member Directory: accounts reporting each week, those coming back, and attendance, kept apart from unique people, which nobody records. Nobody is ranked.",
    fresh: [{ css: '[data-component="ParticipationView"]', label: "New" }],
    hotspot: { role: "tab", name: "Endowment" },
    hint: "Open Endowment",
    alt: "Community's Members tab with Participation above the Member Directory.",
  },
  {
    id: "community-endowment",
    chapter: "community",
    story: `${S}community--endowment`,
    title: "Where the money goes",
    caption:
      "The funding history fills the Endowment tab: each asset's balance over time, what came in, went out and was allocated, and the ledger. Approving work pays no one, and an allocation is a plan, not a payment.",
    fresh: [{ css: '[data-component="FundingHistory"]', label: "New" }],
    hotspot: { role: "tab", name: "Payouts" },
    hint: "Finish",
    alt: "Community's Endowment tab with the funding history beside Endowment Status.",
  },
];
