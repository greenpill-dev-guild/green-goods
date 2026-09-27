import type { ReportingCore } from "./runtime";

/**
 * Stable channel identity under HMAC key rotation.
 *
 * `channel_subjects.id` is the sender's identity within a provider realm; lookup rows are only
 * versioned aliases. Intake tries every accepted key version, reuses the subject when any alias
 * matches and adds the current alias. A uniqueness conflict means another writer created the same
 * subject first, so the lookup is repeated instead of creating a second identity. A keyring
 * failure propagates and blocks intake rather than minting a duplicate.
 *
 * All functions here expect to run inside the caller's transaction.
 */
const SUBJECT_PURPOSE = "channel-subject";
const CHAT_PURPOSE = "conversation";

export function normalizeExternalId(value: string): string {
  return value.normalize("NFC").trim();
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  return code === "SQLITE_CONSTRAINT_UNIQUE" || code === "SQLITE_CONSTRAINT_PRIMARYKEY";
}

interface AliasTable {
  table: "subject_lookups" | "conversation_lookups";
  ownerColumn: "channel_subject_id" | "conversation_id";
  hmacColumn: "subject_hmac" | "chat_hmac";
  purpose: string;
}

const SUBJECT_ALIASES: AliasTable = {
  table: "subject_lookups",
  ownerColumn: "channel_subject_id",
  hmacColumn: "subject_hmac",
  purpose: SUBJECT_PURPOSE,
};

const CHAT_ALIASES: AliasTable = {
  table: "conversation_lookups",
  ownerColumn: "conversation_id",
  hmacColumn: "chat_hmac",
  purpose: CHAT_PURPOSE,
};

function findByAlias(core: ReportingCore, aliases: AliasTable, realm: string, value: string) {
  for (const version of core.keyring.lookupVersions) {
    const row = core.db
      .query(
        `SELECT ${aliases.ownerColumn} AS owner FROM ${aliases.table}
         WHERE provider_realm = $realm AND hmac_key_version = $version AND ${aliases.hmacColumn} = $hmac`
      )
      .get({
        realm,
        version,
        hmac: core.keyring.lookup(version, aliases.purpose, `${realm}\u0000${value}`),
      }) as {
      owner: string;
    } | null;
    if (row) return row.owner;
  }
  return null;
}

/**
 * Adds the current-version alias. On the create path it must be strict: a conflict there means
 * another writer registered the same sender first, and ignoring it would leave a second identity.
 */
function addCurrentAlias(
  core: ReportingCore,
  aliases: AliasTable,
  owner: string,
  realm: string,
  value: string,
  strict = false
) {
  const version = core.keyring.currentLookupVersion;
  core.db
    .query(
      `INSERT ${strict ? "" : "OR IGNORE "}INTO ${aliases.table}
         (${aliases.ownerColumn}, provider_realm, hmac_key_version, ${aliases.hmacColumn}, created_at)
       VALUES ($owner, $realm, $version, $hmac, $now)`
    )
    .run({
      owner,
      realm,
      version,
      hmac: core.keyring.lookup(version, aliases.purpose, `${realm}\u0000${value}`),
      now: core.clock.now(),
    });
}

function resolveOrCreate(
  core: ReportingCore,
  aliases: AliasTable,
  realm: string,
  rawValue: string,
  create: (id: string, value: string) => void
): { id: string; created: boolean } {
  const value = normalizeExternalId(rawValue);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const existing = findByAlias(core, aliases, realm, value);
    if (existing) {
      addCurrentAlias(core, aliases, existing, realm, value);
      return { id: existing, created: false };
    }
    const id = core.ids.id();
    try {
      core.db.transaction(() => {
        create(id, value);
        addCurrentAlias(core, aliases, id, realm, value, true);
      })();
      return { id, created: true };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error("Identity alias conflict did not resolve to an existing record");
}

export function resolveChannelSubject(
  core: ReportingCore,
  realm: string,
  externalSubjectId: string,
  provisionalExpiresAt: number
): { id: string; created: boolean } {
  return resolveOrCreate(core, SUBJECT_ALIASES, realm, externalSubjectId, (id, value) => {
    core.db
      .query(
        `INSERT INTO channel_subjects (id, provider_realm, subject_ciphertext, created_at, expires_at)
         VALUES ($id, $realm, $ciphertext, $now, $expires)`
      )
      .run({
        id,
        realm,
        ciphertext: core.keyring.seal(value, `channel_subjects.subject:${id}`),
        now: core.clock.now(),
        expires: provisionalExpiresAt,
      });
  });
}

export function resolveConversation(
  core: ReportingCore,
  realm: string,
  chat: { externalChatId: string; threadId?: string; kind: "direct" | "group" },
  provisionalExpiresAt: number
): { id: string; created: boolean } {
  const key = `${normalizeExternalId(chat.externalChatId)}\u0000${chat.threadId ?? ""}`;
  return resolveOrCreate(core, CHAT_ALIASES, realm, key, (id) => {
    const now = core.clock.now();
    core.db
      .query(
        `INSERT INTO conversations (id, provider_realm, kind, external_chat_ciphertext, created_at, updated_at, expires_at)
         VALUES ($id, $realm, $kind, $ciphertext, $now, $now, $expires)`
      )
      .run({
        id,
        realm,
        kind: chat.kind,
        ciphertext: core.keyring.seal(
          JSON.stringify({
            chatId: normalizeExternalId(chat.externalChatId),
            threadId: chat.threadId ?? null,
          }),
          `conversations.chat:${id}`
        ),
        now,
        expires: provisionalExpiresAt,
      });
    core.db.query("INSERT INTO conversation_leases (conversation_id) VALUES ($id)").run({ id });
  });
}

export function decryptConversationChat(
  core: ReportingCore,
  conversationId: string
): { providerRealm: string; chatId: string; threadId: string | null } | null {
  const row = core.db
    .query("SELECT provider_realm, external_chat_ciphertext FROM conversations WHERE id = $id")
    .get({ id: conversationId }) as {
    provider_realm: string;
    external_chat_ciphertext: string | null;
  } | null;
  if (!row?.external_chat_ciphertext) return null;
  const chat = JSON.parse(
    core.keyring.open(row.external_chat_ciphertext, `conversations.chat:${conversationId}`)
  ) as {
    chatId: string;
    threadId: string | null;
  };
  return { providerRealm: row.provider_realm, ...chat };
}

/** Adds current-version aliases for every live subject and conversation (rotation step two). */
export function backfillLookupAliases(core: ReportingCore): {
  subjects: number;
  conversations: number;
} {
  const subjects = core.db
    .query(
      "SELECT id, provider_realm, subject_ciphertext FROM channel_subjects WHERE subject_ciphertext IS NOT NULL"
    )
    .all() as Array<{ id: string; provider_realm: string; subject_ciphertext: string }>;
  for (const subject of subjects) {
    const value = core.keyring.open(
      subject.subject_ciphertext,
      `channel_subjects.subject:${subject.id}`
    );
    addCurrentAlias(core, SUBJECT_ALIASES, subject.id, subject.provider_realm, value);
  }
  const chats = core.db
    .query("SELECT id FROM conversations WHERE external_chat_ciphertext IS NOT NULL")
    .all() as Array<{ id: string }>;
  for (const chat of chats) {
    const decrypted = decryptConversationChat(core, chat.id);
    if (!decrypted) continue;
    addCurrentAlias(
      core,
      CHAT_ALIASES,
      chat.id,
      decrypted.providerRealm,
      `${decrypted.chatId}\u0000${decrypted.threadId ?? ""}`
    );
  }
  return { subjects: subjects.length, conversations: chats.length };
}

/** Rotation step three: records still lacking a current alias. Retirement requires zero. */
export function missingCurrentAliases(core: ReportingCore): number {
  const version = core.keyring.currentLookupVersion;
  const row = core.db
    .query(
      `SELECT
         (SELECT count(*) FROM channel_subjects s WHERE s.subject_ciphertext IS NOT NULL AND NOT EXISTS
            (SELECT 1 FROM subject_lookups l WHERE l.channel_subject_id = s.id AND l.hmac_key_version = $version))
       + (SELECT count(*) FROM conversations c WHERE c.external_chat_ciphertext IS NOT NULL AND NOT EXISTS
            (SELECT 1 FROM conversation_lookups l WHERE l.conversation_id = c.id AND l.hmac_key_version = $version))
       AS missing`
    )
    .get({ version }) as { missing: number };
  return row.missing;
}

export function retireLookupVersion(core: ReportingCore, version: string): void {
  if (version === core.keyring.currentLookupVersion)
    throw new Error("Cannot retire the current lookup key");
  if (missingCurrentAliases(core) > 0) throw new Error("Current lookup aliases are incomplete");
  core.db.query("DELETE FROM subject_lookups WHERE hmac_key_version = $version").run({ version });
  core.db
    .query("DELETE FROM conversation_lookups WHERE hmac_key_version = $version")
    .run({ version });
}
