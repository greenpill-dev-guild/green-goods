# BUGBOT: Agent Package

Automated warnings for the multi-platform bot (Telegram).

## Critical Warnings

### Exposed Private Key
```
Pattern: **/*.ts
Trigger: privateKey|PRIVATE_KEY|secret
Without: decrypt|process\.env
Message: "NEVER hardcode private keys. Use encrypted storage or environment variables"
```

### Missing Rate Limit
```
Pattern: src/handlers/**/*.ts
Trigger: export.*handler|handle
Without: rateLimit|cooldown
Message: "Add rate limiting to prevent abuse"
```

### Unsafe Error Message
```
Pattern: **/*.ts
Trigger: catch.*reply\(.*error|catch.*send\(.*error
Message: "Don't expose raw errors to users. Use sanitized messages"
```

### Missing Input Validation
```
Pattern: src/handlers/**/*.ts
Trigger: ctx\.message\.text|update\.message
Without: validate|sanitize|zod
Message: "Validate and sanitize all user input"
```

### Service Without Singleton
```
Pattern: src/services/**/*.ts
Trigger: export class
Without: instance|getInstance|singleton
Message: "Services should be singletons to manage state properly"
```

### Direct API Call
```
Pattern: src/handlers/**/*.ts
Trigger: fetch\(|axios\.|got\(
Message: "Use service layer for API calls, not direct in handlers"
```

## Reference

See `.claude/context/agent.md` for full patterns.
