# OpenClaw Agentic Pipeline Plan

**Branch**: `feature/openclaw-pipeline`
**Status**: PLANNING
**Hardware**: Dedicated M4 Mac Mini — 16GB RAM, 10-core CPU/GPU (cloud APIs + local model for heartbeat)
**Created**: 2026-02-27

---

## Context

Green Goods needs an agentic workflow that transforms team Google Meet discussions into tracked, actionable work. The pipeline: meeting transcript → intelligent extraction (bugs, polish, features) → GitHub issues → autonomous agent dispatch for bug fixes → team notifications via Discord and Signal.

**Decision**: Use OpenClaw (237K+ stars, MIT licensed, local-first AI agent platform) running on a dedicated M4 Mac Mini as the orchestration layer. Cloud Claude APIs (Sonnet/Opus) handle complex reasoning; a local Ollama model (llama3.2:3b) handles heartbeats and routine tasks at zero API cost.

---

## Architecture Overview

```
Google Meet → Transcript Source (Fireflies.ai / Google Drive)
                    │
                    │ webhook
                    ▼
              n8n (existing) ──POST──→ OpenClaw Gateway (ws://127.0.0.1:18789)
                                              │
                                    ┌─────────┴──────────┐
                                    ▼                    ▼
                              Lobster Workflow      Channel Adapters
                              (meeting-pipeline)    (Discord + Signal)
                                    │
                      ┌─────────────┼─────────────┐
                      ▼             ▼             ▼
                 LLM Extract   Approval Gate   Dispatch
                 (Sonnet/Opus)  (human review)  (GitHub Issues +
                                                 Claude Code Agent +
                                                 Team Notifications)
```

### Hardware: M4 Mac Mini 16GB Memory Budget

```
Total RAM:           16 GB
macOS + system:      ~4-5 GB
OpenClaw gateway:    ~0.1-1.5 GB (idle → active)
Ollama llama3.2:3b:  ~2-3 GB
OrbStack (Docker):   ~0.04 GB idle
signal-cli (Java):   ~0.2-0.4 GB
─────────────────────────────
Available headroom:  ~6-9 GB
```

16GB is sufficient for cloud-primary routing with a small local model. Do NOT attempt 13B+ models — they'll cause memory pressure and swap thrashing. The 3B model handles heartbeats/classification well within budget.

### Model Routing Strategy

| Task Type | Model | Cost |
|-----------|-------|------|
| Heartbeats, status checks, classification | Ollama llama3.2:3b (local, ~2GB) | $0 |
| Meeting extraction, issue creation | Claude Sonnet 4.6 (API) | ~$3/$15 per 1M tokens |
| Complex reasoning, code generation | Claude Opus 4.6 (API) | ~$15/$75 per 1M tokens |

### Estimated Monthly Cost

| Component | Cost |
|-----------|------|
| Electricity (~40W × 24/7) | ~$3-5 |
| Anthropic API (Sonnet default, Opus complex) | ~$30-60 |
| Tailscale (free personal / $6 team) | $0-6 |
| Fireflies.ai (optional transcript source) | $0-19 |
| Ollama (local) | $0 |
| **Total** | **~$35-90/month** |

---

## Key Decisions

### Why OpenClaw

- Built-in Discord AND Signal channel adapters (first-class, not hacks)
- Lobster workflow engine: deterministic YAML pipelines (LLM does creative work, YAML handles plumbing)
- Skill system uses `SKILL.md` files — same pattern as existing `.claude/skills/`
- Local-first: all data stays on the Mac Mini
- Claude is the recommended/default LLM backend
- MCP server support for GitHub integration
- Heartbeat daemon for autonomous follow-up monitoring
- Webhook ingress for n8n/Fireflies integration

### Why NOT Subscription (API Keys Required)

Anthropic banned subscription OAuth in third-party tools (January 2026). OpenClaw MUST use pay-per-token API keys. Max subscription ($100-200/month) covers Claude.ai and Claude Code CLI only — NOT OpenClaw API calls. These are separate billing systems.

### Why Dedicated Mac Mini (16GB M4)

- M4 runs local 3B model at ~40+ tokens/sec for heartbeats ($0 vs $5-30/day on Opus)
- 16GB is sufficient: ~2-3GB for Ollama 3B + ~1.5GB OpenClaw + ~5GB macOS = comfortable headroom
- 25-40W power draw (vs. hundreds for GPU server)
- Unified memory architecture: GPU shares system RAM for Ollama inference
- Native Metal acceleration (5-6x faster than Docker-based Ollama)
- UPS provides ~20 min runtime for clean shutdown
- Tailscale for secure remote access without port exposure
- **16GB limitation**: Cannot run 13B+ models locally — all complex work routes to cloud APIs (this is the intended design)

---

## Security Hardening (Non-Negotiable)

### Known Risks

| Risk | Detail |
|------|--------|
| 4 CVEs in first 2 months | CVSS 9.9 critical (tool allowlist bypass), all patched in 2026.2.23 |
| Sandboxing OFF by default | Skills execute with full host privileges without explicit enablement |
| Credentials plaintext by default | `~/.openclaw/credentials/` uses file permissions only, no encryption |
| 341 malicious ClawHub skills | "ClawHavoc" supply chain attack on the skill marketplace |
| Prompt injection out-of-scope | Design decision: tool policy + sandbox limit blast radius, not prevention |
| No built-in spending caps | Must set limits at Anthropic Console level |

### Required Hardening

| Priority | Action |
|----------|--------|
| P0 | Update to >= 2026.2.23 (patches all CVEs) |
| P0 | Enable sandbox: `agents.defaults.sandbox.enabled: true` |
| P0 | Set gateway auth token (unauthenticated WS = full agent control) |
| P0 | Keep gateway on loopback (127.0.0.1) — honeypots show exploitation within minutes |
| P1 | Encrypt credentials: `openclaw secrets set` with age encryption |
| P1 | Use `dmPolicy: "allowlist"` on all channels |
| P1 | Configure `tools.deny` for rm -rf, sudo, arbitrary curl |
| P1 | Set Anthropic Console monthly spending cap |
| P2 | Write custom skills only (never install from ClawHub blindly) |
| P2 | Set `session.dmScope: "per-channel-peer"` |
| P2 | Configure `logging.redactPatterns` for API keys, ETH addresses |
| P2 | Run `openclaw security audit --deep` monthly |

---

## Phase 1: Mac Mini Environment Setup

### 1.1 System Preparation

```bash
# Create dedicated user
sudo sysadminctl -addUser openclaw -fullName "OpenClaw Server" \
  -password "STRONG_PASSWORD" -admin

# Disable sleep, enable auto-restart
sudo pmset -a sleep 0 disksleep 0 displaysleep 0 womp 1 autorestart 1

# Configure auto-login (requires FileVault OFF)
# System Settings → Users & Groups → Automatic Login → openclaw

# Disable unnecessary services
sudo mdutil -a -i off                    # Spotlight
sudo systemsetup -setremoteappleevents off
defaults write com.apple.NetworkBrowser DisableAirDrop -bool YES
```

### 1.2 Network & Security

```bash
# Static IP
sudo networksetup -setmanual "Ethernet" 192.168.1.100 255.255.255.0 192.168.1.1
sudo networksetup -setdnsservers "Ethernet" 1.1.1.1 8.8.8.8

# Tailscale (secure remote access)
brew install tailscale
sudo tailscaled &
sudo tailscale up --auth-key=tskey-auth-XXX --ssh

# SSH hardening (/etc/ssh/sshd_config additions)
# PermitRootLogin no
# PasswordAuthentication no
# PubkeyAuthentication yes
# MaxAuthTries 3
# AllowUsers openclaw

# PF Firewall — block all inbound except loopback, LAN SSH, Tailscale
# See /etc/pf.anchors/com.openclaw (detailed config below)

# Application firewall + stealth mode
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setglobalstate on
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --setstealthmode on
```

### 1.3 Dedicated Phone Number for Signal

Signal requires a real phone number for registration. Do NOT use your personal number — get a dedicated one for the bot.

#### Option A: Google Voice (Free, US only) — Recommended

1. Go to https://voice.google.com
2. Sign in with a Google account (can be a team/service account)
3. Select a phone number from available options
4. Link it to your personal phone for initial SMS verification
5. Once set up, Google Voice can receive SMS for signal-cli verification

**Pros**: Free, no monthly cost, US numbers available immediately
**Cons**: US only, requires existing Google account, Google may reclaim inactive numbers

#### Option B: Prepaid SIM ($3-10/month)

1. Buy a cheap prepaid SIM (Mint Mobile, Tello, US Mobile — plans from $3/month)
2. Activate in any unlocked phone
3. Use for signal-cli registration SMS verification
4. After registration, the SIM only needs to stay active (Signal re-verifies periodically)
5. Can use a cheap burner phone or temporarily swap SIM into your phone

**Pros**: Most reliable, works globally, no dependency on VoIP service
**Cons**: Small monthly cost, needs physical SIM management

#### Option C: Twilio ($1.15/month + SMS costs)

1. Create account at https://www.twilio.com
2. Buy a phone number ($1.15/month for US numbers)
3. Configure SMS webhook or use Twilio CLI to receive verification code
4. Register with signal-cli using the Twilio number

```bash
# After getting number, receive SMS via Twilio CLI:
twilio phone-numbers:list
twilio api:core:messages:list --to +1TWILIO_NUMBER
```

**Pros**: Programmable, API access, reliable
**Cons**: Requires Twilio account, small monthly cost, Signal may block known VoIP ranges

#### Registration Steps (after obtaining number)

```bash
# Register the number with Signal
signal-cli -u +1YOUR_DEDICATED_NUMBER register

# Enter the SMS verification code
signal-cli -u +1YOUR_DEDICATED_NUMBER verify CODE_FROM_SMS

# Set a profile name so teammates recognize the bot
signal-cli -u +1YOUR_DEDICATED_NUMBER updateProfile --given-name "Green Goods" --family-name "Bot"

# Test by sending a message
signal-cli -u +1YOUR_DEDICATED_NUMBER send -m "Hello from Green Goods Bot" +1TEAMMATE
```

**Important**: If Signal blocks VoIP number registration, use the prepaid SIM option — it's the most reliable path.

### 1.4 Software Stack Installation

**Order matters — dependencies before OpenClaw.**

```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 22 (OpenClaw requires >= 22)
brew install node@22 && brew link --overwrite --force node@22

# OrbStack (Docker — 40MB idle vs Docker Desktop's 2GB)
brew install orbstack

# Ollama (MUST run natively, NOT in Docker — Metal GPU acceleration)
brew install ollama
ollama pull llama3.2:3b     # Heartbeat model (~2-3GB RAM, fits in 16GB budget)
# NOTE: Do NOT pull 13B+ models on 16GB — will cause swap thrashing

# signal-cli (works on macOS Apple Silicon via Homebrew)
brew install signal-cli
# Use the dedicated number obtained in step 1.3:
signal-cli -u +1DEDICATED_NUMBER register
signal-cli -u +1DEDICATED_NUMBER verify CODE_FROM_SMS

# OpenClaw
curl -fsSL https://openclaw.ai/install.sh | bash
openclaw onboard --install-daemon
```

### 1.5 Service Startup Order

```
1. macOS auto-login → openclaw user session
2. OrbStack → auto-starts with macOS
3. Ollama → LaunchAgent (must be running before OpenClaw)
4. OpenClaw Gateway → LaunchAgent (connects to Ollama on start)
5. signal-cli → auto-spawned by OpenClaw (autoStart: true)
```

**Ollama LaunchAgent** (`~/Library/LaunchAgents/ai.ollama.serve.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>ai.ollama.serve</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/ollama</string>
        <string>serve</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
    <key>StandardOutPath</key><string>/tmp/ollama.log</string>
    <key>StandardErrorPath</key><string>/tmp/ollama-error.log</string>
</dict>
</plist>
```

**OpenClaw startup wrapper** (waits for Ollama):
```bash
#!/bin/bash
# /usr/local/bin/openclaw-start.sh
until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
    sleep 2
done
exec openclaw gateway start --foreground
```

---

## Phase 2: OpenClaw Configuration

### 2.1 Hardened openclaw.json

```jsonc
{
  "gateway": {
    "auth": { "mode": "token" },
    "bind": "loopback"
  },
  "agents": {
    "defaults": {
      "sandbox": { "enabled": true, "workspace": "rw" },
      "model": { "primary": "anthropic/claude-sonnet-4-6" },
      "heartbeat": {
        "every": "2h",
        "model": "ollama/llama3.2:3b",
        "activeHours": { "start": "08:00", "end": "22:00" }
      }
    },
    "list": [{
      "id": "greengoods",
      "name": "GreenGoods",
      "default": true,
      "workspace": "~/.openclaw/workspace-greengoods"
    }]
  },
  "channels": {
    "discord": {
      "enabled": true,
      "token": "$DISCORD_BOT_TOKEN",
      "dmPolicy": "allowlist",
      "groupPolicy": "allowlist",
      "guilds": {
        "GREEN_GOODS_SERVER_ID": {
          "requireMention": true,
          "users": ["TEAM_MEMBER_IDS"]
        }
      }
    },
    "signal": {
      "enabled": true,
      "account": "+1DEDICATED_NUMBER",
      "dmPolicy": "allowlist",
      "allowFrom": ["+1TEAMMATE1", "+1TEAMMATE2"],
      "autoStart": true
    }
  },
  "hooks": {
    "enabled": true,
    "token": "STRONG_RANDOM_SECRET",
    "path": "/hooks",
    "allowedSessionKeyPrefixes": ["hook:meeting"],
    "allowRequestSessionKey": false
  },
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_xxx" }
    }
  },
  "tools": {
    "alsoAllow": ["lobster"],
    "deny": ["shell:rm -rf", "shell:sudo", "group:runtime"]
  },
  "secrets": { "encryption": "age" },
  "logging": {
    "level": "info",
    "redactSensitive": "tools",
    "redactPatterns": [
      "ghp_[a-zA-Z0-9]+",
      "sk-ant-[a-zA-Z0-9]+",
      "0x[a-fA-F0-9]{40}"
    ]
  },
  "session": { "dmScope": "per-channel-peer" }
}
```

### 2.2 Credential Setup

```bash
export OPENCLAW_GATEWAY_TOKEN=$(openssl rand -hex 32)
echo "export OPENCLAW_GATEWAY_TOKEN=$OPENCLAW_GATEWAY_TOKEN" >> ~/.zshrc

openclaw secrets set ANTHROPIC_API_KEY "sk-ant-api03-xxx"
openclaw secrets set DISCORD_BOT_TOKEN "your-discord-token"
openclaw secrets set GITHUB_TOKEN "ghp_xxx"
```

---

## Phase 3: Meeting Pipeline

### 3.1 Lobster Workflow (`meeting-pipeline.lobster`)

```yaml
name: meeting-to-actions
args:
  transcript:
    default: ""
  repo:
    default: "green-goods/green-goods"

steps:
  - id: extract
    command: >
      openclaw.invoke --tool llm-task --action json --args-json '{
        "prompt": "You are a product manager for Green Goods, an offline-first regenerative platform. Analyze this meeting transcript and extract ALL actionable items. Categorize each as: bug, polish, feature, or task. For bugs include severity and reproduction steps. For features include acceptance criteria. For all items include suggested GitHub labels from: bug, enhancement, ui/ux, contracts, indexer, client, admin, shared, agent.",
        "schema": {
          "type": "object",
          "properties": {
            "summary": { "type": "string" },
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "type": { "enum": ["bug", "polish", "feature", "task"] },
                  "title": { "type": "string" },
                  "description": { "type": "string" },
                  "severity": { "enum": ["critical", "high", "medium", "low"] },
                  "labels": { "type": "array", "items": { "type": "string" } },
                  "assignee": { "type": "string" },
                  "agent_actionable": { "type": "boolean" }
                },
                "required": ["type", "title", "description", "severity", "labels"]
              }
            }
          }
        }
      }'

  - id: review
    command: approve --preview-from-stdin
    stdin: $extract.stdout
    approval: required

  - id: create-issues
    condition: $review.approved
    command: >
      openclaw.invoke --tool bash --args-json '{
        "command": "echo $ITEMS | jq -c '.items[]' | while read item; do
          TITLE=$(echo $item | jq -r '.title');
          BODY=$(echo $item | jq -r '.description');
          TYPE=$(echo $item | jq -r '.type');
          SEVERITY=$(echo $item | jq -r '.severity');
          LABELS=$(echo $item | jq -r '.labels | join(\",\")');
          gh issue create --repo $REPO \
            --title \"[$TYPE] $TITLE\" \
            --body \"$BODY\n\nSeverity: $SEVERITY\n\nExtracted from meeting transcript.\" \
            --label \"$LABELS\";
        done"
      }'
    stdin: $extract.stdout

  - id: notify-discord
    condition: $review.approved
    command: >
      openclaw.invoke --tool message --args-json '{
        "channel": "discord",
        "text": "Meeting processed! Created issues from today call."
      }'
    stdin: $create-issues.stdout
```

### 3.2 Meeting Processor Skill (`~/.openclaw/workspace-greengoods/skills/meeting-processor/SKILL.md`)

```yaml
---
name: meeting-processor
description: Process Google Meet transcripts into GitHub issues with team notifications
version: 1.0.0
user-invocable: true
metadata:
  openclaw:
    requires:
      env:
        - GITHUB_TOKEN
        - ANTHROPIC_API_KEY
      bins:
        - gh
        - jq
    primaryEnv: GITHUB_TOKEN
    emoji: "clipboard"
---

# Meeting Processor

When asked to process a meeting transcript:

1. Run the `meeting-to-actions` Lobster workflow with the transcript text
2. The workflow will:
   - Extract bugs, polish items, features, and tasks using Claude
   - Present them for human approval before creating anything
   - Create GitHub issues in the green-goods repo with appropriate labels
   - Notify the team on Discord with a summary
3. For items marked `agent_actionable: true`, suggest dispatching
   a Claude Code agent to work on the fix
4. After issue creation, send a Signal DM to each assignee with their items

## Label Mapping
- bug → `bug` label
- polish → `ui/ux`, `enhancement` labels
- feature → `enhancement` label
- task → no extra label

## Package Scope Labels (auto-detect from keywords)
- "contract", "solidity", "deploy" → `contracts`
- "indexer", "graphql", "envio" → `indexer`
- "admin", "dashboard" → `admin`
- "client", "PWA", "offline" → `client`
- "shared", "hook", "module" → `shared`
- "bot", "telegram", "agent" → `agent`
```

### 3.3 n8n → OpenClaw Webhook Integration

n8n workflow node configuration:

```
Trigger: Fireflies.ai webhook (transcription_complete)
   │
   ▼
HTTP Request Node:
  Method: POST
  URL: http://MAC_MINI_IP:18789/hooks/agent
  Headers:
    Authorization: Bearer <hooks.token>
    Content-Type: application/json
  Body:
    {
      "message": "Process this meeting transcript:\n\n{{$json.transcript}}",
      "name": "MeetingProcessor",
      "agentId": "greengoods",
      "sessionKey": "hook:meeting:{{$json.meeting_id}}",
      "deliver": true,
      "channel": "discord",
      "model": "anthropic/claude-sonnet-4-6",
      "timeoutSeconds": 300
    }
```

---

## Phase 4: Agent Dispatch (Claude Code Bridge)

### 4.1 Claude Code Skill Installation

The `openclaw-claude-code-skill` gives OpenClaw programmatic control over Claude Code sessions:

```bash
# Install the skill
clawhub install openclaw-claude-code-skill
# Or place SKILL.md manually in workspace-greengoods/skills/claude-code/
```

### 4.2 Bug Fix Dispatch Flow

```
OpenClaw detects agent_actionable bug issue
    │
    ▼
Claude Code Skill Bridge:
  session-start green-goods-fix -d ~/Code/greenpill/green-goods
  session-send green-goods-fix \
    "Fix bug: [issue title]. Issue: [url]. Follow CLAUDE.md. Create PR." \
    --stream \
    --allowed-tools "Bash(git:*,bun:*,gh:*),Read,Edit,Write,Glob,Grep" \
    --max-budget 2.00
    │
    ▼
Claude Code creates branch + implements fix + opens PR
    │
    ▼
OpenClaw notifies Discord: "PR #42 opened for bug fix: [title]"
```

---

## Phase 5: Autonomous Monitoring

### 5.1 Heartbeat Checklist (`HEARTBEAT.md`)

```markdown
# Heartbeat Checklist

- Check green-goods GitHub repo for issues labeled `agent-actionable`
  with no linked PR. If found, ask if I should dispatch a coding agent.
- Check for issues older than 48 hours with no assignee. Suggest
  assignments based on label (contracts → core, client → frontend).
- If a PR was opened by Claude Code agent, check CI status. If failing,
  summarize failures in Discord.
```

### 5.2 Cron Jobs

```bash
# Daily standup summary at 9 AM ET → Discord
openclaw cron add --name "daily-standup" --cron "0 9 * * 1-5" \
  --tz "America/New_York" --session isolated \
  --message "Generate daily standup: open issues, PRs in review, blockers." \
  --model sonnet --channel discord

# Weekly digest every Friday at 4 PM → Discord + Signal
openclaw cron add --name "weekly-digest" --cron "0 16 * * 5" \
  --tz "America/New_York" --session isolated \
  --message "Weekly summary: meeting-generated issues created/closed/in-progress." \
  --model sonnet --channel discord
```

---

## Phase 6: Operations & Maintenance

### 6.1 Log Rotation (OpenClaw has none built-in)

```
/etc/newsyslog.d/openclaw.conf:
/tmp/openclaw/*.log    644  7  10240  *  GJ
/tmp/ollama*.log       644  7  5120   *  GJ
```

### 6.2 Health Monitoring (cron every 5 min)

Checks: OpenClaw gateway alive, Ollama responding, disk < 85%, memory pressure.
Auto-restarts services via `launchctl kickstart` if down.

### 6.3 Backups (daily at 3 AM, encrypted, 30-day retention)

```bash
openclaw gateway stop
tar -czf - ~/.openclaw | openssl enc -aes-256-cbc -salt -pbkdf2 \
  -out ~/backups/openclaw-$(date +%Y%m%d).tar.gz.enc
launchctl kickstart gui/$UID/ai.openclaw.gateway
find ~/backups -name "openclaw-*.enc" -mtime +30 -delete
```

### 6.4 Maintenance Schedule

| Task | Frequency | Method |
|------|-----------|--------|
| Health check | 5 min (automated) | healthcheck.sh cron |
| Homebrew updates | Daily 4 AM (automated) | brew upgrade cron |
| OpenClaw updates | Weekly (manual) | `curl install.sh + openclaw doctor` |
| macOS updates | Monthly (manual) | VNC via Tailscale, approve + reboot |
| Backup verification | Monthly (manual) | Decrypt and test-restore |
| Security audit | Monthly (manual) | `openclaw security audit --deep` |
| API key rotation | Quarterly (manual) | `openclaw secrets set` |

---

## PF Firewall Configuration

File: `/etc/pf.anchors/com.openclaw`

```
block in all
pass in quick on lo0 all
pass out quick all flags S/SA keep state
pass in quick on en0 proto tcp from 192.168.0.0/16 to any port 22
pass in quick on utun0 all
pass in quick proto icmp all
```

---

## Rollout Timeline

| Phase | Effort | Outcome |
|-------|--------|---------|
| Phase 1: Mac Mini setup | ~4 hours | Hardened server, all software installed |
| Phase 2: OpenClaw config | ~2 hours | Gateway running, channels connected |
| Phase 3: Meeting pipeline | ~1 day | Transcript → issues → notifications working |
| Phase 4: Agent dispatch | ~1 day | Bugs auto-dispatched to Claude Code |
| Phase 5: Monitoring | ~2 hours | Heartbeat + cron jobs active |
| Phase 6: Operations | ~2 hours | Backups, log rotation, health checks |

**Total: ~3-4 days to full production**

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Prompt injection via transcript | Medium | Low (with sandbox) | Sandbox + tool policy |
| Credential leak | Low | High | Age encryption + env vars |
| ClawHub supply chain | Medium | High | Write custom skills only |
| Runaway API costs | High | Medium | Ollama heartbeats + spending cap |
| Gateway exposure | Low | Critical | Loopback + Tailscale only |
| New CVE | High | Varies | Pin version, security advisories |
| Signal phone ban | Medium | Low | Outbound notifications only |
| macOS update breaks services | Low | Medium | Homebrew auto-update, manual OS updates |

---

## References

- [OpenClaw GitHub](https://github.com/openclaw/openclaw) (237K+ stars, MIT)
- [OpenClaw Docs](https://docs.openclaw.ai)
- [Lobster Workflow Engine](https://github.com/openclaw/lobster)
- [Claude Code Skill Bridge](https://github.com/Enderfga/openclaw-claude-code-skill)
- [OpenClaw Threat Model](https://trust.openclaw.ai/trust/threatmodel)
- [CVE-2026-28363](https://www.redpacketsecurity.com/cve-alert-cve-2026-28363-openclaw-openclaw/) (CVSS 9.9, patched 2026.2.23)
- [OpenClawSetup (Mac Mini)](https://github.com/MarioCruz/OpenClawSetup)
- [Anthropic API Pricing](https://platform.claude.com/docs/en/about-claude/pricing)
- [Anthropic OAuth Ban](https://openclaw.rocks/blog/anthropic-oauth-ban)
