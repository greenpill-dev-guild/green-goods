# GitHub Organization Transfer

**Slug**: `github-org-transfer`
**Stage**: `ideas`
**Status**: `IDEA: decisions recorded; waits for the 2.1.0 release`
**Priority**: `p2`
**Created**: `2026-11-15`

## Problem

The repository still lives at `greenpill-dev-guild/green-goods`. Green Goods now presents itself
on its own, and the other tools have already taken the Green Goods name: the Linear workspace,
the Vercel team and the Drive shared drive. The `green-goods` GitHub organization exists but holds
nothing of this project yet.

Moving the repository is mostly safe for links, because GitHub redirects the old location. The
risk is quiet outages. Deploys, bot reviews, tracker links, the content editor, the indexer and the
cloud routines are bound to the organization that owns the repository, through GitHub Apps and
organization teams. If the repository moves before the new organization is ready, those
integrations stop without an error anyone sees.

## Desired Outcome

- The repository lives at `green-goods/platform`, with its history, pull requests, stars, secrets,
  webhooks and repository ID intact.
- Old web, git and API links to `greenpill-dev-guild/green-goods` keep resolving.
- Deploys, reviews, tracker automation, routines and the content editor keep working, and each one
  is verified after the move rather than assumed.
- People with write, triage or maintain access keep it, through teams in the new organization.
- Living references point at the new location; history and immutable records stay as written.

What should not change: product URLs, package names (`@green-goods/*`), the repository ID, commit
history, or legal attribution, which waits on the separate operating-entity decision.

## Scope Notes

- In scope: preparing the `green-goods` organization and its `.github` repository, the transfer
  with the rename to `platform`, reconnecting every integration, one pull request that updates
  living references, updating routine specs and their stored prompts, and updating living
  documents outside the repository.
- Out of scope: renaming Vercel projects, the Fly app or other hosted resources; copyright and
  license holder wording; rewriting `.plans` history or dated reports; changes to other repositories
  owned by the guild beyond their references to this one.

## Success Signal

The first change merged after the move flows end to end with no manual rescue: CI Gate, preview
deploys, bot reviews, the tracker link and the Agent deploy all run. A sample of old links resolves
to the new location.
