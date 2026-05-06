/* global React, HubAtoms, GardenAtoms */
const { useState } = React;
const { AppBar, NavBar, I } = HubAtoms;
const {
  GIcons, GardenAvatar, MemberAvatar, RoleChip, VisibilityChip, Sparkline, TallyBar,
  GARDEN, MEMBERS, ROLE_DIST, PENDING_INVITES, ACTIVITY, SUPPORTERS,
  TREASURY_TOKENS, DISTRIBUTIONS, PROPOSAL_DRAFTS, SETTINGS_BLOCKS,
} = GardenAtoms;

// ─── VARIATION A — Dossier ─────────────────────────────────────────────
// Top tabs · flat hairlined surfaces · Hub-grammar inheritance.
// 4 tabs: Overview · Members · Settings · Treasury.

const TABS_A = [
  { id: "overview",  label: "Overview" },
  { id: "members",   label: "Members",  count: 23 },
  { id: "settings",  label: "Settings" },
  { id: "treasury",  label: "Treasury", count: 3 },
];

function GardenA({ theme = "light", initialTab = "overview" }) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="canvas garden garden-a" data-theme={theme}>
      <AppBar garden={GARDEN.name} mode="desktop" />

      <main className="mainsheet g-mainsheet">
        {/* Sticky identity strip */}
        <header className="g-id-strip g-id-sticky">
          <div className="g-id-left">
            <GardenAvatar name={GARDEN.name} size={56} />
            <div className="g-id-text">
              <h1 className="g-id-name">{GARDEN.name}</h1>
              <div className="g-id-meta">
                <span className="g-id-ens">{GARDEN.ens}</span>
                <span className="g-id-sep">·</span>
                <span className="g-id-loc"><GIcons.pinMap /> {GARDEN.location}</span>
                <span className="g-id-sep">·</span>
                <span>{GARDEN.count} gardeners</span>
                <VisibilityChip value={GARDEN.visibility} />
              </div>
            </div>
          </div>
          <div className="g-id-actions">
            <button className="btn-ghost btn-ghost-md"><GIcons.external /> View public</button>
            <button className="btn-primary btn-primary-md"><GIcons.edit /> Edit garden</button>
          </div>
        </header>

        {/* Stats strip — sits above the tab rail */}
        <section className="g-stats-strip" aria-label="Garden status">
          <div className="g-status-cell">
            <span className="g-status-label">Season</span>
            <span className="g-status-value">{GARDEN.season}</span>
            <span className="g-status-sub">Day {GARDEN.daysIntoCycle} of cycle</span>
          </div>
          <div className="g-status-cell">
            <span className="g-status-label">Next assessment</span>
            <span className="g-status-value">{GARDEN.nextAssessment}</span>
            <span className="g-status-sub">Quarterly cadence</span>
          </div>
          <div className="g-status-stats">
            <span className="g-stat-item"><strong>{GARDEN.count}</strong> gardeners</span>
            <span className="g-stat-dot">·</span>
            <span className="g-stat-item"><strong>{GARDEN.openWork}</strong> open work</span>
            <span className="g-stat-dot">·</span>
            <span className="g-stat-item"><strong>{GARDEN.pool}</strong> pool</span>
          </div>
        </section>

        {/* Top tab rail */}
        <div className="seg-tabs g-seg-tabs g-seg-tabs-4" role="tablist">
          {TABS_A.map((t) => (
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
          {tab === "overview" && <OverviewA />}
          {tab === "members"  && <MembersA />}
          {tab === "settings" && <SettingsA />}
          {tab === "treasury" && <TreasuryA />}
        </div>
      </main>

      <NavBar active="Garden" mode="desktop" />
    </div>
  );
}

// ─── Overview · A ──────────────────────────────────────────────────────
function OverviewA() {
  return (
    <div className="g-grid-overview">
      {/* About + Domains (left col) */}
      <section className="g-section g-section-flat g-col-2">
        <div className="g-section-head">
          <h2 className="g-section-title">About</h2>
          <button className="btn-ghost-sm">Edit</button>
        </div>
        <p className="g-prose">{GARDEN.description}</p>
        <div className="g-domain-row">
          <span className="g-domain-label">Domains</span>
          <div className="g-domain-chips">
            {GARDEN.domains.map((d) => (
              <span key={d} className={`g-dom-chip g-dom-${d.toLowerCase()}`}>
                <span className="g-dom-dot" /> {d}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Activity feed (right col, spans both rows) */}
      <section className="g-section g-section-flat g-col-1 g-row-2">
        <div className="g-section-head">
          <h2 className="g-section-title">Recent activity</h2>
          <button className="btn-ghost-sm">All</button>
        </div>
        <ul className="g-activity">
          {ACTIVITY.map((a, i) => (
            <ActivityRow key={i} a={a} />
          ))}
        </ul>
      </section>

      {/* Cross-route + quick actions — combined, no whitespace */}
      <section className="g-section g-section-flat g-col-2">
        <div className="g-overview-actions">
          <div className="g-xroute-pair" style={{ gridTemplateColumns: "1fr", padding: 0 }}>
            <a className="g-xroute" href="#hub-history">
              <div className="g-xroute-text">
                <span className="g-xroute-num">{GARDEN.hypercertCount}</span>
                <span className="g-xroute-label">hypercerts minted</span>
              </div>
              <span className="g-xroute-cta">Hub History <GIcons.arrowRight /></span>
            </a>
            <a className="g-xroute" href="#community-proposals">
              <div className="g-xroute-text">
                <span className="g-xroute-num">{GARDEN.proposalsOpen}</span>
                <span className="g-xroute-label">proposals in community vote</span>
              </div>
              <span className="g-xroute-cta">Community <GIcons.arrowRight /></span>
            </a>
          </div>
          <div className="g-quick-row">
            <button className="g-quick-chip"><GIcons.members /> Invite member</button>
            <button className="g-quick-chip"><GIcons.vote /> Draft proposal</button>
            <button className="g-quick-chip"><GIcons.settings /> Configure actions</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ActivityRow({ a }) {
  const Icon = ({
    work: GIcons.edit, member: GIcons.members, proposal: GIcons.vote,
    hypercert: GIcons.award, distribution: GIcons.send,
  })[a.type] || GIcons.check;
  return (
    <li className={`g-activity-item tone-${a.tone}`}>
      <span className={`g-activity-icon icon-${a.type}`}><Icon /></span>
      <div className="g-activity-text">
        <div className="g-activity-line"><strong>{a.who}</strong> {a.what}</div>
        <div className="g-activity-when">{a.when}</div>
      </div>
    </li>
  );
}

// ─── Members · A ───────────────────────────────────────────────────────
function MembersA() {
  return (
    <>
      <section className="g-section g-section-flat">
        <div className="g-mem-strip">
          <div className="g-mem-strip-total">
            <span className="g-mem-num">{ROLE_DIST.Operator + ROLE_DIST.Reviewer + ROLE_DIST.Gardener}</span>
            <span className="g-mem-label">total members</span>
          </div>
          <div className="g-mem-roles">
            <RoleSummary role="Operators" count={ROLE_DIST.Operator} />
            <RoleSummary role="Reviewers" count={ROLE_DIST.Reviewer} />
            <RoleSummary role="Gardeners" count={ROLE_DIST.Gardener} />
            <RoleSummary role="Pending"   count={ROLE_DIST.Pending} pending />
          </div>
        </div>

        <div className="g-mem-toolbar">
          <div className="g-chip-row">
            {["All", "Operators", "Reviewers", "Gardeners", "Pending"].map((c, i) => (
              <button key={c} className={`g-filter-chip ${i === 0 ? "is-active" : ""}`}>{c}</button>
            ))}
          </div>
          <div className="g-mem-toolbar-right">
            <label className="search search-compact" style={{ width: 240 }}>
              <I.search /><input placeholder="Search by name or ENS" />
            </label>
            <button className="btn-primary btn-primary-md"><GIcons.members /> Invite member</button>
          </div>
        </div>

        <table className="g-table">
          <thead>
            <tr><th>Member</th><th>Role</th><th>Work</th><th>Joined</th><th>Last active</th><th aria-label="actions" /></tr>
          </thead>
          <tbody>
            {MEMBERS.map((m) => (
              <tr key={m.id}>
                <td>
                  <div className="g-roster-row g-roster-row-tight">
                    <MemberAvatar name={m.name} id={m.id} size={32} />
                    <div className="g-roster-text">
                      <div className="g-roster-name">{m.name}</div>
                      <div className="g-roster-ens">{m.ens}</div>
                    </div>
                  </div>
                </td>
                <td><RoleChip role={m.role} /></td>
                <td className="num">{m.work}</td>
                <td className="muted">{m.joined}</td>
                <td className="muted">{m.active}</td>
                <td><button className="iconbtn iconbtn-sm" aria-label="More"><GIcons.more /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="g-section g-section-flat g-pending">
        <div className="g-section-head">
          <h2 className="g-section-title">Pending invitations <span className="g-section-meta">{PENDING_INVITES.length} sent</span></h2>
        </div>
        <ul className="g-pending-list">
          {PENDING_INVITES.map((p, i) => (
            <li key={i} className="g-pending-row">
              <span className="g-pending-ens">{p.ens}</span>
              <RoleChip role={p.role} />
              <span className="g-pending-meta">Sent by {p.sentBy} · {p.sent}</span>
              <div className="g-pending-actions">
                <button className="btn-ghost-sm">Resend</button>
                <button className="btn-ghost-sm g-danger">Revoke</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function RoleSummary({ role, count, pending }) {
  return (
    <div className={`g-role-sum ${pending ? "is-pending" : ""}`}>
      <span className="g-role-count">{count}</span>
      <span className="g-role-label">{role}</span>
    </div>
  );
}

// ─── Settings · A ──────────────────────────────────────────────────────
function SettingsA() {
  return (
    <div className="g-set-stack">
      {SETTINGS_BLOCKS.map((b) => (
        <section key={b.group} className="g-section g-section-flat">
          <div className="g-section-head">
            <h2 className="g-section-title">{b.group}</h2>
          </div>
          <dl className="g-set-list">
            {b.rows.map((s, i) => (
              <div key={i} className="g-set-row">
                <dt className="g-set-label">{s.label}</dt>
                <dd className={`g-set-value ${s.mono ? "mono" : ""} ${s.muted ? "muted" : ""}`}>
                  {s.value}
                  {s.sub && <span className="g-set-sub">{s.sub}</span>}
                </dd>
                {s.editable
                  ? <button className="g-set-edit-b"><GIcons.edit /> Edit</button>
                  : <span className="g-set-locked">Locked</span>}
              </div>
            ))}
          </dl>
        </section>
      ))}

      {/* Danger zone */}
      <section className="g-section g-danger-zone">
        <div className="g-section-head">
          <h2 className="g-section-title"><GIcons.warn /> Danger zone</h2>
        </div>
        <ul className="g-danger-list">
          <li className="g-danger-row">
            <div>
              <div className="g-danger-title">Archive garden</div>
              <div className="g-danger-sub">Garden becomes read-only. Existing hypercerts and treasury balances persist.</div>
            </div>
            <button className="btn-danger">Archive…</button>
          </li>
          <li className="g-danger-row">
            <div>
              <div className="g-danger-title">Transfer ownership</div>
              <div className="g-danger-sub">Hand operator role to another ENS. Requires 2-of-3 reviewer co-sign.</div>
            </div>
            <button className="btn-danger">Transfer…</button>
          </li>
        </ul>
      </section>
    </div>
  );
}

// ─── Treasury · A ──────────────────────────────────────────────────────
function TreasuryA() {
  return (
    <div className="g-grid-treasury">
      {/* Header strip */}
      <section className="g-section g-section-flat g-col-span-2">
        <div className="g-trez-strip">
          <div className="g-trez-balance">
            <span className="g-trez-label">Total pool</span>
            <span className="g-trez-amount">$43,440</span>
            <span className="g-trez-tokens">12.4 ETH · 1,840 USDC · 62k GG</span>
          </div>
          <div className="g-trez-meta">
            <div><span className="g-trez-label">Supporters</span><span className="g-trez-meta-val">1,243</span></div>
            <div><span className="g-trez-label">Last distribution</span><span className="g-trez-meta-val">{GARDEN.lastDistribution}</span></div>
            <div><span className="g-trez-label">Next distribution</span><span className="g-trez-meta-val">May 1 · proposed</span></div>
          </div>
        </div>
      </section>

      {/* Token balance breakdown */}
      <section className="g-section g-section-flat g-col-span-2">
        <div className="g-section-head">
          <h2 className="g-section-title">Balance by token</h2>
        </div>
        <div className="g-token-grid">
          {TREASURY_TOKENS.map((t) => (
            <article key={t.token} className="g-token-card">
              <header className="g-token-head">
                <span className="g-token-symbol">{t.token}</span>
                <span className="g-token-usd">{t.usd}</span>
              </header>
              <div className="g-token-balance">{t.balance}</div>
              <div className="g-token-spark"><Sparkline values={t.spark} width={220} height={36} /></div>
              <div className="g-token-delta">{t.delta}</div>
            </article>
          ))}
        </div>
      </section>

      {/* Distribution history */}
      <section className="g-section g-section-flat g-col-2">
        <div className="g-section-head">
          <h2 className="g-section-title">Distribution history</h2>
          <button className="btn-ghost-sm">All</button>
        </div>
        <ul className="g-dist-list">
          {DISTRIBUTIONS.map((d, i) => (
            <li key={i} className="g-dist-row">
              <span className="g-dist-date">{d.date}</span>
              <span className="g-dist-amount">{d.amount}</span>
              <span className="g-dist-recipient">{d.recipient}</span>
              <a className="g-dist-prop" href="#">{d.proposal} <GIcons.arrowRight /></a>
            </li>
          ))}
        </ul>
      </section>

      {/* Proposal drafts */}
      <section className="g-section g-section-flat g-col-1">
        <div className="g-section-head">
          <h2 className="g-section-title">Proposal drafts</h2>
        </div>
        <ul className="g-draft-list">
          {PROPOSAL_DRAFTS.map((p) => (
            <li key={p.id} className="g-draft-row">
              <div className="g-draft-head">
                <span className="g-draft-id mono">{p.id}</span>
                <span className={`g-draft-status status-${p.status.toLowerCase()}`}>{p.status}</span>
              </div>
              <div className="g-draft-title">{p.title}</div>
              <div className="g-draft-foot">
                <span className="g-draft-meta">Updated {p.updated}</span>
                {p.status === "Ready"
                  ? <button className="btn-primary-sm"><GIcons.send /> Publish to community</button>
                  : <button className="btn-ghost-sm">Continue draft</button>}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Supporters */}
      <section className="g-section g-section-flat g-col-span-2">
        <div className="g-section-head">
          <h2 className="g-section-title">Recent supporters</h2>
          <span className="g-section-meta">1,243 total · view full in Community People</span>
        </div>
        <ul className="g-sup-list">
          {SUPPORTERS.map((s, i) => (
            <li key={i} className="g-sup-row">
              <MemberAvatar name={s.ens} id={i} size={28} />
              <span className="g-sup-ens">{s.ens}</span>
              <span className="g-sup-amount">{s.amount}</span>
              <span className="g-sup-lifetime muted">lifetime {s.lifetime}</span>
              <span className="g-sup-when">{s.last}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

window.GardenA = GardenA;
