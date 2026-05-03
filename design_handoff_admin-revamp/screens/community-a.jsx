/* global React, HubAtoms, GardenAtoms, CommunityAtoms */
const { useState } = React;
const { AppBar, NavBar, I: HI } = HubAtoms;
const { GIcons, MemberAvatar, RoleChip, VisibilityChip, TallyBar, GARDEN } = GardenAtoms;
const {
  CIcons, COMMUNITY_EVENTS, TOP_CONTRIBUTORS, ACTIVITY_HEADER,
  PROPOSALS, COMMUNITY_PEOPLE, PEOPLE_BREAKDOWN,
} = CommunityAtoms;

// ─── /community shell — same chrome as /garden, 3 tabs ──────────────────
const COMMUNITY_TABS = [
  { id: "activity",  label: "Activity" },
  { id: "proposals", label: "Proposals", count: PROPOSALS.filter(p => p.status === "Voting" || p.status === "Drafting").length },
  { id: "people",    label: "People",    count: PEOPLE_BREAKDOWN.total },
];

function CommunityA({ theme = "light", initialTab = "activity" }) {
  const [tab, setTab] = useState(initialTab);
  return (
    <div className="canvas garden garden-a community" data-theme={theme}>
      <AppBar garden={GARDEN.name} mode="desktop" />

      <main className="mainsheet g-mainsheet">
        {/* Sticky identity strip — same as Garden, but framed by route */}
        <header className="g-id-strip g-id-sticky">
          <div className="g-id-left">
            <span className="c-route-pill">
              <CIcons.message /> Community
            </span>
            <div className="g-id-text">
              <h1 className="g-id-name g-id-name-sm">{GARDEN.name}</h1>
              <div className="g-id-meta">
                <span className="g-id-ens">{GARDEN.ens}</span>
                <span className="g-id-sep">·</span>
                <span>{GARDEN.count} gardeners · {PEOPLE_BREAKDOWN.supporters} supporters</span>
                <VisibilityChip value={GARDEN.visibility} />
              </div>
            </div>
          </div>
          <div className="g-id-actions">
            <button className="btn-ghost-md"><CIcons.external /> View public</button>
            <button className="btn-primary-md"><GIcons.vote /> New proposal</button>
          </div>
        </header>

        {/* Tabs — 3 in /community */}
        <div className="seg-tabs g-seg-tabs c-seg-tabs-3" role="tablist">
          {COMMUNITY_TABS.map((t) => (
            <button key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`seg-tab ${tab === t.id ? "is-active" : ""}`}
              onClick={() => setTab(t.id)}>
              <span>{t.label}</span>
              {t.count !== undefined && (
                <span className={`tab-count ${tab === t.id ? "is-active" : ""}`}>{t.count.toLocaleString()}</span>
              )}
            </button>
          ))}
        </div>

        <div className="g-content">
          {tab === "activity"  && <ActivityTab />}
          {tab === "proposals" && <ProposalsTab />}
          {tab === "people"    && <PeopleTab />}
        </div>
      </main>

      <NavBar active="Community" mode="desktop" />
    </div>
  );
}

// ═══ ACTIVITY ═══════════════════════════════════════════════════════════
function ActivityTab() {
  const [filter, setFilter] = useState("All");
  const filterChips = ["All", "Work", "Proposals", "Milestones", "Discussions"];
  const matches = (item) => {
    if (filter === "All") return true;
    if (filter === "Work") return item.type === "work";
    if (filter === "Proposals") return item.type === "proposal-decided";
    if (filter === "Milestones") return item.type === "milestone";
    if (filter === "Discussions") return item.type === "discussion";
    return true;
  };
  return (
    <>
      {/* Header strip — chip-shaped stats (replaces Overview tab) */}
      <section className="c-act-header">
        <div className="c-stat-chip">
          <div className="c-avatar-stack">
            {TOP_CONTRIBUTORS.map((c, i) => (
              <span key={c.id} className="c-stack-slot" style={{ zIndex: 3 - i }}>
                <MemberAvatar name={c.name} id={c.id} size={28} />
              </span>
            ))}
          </div>
          <div className="c-stat-text">
            <span className="c-stat-num">{TOP_CONTRIBUTORS.length}</span>
            <span className="c-stat-label">top contributors this cycle</span>
          </div>
        </div>

        <div className="c-stat-chip">
          <span className="c-stat-icon"><GIcons.vote /></span>
          <div className="c-stat-text">
            <span className="c-stat-num">{ACTIVITY_HEADER.proposalsOpen}</span>
            <span className="c-stat-label">proposals open</span>
          </div>
          <span className="c-stat-badge c-badge-voting">Voting</span>
        </div>

        <div className="c-stat-chip">
          <span className="c-stat-icon"><CIcons.trophy /></span>
          <div className="c-stat-text">
            <span className="c-stat-num">{ACTIVITY_HEADER.milestonesThisMonth}</span>
            <span className="c-stat-label">milestones this month</span>
          </div>
        </div>
      </section>

      {/* Filter chips */}
      <section className="g-section g-section-flat c-feed-shell">
        <div className="c-feed-toolbar">
          <div className="g-chip-row">
            {filterChips.map((c) => (
              <button key={c}
                className={`g-filter-chip ${filter === c ? "is-active" : ""}`}
                onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <span className="g-section-meta">Latest first</span>
        </div>

        {/* Chronological feed with date dividers */}
        <div className="c-feed">
          {COMMUNITY_EVENTS.map((day) => {
            const dayItems = day.items.filter(matches);
            if (!dayItems.length) return null;
            return (
              <div key={day.day} className="c-day-block">
                <div className="c-day-divider">
                  <span className="c-day-label">{day.day}</span>
                  <span className="c-day-line" />
                  <span className="c-day-date">{day.date}</span>
                </div>
                <ul className="c-feed-list">
                  {dayItems.map((it, i) => <FeedCard key={i} it={it} />)}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="c-feed-foot">
          <button className="btn-ghost-sm">Load 20 more</button>
          <span className="c-feed-foot-meta">or jump to month <button className="c-month-jump">Apr 2026 ▾</button></span>
        </div>
      </section>
    </>
  );
}

// ─── Typed feed cards ──────────────────────────────────────────────────
function FeedCard({ it }) {
  if (it.type === "work") return <WorkCard it={it} />;
  if (it.type === "proposal-decided") return <DecidedCard it={it} />;
  if (it.type === "milestone") return <MilestoneCard it={it} />;
  if (it.type === "discussion") return <DiscussionCard it={it} />;
  return null;
}

function CategoryChip({ cat }) {
  const Icon = ({ Habitat: HI.leaf, Agro: HI.leaf, Water: HI.droplet, Waste: HI.recycle, Solar: HI.sun })[cat] || HI.leaf;
  return (
    <span className={`c-cat-chip cat-${cat.toLowerCase()}`}>
      <Icon /> <span>{cat}</span>
    </span>
  );
}

function WorkCard({ it }) {
  return (
    <li className="c-card c-card-work">
      <div className="c-collage">
        {it.photos.slice(0, 3).map((src, i) => (
          <span key={i} className="c-collage-tile" style={{ backgroundImage: `url(${src})` }} />
        ))}
        {it.photoCount > 3 && (
          <span className="c-collage-counter">+{it.photoCount - 3}</span>
        )}
      </div>
      <div className="c-card-body">
        <div className="c-card-row-top">
          <span className="c-card-kind">Work submitted</span>
          <span className="c-card-when">{it.when}</span>
        </div>
        <div className="c-card-title">{it.title}</div>
        <div className="c-card-foot">
          <span className="c-author-row">
            <MemberAvatar name={it.who} id={it.whoId} size={22} />
            <span className="c-author-name">{it.who}</span>
          </span>
          <CategoryChip cat={it.cat} />
          {it.comments > 0 && (
            <span className="c-comment-count"><CIcons.message /> {it.comments}</span>
          )}
        </div>
      </div>
    </li>
  );
}

function DecidedCard({ it }) {
  const total = it.forV + it.againstV + it.abstainV;
  const cls = it.decision.toLowerCase();
  return (
    <li className={`c-card c-card-decided c-decision-${cls}`}>
      <div className="c-card-row-top">
        <span className="c-card-kind"><GIcons.vote /> Proposal decided</span>
        <span className="c-card-when">{it.when}</span>
      </div>
      <div className="c-decided-row">
        <span className="c-prop-id mono">{it.id}</span>
        <span className="c-decided-title">{it.title}</span>
        <span className={`c-decision-badge c-decision-${cls}`}>{it.decision}</span>
      </div>
      <div className="c-tally-block">
        <TallyBar forV={it.forV} againstV={it.againstV} abstainV={it.abstainV} height={8} />
        <div className="c-tally-legend">
          <span><span className="c-tally-dot dot-for" /> For <strong>{it.forV}</strong></span>
          <span><span className="c-tally-dot dot-against" /> Against <strong>{it.againstV}</strong></span>
          <span><span className="c-tally-dot dot-abstain" /> Abstain <strong>{it.abstainV}</strong></span>
          <span className="c-tally-total">{total} of {GARDEN.count} eligible</span>
        </div>
      </div>
    </li>
  );
}

function MilestoneCard({ it }) {
  return (
    <li className="c-card c-card-milestone">
      <span className="c-mile-mark"><CIcons.sparkle /></span>
      <div className="c-mile-text">
        <div className="c-card-row-top">
          <span className="c-card-kind">Milestone</span>
          <span className="c-card-when">{it.when}</span>
        </div>
        <div className="c-mile-title">{it.title}</div>
        <div className="c-mile-sub">{it.sub} · <span className="c-mile-meta">{it.meta}</span></div>
      </div>
    </li>
  );
}

function DiscussionCard({ it }) {
  return (
    <li className="c-card c-card-discussion">
      <span className="c-disc-mark"><CIcons.message /></span>
      <div className="c-card-body">
        <div className="c-card-row-top">
          <span className="c-card-kind">Discussion</span>
          <span className="c-card-when">started {it.when}</span>
        </div>
        <div className="c-card-title">{it.title}</div>
        <div className="c-card-foot c-disc-foot">
          <span className="c-author-row">
            <MemberAvatar name={it.author} id={it.authorId} size={22} />
            <span className="c-author-name">{it.author}</span>
          </span>
          <span className="c-comment-count"><CIcons.message /> {it.comments} replies</span>
          <span className="c-last-reply">
            last reply
            <span className="c-mini-avatar"><MemberAvatar name={it.lastReplier} id={it.lastReplierId} size={18} /></span>
            {it.lastReplier} · {it.lastWhen}
          </span>
        </div>
      </div>
    </li>
  );
}

// ═══ PROPOSALS ══════════════════════════════════════════════════════════
function ProposalsTab() {
  const [filter, setFilter] = useState("Active+Voting");
  const chips = [
    { id: "Active+Voting", label: "Active · Voting" },
    { id: "Drafting", label: "Drafting" },
    { id: "Voting", label: "Voting" },
    { id: "Closed", label: "Closed" },
    { id: "All", label: "All" },
  ];
  const matches = (p) => {
    if (filter === "All") return true;
    if (filter === "Active+Voting") return p.status === "Drafting" || p.status === "Voting";
    return p.status === filter;
  };
  const filtered = PROPOSALS.filter(matches);
  return (
    <>
      <section className="g-section g-section-flat">
        <div className="g-mem-toolbar">
          <div className="g-chip-row">
            {chips.map((c) => (
              <button key={c.id}
                className={`g-filter-chip ${filter === c.id ? "is-active" : ""}`}
                onClick={() => setFilter(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="g-mem-toolbar-right">
            <label className="search search-compact" style={{ width: 240 }}>
              <HI.search />
              <input placeholder="Search by title or proposal ID" />
            </label>
            <button className="btn-primary-md"><GIcons.vote /> New proposal</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-title">No active proposals</div>
            <div className="c-empty-sub">Drafts in <a href="#" className="c-empty-link">Garden › Treasury</a> move here when published.</div>
          </div>
        ) : (
          <ul className="c-prop-list">
            {filtered.map((p) => <ProposalCard key={p.id} p={p} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function ProposalCard({ p }) {
  const total = p.forV + p.againstV + p.abstainV;
  const isClosed = p.status === "Closed";
  return (
    <li className={`c-prop-card status-${p.status.toLowerCase()}`}>
      <div className="c-prop-head">
        <div className="c-prop-head-left">
          <span className="c-prop-id mono">{p.id}</span>
          <span className={`c-prop-status status-${p.status.toLowerCase()}`}>
            <span className="c-status-dot" />
            {p.status}
          </span>
          {p.fromTreasuryDraft && (
            <span className="c-prop-origin">from Treasury draft</span>
          )}
        </div>
        <div className="c-prop-head-right">
          {isClosed ? (
            <span className={`c-decision-badge c-decision-${p.decision.toLowerCase()}`}>{p.decision}</span>
          ) : p.timeRemaining ? (
            <span className="c-prop-time"><HI.clock /> {p.timeRemaining}</span>
          ) : (
            <span className="c-prop-time muted">Not yet published</span>
          )}
        </div>
      </div>
      <div className="c-prop-title">{p.title}</div>
      <div className="c-prop-summary">{p.summary}</div>
      <div className="c-prop-tally">
        <TallyBar forV={p.forV} againstV={p.againstV} abstainV={p.abstainV} height={8} />
        <div className="c-tally-legend c-tally-legend-compact">
          <span><span className="c-tally-dot dot-for" /> For <strong>{p.forV}</strong></span>
          <span><span className="c-tally-dot dot-against" /> Against <strong>{p.againstV}</strong></span>
          <span><span className="c-tally-dot dot-abstain" /> Abstain <strong>{p.abstainV}</strong></span>
          {total > 0 && <span className="c-tally-total">{total} / {p.totalEligible}</span>}
        </div>
      </div>
      <div className="c-prop-foot">
        <span className="c-author-row">
          <MemberAvatar name={p.creator} id={p.creatorId} size={20} />
          <span className="c-author-name">{p.creator}</span>
        </span>
        <span className="c-comment-count"><CIcons.message /> {p.comments}</span>
        <div className="c-prop-actions">
          {p.status === "Drafting" && p.fromTreasuryDraft && (
            <button className="btn-ghost-sm">Edit draft</button>
          )}
          {p.status === "Voting" && (
            <button className="btn-ghost-sm">Close voting</button>
          )}
          {p.status === "Closed" && (
            <button className="btn-ghost-sm">Publish results</button>
          )}
          <button className="btn-ghost-sm c-prop-open">Open <CIcons.external /></button>
        </div>
      </div>
    </li>
  );
}

// ═══ PEOPLE ═════════════════════════════════════════════════════════════
function PeopleTab() {
  const [filter, setFilter] = useState("All");
  const chips = ["All", "Gardeners", "Supporters", "Contributors", "Top this cycle"];
  const matches = (p) => {
    if (filter === "All") return true;
    if (filter === "Gardeners")    return p.kind === "Gardener";
    if (filter === "Supporters")   return p.kind === "Supporter";
    if (filter === "Contributors") return p.kind === "Contributor";
    if (filter === "Top this cycle") return p.workCount >= 19 || p.supportedUSD >= 600;
    return true;
  };
  const filtered = COMMUNITY_PEOPLE.filter(matches);
  return (
    <>
      {/* Header strip — total + breakdown */}
      <section className="c-people-header">
        <div className="c-people-total">
          <span className="c-people-total-num">{PEOPLE_BREAKDOWN.total}</span>
          <span className="c-people-total-label">community members</span>
        </div>
        <div className="c-people-breakdown">
          <div className="c-people-cell">
            <span className="c-people-num">{PEOPLE_BREAKDOWN.gardeners}</span>
            <span className="c-people-label">Gardeners</span>
          </div>
          <span className="c-people-sep" />
          <div className="c-people-cell">
            <span className="c-people-num">{PEOPLE_BREAKDOWN.supporters}</span>
            <span className="c-people-label">Supporters</span>
          </div>
          <span className="c-people-sep" />
          <div className="c-people-cell">
            <span className="c-people-num">{PEOPLE_BREAKDOWN.contributors}</span>
            <span className="c-people-label">Contributors</span>
          </div>
        </div>
        <div className="c-people-lens">
          <span className="c-people-lens-label">Lens</span>
          <span className="c-people-lens-value">engagement</span>
          <span className="c-people-lens-sub">Different from Garden › Members (role-config)</span>
        </div>
      </section>

      <section className="g-section g-section-flat">
        <div className="g-mem-toolbar">
          <div className="g-chip-row">
            {chips.map((c) => (
              <button key={c}
                className={`g-filter-chip ${filter === c ? "is-active" : ""}`}
                onClick={() => setFilter(c)}>
                {c}
              </button>
            ))}
          </div>
          <div className="g-mem-toolbar-right">
            <label className="search search-compact" style={{ width: 240 }}>
              <HI.search />
              <input placeholder="Search by name or ENS" />
            </label>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="c-empty">
            <div className="c-empty-title">No supporters yet</div>
            <div className="c-empty-sub">Treasury contributions show up here.</div>
          </div>
        ) : (
          <ul className="c-people-list">
            {filtered.map((p) => <PersonRow key={p.id} p={p} />)}
          </ul>
        )}
      </section>
    </>
  );
}

function PersonRow({ p }) {
  const chips = [];
  if (p.workCount > 0) chips.push({ icon: <GIcons.edit />, label: `${p.workCount} work submitted` });
  if (p.supportedUSD)  chips.push({ icon: <GIcons.heart />, label: `$${p.supportedUSD} supporter` });
  if (p.votesCast > 0) chips.push({ icon: <GIcons.vote />, label: `${p.votesCast} votes cast` });
  if (p.discussions > 0) chips.push({ icon: <CIcons.message />, label: `${p.discussions} discussions` });
  return (
    <li className="c-person-row">
      <MemberAvatar name={p.name} id={p.id} size={36} />
      <div className="c-person-text">
        <div className="c-person-name-row">
          <span className="c-person-name">{p.name}</span>
          <span className={`c-person-kind kind-${p.kind.toLowerCase()}`}>{p.kind}</span>
        </div>
        <div className="c-person-ens">{p.ens}</div>
      </div>
      <div className="c-person-chips">
        {chips.map((c, i) => (
          <span key={i} className="c-engage-chip">{c.icon} <span>{c.label}</span></span>
        ))}
      </div>
      <div className="c-person-active">{p.lastActive}</div>
      <button className="iconbtn iconbtn-sm" aria-label="More"><GIcons.more /></button>
    </li>
  );
}

window.CommunityA = CommunityA;
