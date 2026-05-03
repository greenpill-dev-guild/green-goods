/* global React */
// ─── Sheet System — LeftSheet + RightSheet generic containers ─────────────────
// Both are bounded between AppBar (top: 64px) and NavBar (bottom: 64px).
// They coexist without z-index conflict — left vs right sides of the canvas.
// Content is passed as children; the shell handles animation, scrim, close.

const { useState, useEffect, useRef } = React;

// ─── LeftSheet container ──────────────────────────────────────────────────────
function LeftSheet({ open, onClose, children, width = 480 }) {
  return (
    <>
      {/* Scrim — covers MainSheet only (between appbar and navbar) */}
      <div
        className={`sheet-scrim sheet-scrim-left ${open ? "is-visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet panel */}
      <aside
        className={`left-sheet ${open ? "is-open" : ""}`}
        style={{ width }}
        role="dialog"
        aria-modal="true"
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  );
}

// ─── RightSheet container ─────────────────────────────────────────────────────
function RightSheet({ open, onClose, children, width = 360 }) {
  return (
    <>
      {/* Scrim */}
      <div
        className={`sheet-scrim sheet-scrim-right ${open ? "is-visible" : ""}`}
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Sheet panel */}
      <aside
        className={`right-sheet ${open ? "is-open" : ""}`}
        style={{ width }}
        role="dialog"
        aria-modal="false"
        aria-hidden={!open}
      >
        {children}
      </aside>
    </>
  );
}

// ─── Sheet header ─────────────────────────────────────────────────────────────
function SheetHeader({ title, subtitle, onClose, leading }) {
  return (
    <div className="sheet-header">
      <div className="sheet-header-left">
        {leading && <div className="sheet-header-leading">{leading}</div>}
        <div>
          <div className="sheet-header-title">{title}</div>
          {subtitle && <div className="sheet-header-sub">{subtitle}</div>}
        </div>
      </div>
      <button className="iconbtn" onClick={onClose} aria-label="Close sheet">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Sheet body (scrollable) ──────────────────────────────────────────────────
function SheetBody({ children, padded = true }) {
  return (
    <div className={`sheet-body ${padded ? "sheet-body-padded" : ""}`}>
      {children}
    </div>
  );
}

// ─── Sheet footer ─────────────────────────────────────────────────────────────
function SheetFooter({ children }) {
  return <div className="sheet-footer">{children}</div>;
}

// ─── Sheet divider ────────────────────────────────────────────────────────────
function SheetDivider() {
  return <div className="sheet-divider" />;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HEADER SHEET CONTENTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Notifications content ────────────────────────────────────────────────────
const NOTIFICATIONS = [
  {
    id: "n1", unread: true, type: "submission",
    title: "New submission pending review",
    body: "Maria Garcia submitted \u201cPlanted 50 native saplings\u201d in Milpa Alta.",
    when: "2 min ago",
    action: "Review"
  },
  {
    id: "n2", unread: true, type: "flag",
    title: "Submission flagged",
    body: "Luis Hernández’s “Pollinator strip seeded” was flagged for missing evidence.",
    when: "18 min ago",
    action: "View"
  },
  {
    id: "n3", unread: true, type: "certified",
    title: "Action certified",
    body: "Marta Vega’s “Greywater filter assembled” passed certification in Xochimilco.",
    when: "1h ago",
    action: null
  },
  {
    id: "n4", unread: false, type: "submission",
    title: "New submission pending review",
    body: "Diego Flores submitted “Planted herbs in containers” in Xochimilco.",
    when: "5h ago",
    action: "Review"
  },
  {
    id: "n5", unread: false, type: "system",
    title: "Template updated",
    body: "Action template “Compost bin installation” was updated to v1.3.",
    when: "Yesterday",
    action: null
  },
  {
    id: "n6", unread: false, type: "certified",
    title: "Action certified",
    body: "Ana Lopez’s “Installed 2 solar panels” passed certification in Milpa Alta.",
    when: "Yesterday",
    action: null
  },
];

const NOTIF_ICONS = {
  submission: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/>
    </svg>
  ),
  flag: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 21V4h12l-2 4 2 4H4"/>
    </svg>
  ),
  certified: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
    </svg>
  ),
  system: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>
    </svg>
  ),
};

const NOTIF_TYPE_COLOR = {
  submission: { bg: "rgba(59,130,246,0.10)", fg: "#3B82F6" },
  flag:       { bg: "rgba(224,56,53,0.10)",  fg: "#E03835" },
  certified:  { bg: "rgba(26,117,68,0.10)",  fg: "#1A7544" },
  system:     { bg: "rgba(120,113,108,0.10)", fg: "#57534E" },
};

function NotificationsContent({ onClose }) {
  const [notifs, setNotifs] = useState(NOTIFICATIONS);
  const unreadCount = notifs.filter(n => n.unread).length;

  const markAllRead = () => setNotifs(notifs.map(n => ({ ...n, unread: false })));
  const markRead = (id) => setNotifs(notifs.map(n => n.id === id ? { ...n, unread: false } : n));

  return (
    <>
      <SheetHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
        onClose={onClose}
      />
      <div className="notif-toolbar">
        {unreadCount > 0 && (
          <button className="notif-mark-all" onClick={markAllRead}>Mark all as read</button>
        )}
      </div>
      <SheetBody padded={false}>
        <ul className="notif-list">
          {notifs.map((n, i) => {
            const tc = NOTIF_TYPE_COLOR[n.type] || NOTIF_TYPE_COLOR.system;
            return (
              <li
                key={n.id}
                className={`notif-item ${n.unread ? "is-unread" : ""}`}
                onClick={() => markRead(n.id)}
              >
                <div className="notif-icon-wrap" style={{ background: tc.bg, color: tc.fg }}>
                  {NOTIF_ICONS[n.type]}
                </div>
                <div className="notif-body">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-text">{n.body}</div>
                  <div className="notif-meta">
                    <span className="notif-when">{n.when}</span>
                    {n.action && (
                      <button className="notif-action-btn">{n.action} →</button>
                    )}
                  </div>
                </div>
                {n.unread && <span className="notif-unread-dot" aria-label="Unread" />}
              </li>
            );
          })}
        </ul>
      </SheetBody>
    </>
  );
}

// ─── Profile content ──────────────────────────────────────────────────────────
function ProfileContent({ onClose }) {
  const [displayName, setDisplayName] = useState("Alex Moreno");
  const [email] = useState("alex.moreno@wefa.world");
  const [role] = useState("Deployer");
  const [org] = useState("Green Goods Network");

  return (
    <>
      <SheetHeader title="Account" onClose={onClose} />
      <SheetBody>
        {/* Avatar + identity */}
        <div className="profile-identity">
          <div className="profile-avatar">
            <span className="profile-avatar-initials">AM</span>
            <button className="profile-avatar-edit" aria-label="Change photo">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
              </svg>
            </button>
          </div>
          <div>
            <div className="profile-name">{displayName}</div>
            <div className="profile-role-badge">
              <span className="profile-role-dot" />
              {role}
            </div>
          </div>
        </div>

        <SheetDivider />

        {/* Identity fields */}
        <div className="profile-section-label">Identity</div>
        <div className="profile-field-group">
          <div className="profile-field">
            <label className="profile-field-label">Display name</label>
            <input className="profile-input" value={displayName}
              onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="profile-field">
            <label className="profile-field-label">Email</label>
            <input className="profile-input" value={email} readOnly
              style={{ color: "var(--on-surface-muted)", cursor: "default" }} />
          </div>
        </div>

        <SheetDivider />

        {/* Organisation */}
        <div className="profile-section-label">Organisation</div>
        <div className="profile-field-group">
          <div className="profile-field">
            <label className="profile-field-label">Workspace</label>
            <div className="profile-readonly-row">
              <span className="profile-readonly-leaf">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 20a8 8 0 0 0 8-8V4h-8a8 8 0 0 0 0 16Z"/><path d="M5 19c2-3 5-6 9-7"/>
                </svg>
              </span>
              <span className="profile-readonly-val">{org}</span>
            </div>
          </div>
          <div className="profile-field">
            <label className="profile-field-label">Role</label>
            <div className="profile-readonly-row">
              <span className="profile-readonly-val profile-role-val">{role}</span>
              <span className="profile-readonly-hint">Assigned by admin</span>
            </div>
          </div>
        </div>

        <SheetDivider />

        {/* Gardens */}
        <div className="profile-section-label">Assigned gardens</div>
        <div className="profile-garden-list">
          {["Milpa Alta", "Xochimilco", "Tepoztlán"].map(g => (
            <div key={g} className="profile-garden-row">
              <span className="profile-garden-dot" />
              <span className="profile-garden-name">{g}</span>
            </div>
          ))}
        </div>

      </SheetBody>
      <SheetFooter>
        <button className="profile-signout-btn">Sign out</button>
        <div style={{ flex: 1 }} />
        <button className="sheet-save-btn">Save changes</button>
      </SheetFooter>
    </>
  );
}

// ─── Settings content ─────────────────────────────────────────────────────────
function SettingsContent({ onClose }) {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [certAlerts, setCertAlerts] = useState(true);
  const [flagAlerts, setFlagAlerts] = useState(true);
  const [language, setLanguage] = useState("English");
  const [timezone, setTimezone] = useState("America/Mexico_City");

  return (
    <>
      <SheetHeader title="Settings" onClose={onClose} />
      <SheetBody>

        {/* Notifications */}
        <div className="profile-section-label">Notifications</div>
        <div className="settings-toggle-group">
          <SettingsToggle
            label="Email notifications"
            hint="Daily digest of pending reviews"
            checked={emailNotifs}
            onChange={setEmailNotifs}
          />
          <SettingsToggle
            label="Push notifications"
            hint="Real-time alerts in browser"
            checked={pushNotifs}
            onChange={setPushNotifs}
          />
          <SettingsToggle
            label="Certification alerts"
            hint="Notify when an action is certified"
            checked={certAlerts}
            onChange={setCertAlerts}
          />
          <SettingsToggle
            label="Flag alerts"
            hint="Notify when a submission is flagged"
            checked={flagAlerts}
            onChange={setFlagAlerts}
          />
        </div>

        <SheetDivider />

        {/* Locale */}
        <div className="profile-section-label">Locale</div>
        <div className="profile-field-group">
          <div className="profile-field">
            <label className="profile-field-label">Language</label>
            <select className="profile-select" value={language} onChange={e => setLanguage(e.target.value)}>
              <option>English</option>
              <option>Español</option>
              <option>Français</option>
            </select>
          </div>
          <div className="profile-field">
            <label className="profile-field-label">Timezone</label>
            <select className="profile-select" value={timezone} onChange={e => setTimezone(e.target.value)}>
              <option value="America/Mexico_City">America / Mexico City (CST)</option>
              <option value="America/New_York">America / New York (EST)</option>
              <option value="Europe/London">Europe / London (GMT)</option>
              <option value="Europe/Berlin">Europe / Berlin (CET)</option>
            </select>
          </div>
        </div>

        <SheetDivider />

        {/* Danger zone */}
        <div className="profile-section-label">Account</div>
        <div className="settings-danger-group">
          <button className="settings-danger-btn">Export my data</button>
          <button className="settings-danger-btn settings-danger-btn-red">Delete account</button>
        </div>

      </SheetBody>
      <SheetFooter>
        <div style={{ flex: 1 }} />
        <button className="sheet-save-btn">Save settings</button>
      </SheetFooter>
    </>
  );
}

function SettingsToggle({ label, hint, checked, onChange }) {
  return (
    <div className="settings-toggle-row">
      <div className="settings-toggle-text">
        <div className="settings-toggle-label">{label}</div>
        {hint && <div className="settings-toggle-hint">{hint}</div>}
      </div>
      <button
        className={`settings-toggle-btn ${checked ? "is-on" : ""}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className="settings-toggle-thumb" />
      </button>
    </div>
  );
}

window.SheetSystem = {
  LeftSheet,
  RightSheet,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetDivider,
  NotificationsContent,
  ProfileContent,
  SettingsContent,
};
