/**
 * Version 1 identity, intake and operations tables. Timestamps are epoch milliseconds. Columns
 * ending in `_ciphertext` hold keyring-sealed values; `*_hmac` columns are versioned lookup
 * aliases, never identity.
 */
export const IDENTITY_AND_INTAKE_TABLES: readonly string[] = [
  `CREATE TABLE operating_controls (
    name TEXT PRIMARY KEY CHECK (name IN ('intake','model_processing','publication','outbound_messages')),
    enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
    version INTEGER NOT NULL CHECK (version >= 1),
    reason TEXT,
    updated_by TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE participants (
    id TEXT PRIMARY KEY,
    identity_epoch INTEGER NOT NULL CHECK (identity_epoch >= 1),
    status TEXT NOT NULL CHECK (status IN ('provisional','active','suspended','deleted')),
    locale TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE channel_subjects (
    id TEXT PRIMARY KEY,
    provider_realm TEXT NOT NULL,
    subject_ciphertext TEXT,
    notice_version TEXT,
    notice_sent_at INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER,
    deleted_at INTEGER
  )`,
  `CREATE TABLE subject_lookups (
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id) ON DELETE CASCADE,
    provider_realm TEXT NOT NULL,
    hmac_key_version TEXT NOT NULL,
    subject_hmac TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (provider_realm, hmac_key_version, subject_hmac),
    UNIQUE (channel_subject_id, hmac_key_version)
  )`,
  `CREATE TABLE channel_bindings (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    status TEXT NOT NULL CHECK (status IN ('provisional','active','suspended','revoked','replaced')),
    identity_epoch INTEGER NOT NULL CHECK (identity_epoch >= 1),
    verified_at INTEGER,
    created_at INTEGER NOT NULL,
    ended_at INTEGER
  )`,
  `CREATE UNIQUE INDEX channel_bindings_one_live_per_subject
    ON channel_bindings(channel_subject_id) WHERE status IN ('provisional','active','suspended')`,
  `CREATE TABLE account_bindings (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    chain_id INTEGER NOT NULL,
    account_address TEXT NOT NULL
      CHECK (account_address = lower(account_address) AND length(account_address) = 42),
    account_kind TEXT NOT NULL CHECK (account_kind IN ('eoa','kernel')),
    status TEXT NOT NULL CHECK (status IN ('active','revoked')),
    verified_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    revoked_at INTEGER
  )`,
  `CREATE UNIQUE INDEX account_bindings_one_live_account
    ON account_bindings(chain_id, account_address) WHERE status = 'active'`,
  `CREATE UNIQUE INDEX account_bindings_one_live_per_participant
    ON account_bindings(participant_id, chain_id) WHERE status = 'active'`,
  `CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    provider_realm TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('direct','group')),
    external_chat_ciphertext TEXT,
    current_garden_chain_id INTEGER,
    current_garden_address TEXT,
    locale TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    expires_at INTEGER,
    CHECK ((current_garden_chain_id IS NULL) = (current_garden_address IS NULL))
  )`,
  `CREATE TABLE conversation_lookups (
    conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    provider_realm TEXT NOT NULL,
    hmac_key_version TEXT NOT NULL,
    chat_hmac TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (provider_realm, hmac_key_version, chat_hmac),
    UNIQUE (conversation_id, hmac_key_version)
  )`,
  `CREATE TABLE conversation_leases (
    conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
    holder TEXT,
    fence INTEGER NOT NULL DEFAULT 0,
    expires_at INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE consent_records (
    id TEXT PRIMARY KEY,
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    participant_id TEXT REFERENCES participants(id),
    purpose TEXT NOT NULL CHECK (purpose IN ('processing','publication','voice')),
    notice_version TEXT NOT NULL,
    resource_kind TEXT CHECK (resource_kind IN ('draft','review')),
    resource_id TEXT,
    resource_revision INTEGER,
    resource_digest TEXT,
    source_event_id TEXT,
    granted_at INTEGER NOT NULL,
    withdrawn_at INTEGER,
    withdrawal_source TEXT,
    CHECK ((purpose = 'publication') = (resource_id IS NOT NULL))
  )`,
  `CREATE INDEX consent_records_live
    ON consent_records(channel_subject_id, purpose) WHERE withdrawn_at IS NULL`,
  `CREATE TABLE inbox_events (
    id TEXT PRIMARY KEY,
    provider_realm TEXT NOT NULL,
    event_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('message','delivery_status')),
    arrival_seq INTEGER NOT NULL UNIQUE,
    conversation_id TEXT REFERENCES conversations(id),
    channel_subject_id TEXT REFERENCES channel_subjects(id),
    payload_ciphertext TEXT,
    state TEXT NOT NULL
      CHECK (state IN ('pending','quarantined','consumed','dead','expired')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL DEFAULT 0,
    last_error_code TEXT,
    received_at INTEGER NOT NULL,
    consumed_at INTEGER,
    expires_at INTEGER,
    UNIQUE (provider_realm, event_id)
  )`,
  `CREATE INDEX inbox_events_pending ON inbox_events(state, conversation_id, arrival_seq)`,
  `CREATE TABLE source_entries (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    channel_binding_id TEXT REFERENCES channel_bindings(id),
    participant_id TEXT REFERENCES participants(id),
    inbox_event_id TEXT NOT NULL UNIQUE REFERENCES inbox_events(id),
    kind TEXT NOT NULL CHECK (kind IN ('text','media','reply','command')),
    content_ciphertext TEXT,
    received_at INTEGER NOT NULL,
    deleted_at INTEGER
  )`,
  `CREATE TABLE processing_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL CHECK (state IN ('pending','leased','succeeded','failed','cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL CHECK (max_attempts >= 1),
    run_after INTEGER NOT NULL,
    lease_holder TEXT,
    lease_expires_at INTEGER,
    fence INTEGER NOT NULL DEFAULT 0,
    payload_json TEXT NOT NULL DEFAULT '{}',
    last_error_code TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX processing_jobs_runnable ON processing_jobs(state, run_after)`,
  `CREATE TABLE audit_events (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    subject_kind TEXT,
    subject_id TEXT,
    detail_json TEXT NOT NULL DEFAULT '{}',
    created_at INTEGER NOT NULL
  )`,
];
