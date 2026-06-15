#!/usr/bin/env bun

if (process.env.CI === 'true') {
  console.warn(
    '[browser-qa] CI=true: allowing clean-room browser proof. Do not report this as authenticated local QA.',
  );
  process.exit(0);
}

console.error(
  [
    '[browser-qa] Local agentic browser QA must use the authenticated Brave QA profile.',
    '[browser-qa] Codex: use the Codex browser-extension path and claim the already-open Brave tab/window.',
    '[browser-qa] Claude Code: use the Claude Code Chrome/Chromium extension path (`claude --chrome` or `/chrome`) and select the authenticated Brave profile/tab when connected.',
    '[browser-qa] Claude fallback: if the Brave extension path is unavailable, use computer-use/visible desktop control of the already-open Brave window.',
    '[browser-qa] Do not run isolated Browser, Playwright, or DevTools MCP profiles for local QA.',
    '[browser-qa] If authenticated Brave access is blocked, report QA as blocked.',
  ].join('\n'),
);
process.exit(1);
