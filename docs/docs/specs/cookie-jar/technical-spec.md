---
id: cookie-jar-technical-spec
title: GG-TECH-009 Cookie Jar
sidebar_label: Technical Spec
---

# GG-TECH-009 — Cookie Jar

## Architecture
- `CookieJarModule` mediates approvals and claims.
- Indexer persists `CookieJar` + yield transfer entities.
- Shared `hooks/cookie-jar` provides read/write integration for apps.
