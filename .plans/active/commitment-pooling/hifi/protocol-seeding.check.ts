// Direct acceptance proof for the protocol seeding implementation reference.
// Run: bun .plans/active/commitment-pooling/hifi/protocol-seeding.check.ts
import assert from "node:assert/strict";
import { SBS } from "./journeys";
import { ALIASES, HOTS, SCREENS, SCREEN_HOTS, SCREEN_MARKS, TABLES } from "./screens/index";
import { normalizeAndValidate, type Ctx } from "./validate";

const context = (): Ctx => structuredClone({ screens: SCREENS, hots: HOTS, tables: TABLES, screenHots: SCREEN_HOTS, screenMarks: SCREEN_MARKS, aliases: ALIASES });
const screen = (ctx: Ctx) => ctx.screens.find(s => s.id === "W12")!;
const state = (ctx: Ctx, id: string) => screen(ctx).states.find(s => s.id === id)!;
const baseline = normalizeAndValidate(SBS, context());
assert.equal(baseline.errors.length, 0, baseline.errors.join("\n"));
let previousErrors = 0;
let checks = 0;
function rejects(name: string, change: (ctx: Ctx) => void, message: string) {
  const ctx = context();
  change(ctx);
  const result = normalizeAndValidate(SBS, ctx);
  const errors = result.errors.slice(previousErrors);
  previousErrors = result.errors.length;
  assert(errors.some(e => e.includes(message)), `${name}: expected rejection missing`);
  checks++;
}
const good = context();
assert(state(good, "seed-protocol").html.includes("2 of 2 protocol stewards"));
for (const s of screen(good).states.filter(s => s.id.startsWith("seed-offer"))) {
  assert(s.html.includes("Claiming garden’s eligible stewards"));
  assert(!s.html.includes("2 of 2 protocol stewards"));
}
for (const id of ["protocol-reader", "protocol-owner", "seed-unbounded", "seed-offer-unbounded"])
  assert(!/data-hot="w12\.(?:seed|seed-confirm|seed-offer-confirm)"/.test(state(good, id).html));
assert(!state(good, "protocol-reader").html.includes('data-hot="w12.confirm-row"'));
for (const prefix of ["seed", "seed-offer"]) {
  const unbounded = `${prefix}-unbounded`;
  assert(state(good, unbounded).html.includes("No season selected"));
  assert(state(good, unbounded).html.includes("Not set"));
  assert(state(good, unbounded).html.includes("disabled"));
  for (const stage of ["queued", "indexing", "failed", "blocked-authority", "blocked-pool", "blocked-cycle", "blocked-conflict"]) {
    const id = `${prefix}-${stage}`;
    rejects(`missing ${id}`, c => { screen(c).states = screen(c).states.filter(s => s.id !== id); }, `required state ${id} missing`);
    rejects(`missing pool row for ${id}`, c => { state(c, `pool-${id}`).html = state(c, `pool-${id}`).html.replace(`data-hot="w12.${id}-open"`, ""); }, "saved job cannot be reopened");
  }
  for (const [cause, code] of [["authority", "UnauthorizedCaller"], ["pool", "PoolNotInState"], ["cycle", "CycleNotAcceptingCommitments"], ["conflict", "CommitmentCreationRequestConflict"]]) {
    const id = `${prefix}-blocked-${cause}`;
    assert(state(good, id).html.includes(code));
    rejects(`terminal ${id} loses discard`, c => { state(c, id).html = state(c, id).html.replace(`data-hot="w12.${prefix === "seed-offer" ? "seed-offer" : "seed"}-discard"`, ""); }, "terminal failure must explain");
  }
}
rejects("read-only confirmation detail", c => { state(c, "protocol-reader").html += '<button data-hot="w12.confirm-row">Confirm</button>'; }, "read-only viewer has a write-detail path");
rejects("owner-only service creation", c => { state(c, "protocol-owner").html += '<button data-hot="w12.seed">Seed</button>'; }, "unauthorized or unbounded creation");
rejects("Offer self-confirmation", c => { state(c, "seed-offer").html = state(c, "seed-offer").html.replace("Claiming garden’s eligible stewards", "2 of 2 protocol stewards"); }, "Offer confirmation must belong");
rejects("unbounded Offer gains an end on switch", c => { c.hots["w12.seed-unbounded-offer"].to = "screen:W12@seed-offer"; }, "unbounded direction switch loses");
rejects("unbounded Offer can submit", c => { state(c, "seed-offer-unbounded").html += '<button data-hot="w12.seed-offer-confirm">Seed</button>'; }, "unauthorized or unbounded creation");
for (const id of ["w12.seed-retry", "w12.seed-offer-retry"])
  rejects(`missing retry ${id}`, c => { delete c.hots[id]; }, `retry hotspot ${id} missing`);
rejects("Offer retry changes direction", c => { c.hots["w12.seed-offer-retry"].to = "screen:W12@seed-queued"; }, "must preserve Offer direction");
rejects("immediate publication", c => { c.hots["w12.seed-confirm"].to = "screen:W12@seed-published"; }, "creation must land on a queued overlay");
rejects("queued Published chip", c => { state(c, "seed-offer-queued").html += '<span class="ch ok dot">Published</span>'; }, "publication precedes indexed");
console.log(`Protocol seeding: positive authority/direction/recovery assertions and ${checks} negative checks passed`);
