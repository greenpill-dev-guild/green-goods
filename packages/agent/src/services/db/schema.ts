import { Database } from "bun:sqlite";

export function initSchema(db: Database): void {
  db.run(`
      CREATE TABLE IF NOT EXISTS garden_join_requests (
        id TEXT PRIMARY KEY,
        gardenAddress TEXT NOT NULL,
        accountAddressKey TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        kind TEXT NOT NULL,
        state TEXT NOT NULL,
        requestedVia TEXT NOT NULL,
        requestedAt TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        resolvedAt TEXT,
        updatedAt TEXT NOT NULL,
        revision INTEGER NOT NULL DEFAULT 0
      )
    `);
  db.run(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_garden_join_requests_active
      ON garden_join_requests(gardenAddress, accountAddressKey) WHERE state = 'pending'
    `);
  db.run(`
      CREATE INDEX IF NOT EXISTS idx_garden_join_requests_queue
      ON garden_join_requests(gardenAddress, state, requestedAt DESC, id DESC)
    `);
  db.run(`
      CREATE TABLE IF NOT EXISTS garden_join_request_proofs (
        nonce TEXT PRIMARY KEY,
        expiresAt TEXT NOT NULL
      )
    `);
  db.run(`
      CREATE TABLE IF NOT EXISTS saved_offers (
        chainId INTEGER NOT NULL,
        owner TEXT NOT NULL,
        savedOfferId TEXT NOT NULL,
        ciphertext TEXT NOT NULL,
        nonce TEXT NOT NULL,
        version INTEGER NOT NULL,
        updatedAt TEXT NOT NULL,
        deleted INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (chainId, owner, savedOfferId)
      )
    `);
  db.run(`
      CREATE INDEX IF NOT EXISTS idx_saved_offers_owner_active
      ON saved_offers(chainId, owner, deleted, updatedAt)
    `);
  db.run(`
      CREATE TABLE IF NOT EXISTS profile_avatars (
        chainId INTEGER NOT NULL,
        address TEXT NOT NULL,
        avatarUri TEXT,
        version INTEGER NOT NULL,
        updatedAt TEXT NOT NULL,
        PRIMARY KEY (chainId, address)
      )
    `);
  db.run(`
      CREATE TABLE IF NOT EXISTS users (
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        privateKey TEXT NOT NULL,
        address TEXT NOT NULL,
        currentGarden TEXT,
        role TEXT DEFAULT 'gardener',
        locale TEXT,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (platform, platformId)
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        step TEXT NOT NULL DEFAULT 'idle',
        draft TEXT,
        updatedAt INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        PRIMARY KEY (platform, platformId)
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS pending_works (
        id TEXT PRIMARY KEY,
        actionUID INTEGER NOT NULL,
        gardenerAddress TEXT NOT NULL,
        gardenerPlatform TEXT NOT NULL,
        gardenerPlatformId TEXT NOT NULL,
        gardenAddress TEXT NOT NULL,
        data TEXT NOT NULL,
        createdAt INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS idempotency_keys (
        key TEXT PRIMARY KEY,
        handler TEXT NOT NULL,
        platform TEXT NOT NULL,
        platformId TEXT NOT NULL,
        messageId TEXT NOT NULL,
        status TEXT NOT NULL,
        response TEXT,
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        platform TEXT NOT NULL,
        chatId TEXT NOT NULL,
        threadId TEXT,
        messageId TEXT NOT NULL,
        senderPlatformId TEXT NOT NULL,
        senderDisplayName TEXT,
        text TEXT NOT NULL DEFAULT '',
        replyToMessageId TEXT,
        inferredType TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'new',
        postedAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS chat_message_attachments (
        id TEXT PRIMARY KEY,
        chatMessageId TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
        ordinal INTEGER NOT NULL,
        kind TEXT NOT NULL,
        telegramFileId TEXT NOT NULL,
        mimeType TEXT,
        fileSize INTEGER,
        duration INTEGER,
        width INTEGER,
        height INTEGER,
        createdAt INTEGER NOT NULL
      )
    `);

  db.run(
    `CREATE INDEX IF NOT EXISTS idx_users_garden ON users(currentGarden) WHERE currentGarden IS NOT NULL`
  );
  db.run(`CREATE INDEX IF NOT EXISTS idx_pending_works_garden ON pending_works(gardenAddress)`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_idempotency_platform_message
       ON idempotency_keys(platform, platformId, messageId, handler)`
  );
  // The steward role was stored as `operator` until the rename. Both statements are
  // idempotent, and the index has to be dropped because CREATE INDEX IF NOT EXISTS
  // will not change an existing partial index's predicate.
  db.run(`UPDATE users SET role = 'steward' WHERE role = 'operator'`);
  db.run(`DROP INDEX IF EXISTS idx_users_role_garden`);
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_users_role_garden ON users(role, currentGarden) WHERE role = 'steward'`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_status
       ON chat_messages(chatId, threadId, status, postedAt)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_chat_messages_platform_message
       ON chat_messages(platform, chatId, messageId)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_chat_message_attachments_message
       ON chat_message_attachments(chatMessageId, ordinal)`
  );

  db.run(`
      CREATE TABLE IF NOT EXISTS funding_intents (
        id TEXT PRIMARY KEY,
        gardenId TEXT NOT NULL,
        gardenName TEXT NOT NULL,
        gardenLocation TEXT,
        destinationType TEXT NOT NULL,
        destinationAddress TEXT NOT NULL,
        fundingIntent TEXT NOT NULL,
        paymentMethod TEXT NOT NULL,
        availabilityKey TEXT NOT NULL,
        clientRequestId TEXT NOT NULL UNIQUE,
        idempotencyFingerprint TEXT NOT NULL,
        amountUsd TEXT NOT NULL,
        chainId INTEGER NOT NULL,
        token TEXT NOT NULL,
        provider TEXT NOT NULL,
        providerSessionId TEXT,
        providerPaymentId TEXT,
        status TEXT NOT NULL,
        payerEmailHash TEXT,
        receiptTokenHash TEXT NOT NULL,
        quoteExpiresAt TEXT NOT NULL,
        checkoutExpiresAt TEXT,
        receiverAddress TEXT,
        sourceRoute TEXT,
        managementUrl TEXT,
        quotedAssetAmount TEXT,
        minAssetAmount TEXT,
        fundedAssetAmount TEXT,
        fundingTxHash TEXT,
        failureCode TEXT,
        checkoutSession TEXT,
        transactionAttempts TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
      )
    `);

  db.run(`
      CREATE TABLE IF NOT EXISTS funding_intent_events (
        id TEXT PRIMARY KEY,
        intentId TEXT NOT NULL,
        status TEXT NOT NULL,
        note TEXT NOT NULL,
        providerEventId TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY(intentId) REFERENCES funding_intents(id)
      )
    `);

  ensureColumn(db, "funding_intents", "providerSessionId", "TEXT");
  ensureColumn(db, "funding_intents", "providerPaymentId", "TEXT");
  ensureColumn(db, "funding_intents", "sourceRoute", "TEXT");
  ensureColumn(db, "funding_intents", "managementUrl", "TEXT");
  ensureColumn(db, "funding_intent_events", "providerEventId", "TEXT");
  ensureColumn(db, "users", "locale", "TEXT");

  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_funding_tx_hash
       ON funding_intents(fundingTxHash) WHERE fundingTxHash IS NOT NULL`
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_provider_session
       ON funding_intents(providerSessionId) WHERE providerSessionId IS NOT NULL`
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intents_provider_payment
       ON funding_intents(providerPaymentId) WHERE providerPaymentId IS NOT NULL`
  );
  db.run(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_funding_intent_events_provider_event
       ON funding_intent_events(providerEventId) WHERE providerEventId IS NOT NULL`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_funding_intents_status
       ON funding_intents(status, updatedAt)`
  );
  db.run(
    `CREATE INDEX IF NOT EXISTS idx_funding_intent_events_intent
       ON funding_intent_events(intentId, createdAt)`
  );
  db.run("PRAGMA user_version = 7");
}

function ensureColumn(
  db: Database,
  table: "funding_intents" | "funding_intent_events" | "users",
  column: string,
  definition: string
): void {
  const columns = db.query(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some((info) => info.name === column)) {
    db.run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
