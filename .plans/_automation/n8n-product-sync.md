# Product Sync Automation — n8n + Claude Code Action

> Fully automated pipeline: Google Meet → Fireflies → n8n → GitHub Issue → Claude Code Action → Individual Issues
>
> Claude runs inside GitHub Actions with full repo checkout, giving it access to CLAUDE.md,
> issue templates, intent.md, grant mapping, and the entire codebase for context.

## Architecture

```
Google Meet call ends
        |
        v
Fireflies.ai (auto-records, transcribes)
        |
        | webhook (transcription_complete)
        v
   n8n workflow
        |
        | POST github.com/api → create issue
        v
GitHub Issue created:
  title: "@claude Product Sync [date]"
  label: "product-sync"
  body:  transcript text
        |
        | triggers .github/workflows/product-sync.yml
        v
Claude Code Action (full repo checkout)
        |
        | reads /product-sync command context
        | reads issue templates, intent.md, triage rules
        | extracts bugs, features, polish items
        |
        +--→ gh issue create (bug, label: bug)
        +--→ gh issue create (feature, label: enhancement)
        +--→ gh issue create (polish, label: polish)
        +--→ gh issue comment (summary table on trigger issue)
        +--→ gh issue close (trigger issue)
```

## Prerequisites

### 1. GitHub Label

Create a `product-sync` label in the Green Goods repo:

```bash
gh label create "product-sync" --description "Auto-generated trigger issue from product sync calls" --color "7057ff"
```

### 2. Fireflies.ai Setup

- Add the Fireflies bot to your Google Meet calendar (it auto-joins scheduled meetings)
- In Fireflies Settings → Integrations → Webhooks:
  - Event: `Transcription complete`
  - URL: Your n8n webhook URL (e.g., `https://your-n8n.example.com/webhook/product-sync`)

### 3. n8n Workflow

Import or build this workflow:

```
[Webhook Trigger] → [Extract Transcript] → [Create GitHub Issue] → [Discord Notification]
```

#### Node 1: Webhook Trigger

- Method: POST
- Path: `/webhook/product-sync`
- Authentication: Header Auth (shared secret)
- Responds with: 200 OK

#### Node 2: Code Node — Extract Transcript

```javascript
// Extract transcript from Fireflies webhook payload
const payload = $input.first().json;

const transcript = payload.transcript || payload.data?.transcript || '';
const meetingTitle = payload.title || payload.data?.title || 'Product Sync';
const meetingDate = new Date().toISOString().split('T')[0];
const participants = (payload.participants || payload.data?.participants || []).join(', ');

// Truncate if needed — GitHub issue body limit is 65536 chars
const maxLength = 60000;
const truncatedTranscript = transcript.length > maxLength
  ? transcript.substring(0, maxLength) + '\n\n[TRANSCRIPT TRUNCATED — full version in Fireflies]'
  : transcript;

return [{
  json: {
    title: `@claude Product Sync ${meetingDate} — ${meetingTitle}`,
    body: [
      `## Meeting Info`,
      `- **Date**: ${meetingDate}`,
      `- **Title**: ${meetingTitle}`,
      participants ? `- **Participants**: ${participants}` : '',
      '',
      `## Instructions`,
      '',
      `@claude Process this product sync transcript using the /product-sync extraction process.`,
      `Read the project context files, extract all bugs, features, and polish items,`,
      `and create individual GitHub issues for each. Then close this trigger issue with a summary.`,
      '',
      `## Transcript`,
      '',
      truncatedTranscript
    ].filter(Boolean).join('\n'),
    labels: ['product-sync']
  }
}];
```

#### Node 3: HTTP Request — Create GitHub Issue

- Method: POST
- URL: `https://api.github.com/repos/greenpill/green-goods/issues`
- Authentication: Header Auth
  - Name: `Authorization`
  - Value: `Bearer {{ $credentials.githubToken }}`
- Headers:
  - `Accept`: `application/vnd.github+json`
  - `X-GitHub-Api-Version`: `2022-11-28`
- Body (JSON):

```json
{
  "title": "{{ $json.title }}",
  "body": "{{ $json.body }}",
  "labels": {{ $json.labels }}
}
```

#### Node 4 (Optional): Discord Notification

Post to your team channel:

```
New product sync transcript submitted for extraction.
GitHub Issue: {{ $json.html_url }}
Claude is processing — individual issues will be created shortly.
```

### 4. GitHub Secrets

Ensure `CLAUDE_CODE_OAUTH_TOKEN` is set in repo secrets (you already have this from your existing claude.yml).

## How It Works End-to-End

1. **You finish a Google Meet** — Fireflies has been recording
2. **~5 min later** — Fireflies finishes transcription, fires webhook to n8n
3. **n8n creates a GitHub issue** — titled `@claude Product Sync 2026-03-04`, labeled `product-sync`, body = transcript
4. **`product-sync.yml` triggers** — Claude Code Action checks out the repo
5. **Claude reads context** — CLAUDE.md, issue templates, intent.md, triage severity scale, known bugs
6. **Claude extracts items** — categorizes as bug/feature/polish, assigns severity, scopes to packages, maps to grants
7. **Claude creates issues** — one `gh issue create` per extracted item, with proper labels and formatted bodies
8. **Claude posts summary** — comments on the trigger issue with a table of all created issues
9. **Claude closes trigger issue** — cleanup

## Manual Trigger (no Fireflies)

You can also trigger this manually — just create a GitHub issue:

```bash
gh issue create \
  --title "@claude Product Sync $(date +%Y-%m-%d)" \
  --label "product-sync" \
  --body "@claude Process this product sync transcript using the /product-sync extraction process.

## Transcript

<paste transcript here>"
```

## Debugging

- Check Actions tab for `Product Sync Extraction` workflow runs
- If Claude fails to create issues, check that `issues: write` permission is set
- If Claude can't find context files, ensure checkout step has `fetch-depth: 1` (not 0)
- Fireflies webhook payload structure may vary — check n8n execution log for the raw payload

## Evolution Path

### Now: Trigger Issue Pattern (Path A)
- Works today with existing claude-code-action
- Full repo context via GitHub Actions checkout
- ~2-5 min from webhook to issues created

### Next: Mac Mini + Claude Code CLI (Path B)
When OpenClaw is running on the M4 Mac Mini:
- n8n webhooks to Mac Mini via Tailscale
- Listener script spawns `claude -p` in the repo directory
- Even richer context (local git history, running services)
- Can also dispatch agents for bug fixes

### Future: `repository_dispatch` (Path C)
When claude-code-action adds native support:
- Cleaner than the trigger issue pattern
- No "meta-issue" noise in the issues list
- Direct API trigger from n8n
