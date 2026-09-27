/**
 * Version 1 browser continuation, recovery, command idempotency and delivery tables.
 *
 * Locators, pre-authentication cookies, CSRF tokens and sessions are stored only as hashes. An
 * outbox row is the sole authority for sending a chat message; each dispatch attempt keeps its own
 * provider message ID so a late status for an earlier attempt cannot overwrite a later one.
 */
export const BROWSER_AND_DELIVERY_TABLES: readonly string[] = [
  `CREATE TABLE continuation_requests (
    id TEXT PRIMARY KEY,
    locator_hash TEXT NOT NULL UNIQUE,
    purpose TEXT NOT NULL CHECK (purpose IN ('link_account','publish_work','review_decision',
      'grant_reporting','grant_review','recovery')),
    participant_id TEXT REFERENCES participants(id),
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    channel_binding_id TEXT REFERENCES channel_bindings(id),
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    provider_realm TEXT NOT NULL,
    resource_kind TEXT NOT NULL
      CHECK (resource_kind IN ('draft','review','grant','recovery','account')),
    resource_id TEXT,
    resource_revision INTEGER,
    resource_digest TEXT NOT NULL,
    expected_account TEXT,
    identity_epoch INTEGER NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('open','completed','expired','revoked')),
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    completed_at INTEGER
  )`,
  `CREATE TABLE browser_challenges (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL REFERENCES continuation_requests(id),
    preauth_token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    browser_nonce TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL CHECK (state IN ('issued','proof_verified','paired','session_issued',
      'superseded','expired','rejected')),
    verified_account TEXT,
    verified_account_kind TEXT CHECK (verified_account_kind IN ('eoa','kernel')),
    pairing_code_hash TEXT,
    pairing_attempts INTEGER NOT NULL DEFAULT 0,
    proof_issued_at INTEGER,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    verified_at INTEGER,
    paired_at INTEGER
  )`,
  `CREATE TABLE app_access_grants (
    id TEXT PRIMARY KEY,
    participant_id TEXT NOT NULL REFERENCES participants(id),
    account_binding_id TEXT NOT NULL REFERENCES account_bindings(id),
    browser_challenge_id TEXT NOT NULL REFERENCES browser_challenges(id),
    request_id TEXT NOT NULL REFERENCES continuation_requests(id),
    resource_kind TEXT NOT NULL,
    resource_id TEXT,
    resource_revision INTEGER,
    identity_epoch INTEGER NOT NULL,
    scope_json TEXT NOT NULL,
    session_token_hash TEXT NOT NULL UNIQUE,
    csrf_token_hash TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('active','expired','revoked')),
    expires_at INTEGER NOT NULL,
    revoked_at INTEGER,
    created_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX app_access_grants_one_per_challenge
    ON app_access_grants(browser_challenge_id) WHERE state = 'active'`,
  `CREATE TABLE recovery_requests (
    id TEXT PRIMARY KEY,
    request_id TEXT NOT NULL UNIQUE REFERENCES continuation_requests(id),
    new_channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    new_conversation_id TEXT NOT NULL REFERENCES conversations(id),
    participant_id TEXT REFERENCES participants(id),
    account_binding_id TEXT REFERENCES account_bindings(id),
    expected_epoch INTEGER,
    state TEXT NOT NULL CHECK (state IN ('started','account_verified','channel_verified',
      'confirmed','applied','expired','failed')),
    channel_code_hash TEXT,
    channel_attempts INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    applied_at INTEGER
  )`,
  `CREATE TABLE command_idempotency (
    principal TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    command TEXT NOT NULL,
    request_digest TEXT NOT NULL,
    response_json TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (principal, idempotency_key)
  )`,
  `CREATE TABLE delivery_outbox (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL REFERENCES conversations(id),
    participant_id TEXT REFERENCES participants(id),
    channel_subject_id TEXT NOT NULL REFERENCES channel_subjects(id),
    channel_binding_id TEXT REFERENCES channel_bindings(id),
    identity_epoch INTEGER,
    operation_id TEXT REFERENCES execution_operations(id),
    prompt_id TEXT REFERENCES conversation_prompts(id),
    provider_realm TEXT NOT NULL,
    dedupe_key TEXT NOT NULL UNIQUE,
    reply_kind TEXT NOT NULL,
    audience TEXT NOT NULL CHECK (audience IN ('conversation','bound_participant')),
    payload_ciphertext TEXT,
    state TEXT NOT NULL CHECK (state IN ('pending','dispatching','accepted','sent','delivered',
      'read','retry_wait','uncertain','terminal_failed','suppressed')),
    attempts INTEGER NOT NULL DEFAULT 0,
    next_attempt_at INTEGER NOT NULL,
    last_error_code TEXT,
    dispatch_seq INTEGER NOT NULL UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE INDEX delivery_outbox_dispatchable ON delivery_outbox(state, next_attempt_at)`,
  `CREATE TABLE delivery_attempts (
    id TEXT PRIMARY KEY,
    outbox_id TEXT NOT NULL REFERENCES delivery_outbox(id),
    attempt_number INTEGER NOT NULL CHECK (attempt_number >= 1),
    provider_realm TEXT NOT NULL,
    provider_message_id TEXT,
    state TEXT NOT NULL CHECK (state IN ('dispatching','accepted','sent','delivered','read',
      'failed','uncertain')),
    error_code TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE (outbox_id, attempt_number)
  )`,
  `CREATE UNIQUE INDEX delivery_attempts_provider_message
    ON delivery_attempts(provider_realm, provider_message_id)
    WHERE provider_message_id IS NOT NULL`,
];
