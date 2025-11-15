# GitBook Deployment Checklist

Quick reference for deploying Green Goods documentation to GitBook.

---

## Pre-Deployment

### ✅ Completed

- [x] GitBook configuration files created
- [x] Complete navigation structure (SUMMARY.md)
- [x] All 54 documentation files created
- [x] Real URLs integrated
- [x] Cross-references added
- [x] Visual assets directory structure
- [x] Validation completed

### 📋 Before Going Live

- [ ] Add screenshots (see `.gitbook/assets/README.md` for list)
- [ ] Create architecture diagrams
- [ ] Review all TODO comments in files
- [ ] Test all external links (automated check recommended)
- [ ] Proofread content
- [ ] Get team approval

---

## GitBook Setup

### Step 1: Create GitBook Space

1. Visit [gitbook.com](https://www.gitbook.com)
2. Sign in or create account
3. Click "New Space"
4. Choose "Import from GitHub"

### Step 2: Connect Repository

1. Select `greenpill-dev-guild/green-goods`
2. Choose branch: `main` or `develop`
3. Set root path: `docs/`
4. GitBook detects `.gitbook.yaml` automatically

### Step 3: Configure Space

**Basic Settings**:
- **Title**: Green Goods Documentation
- **Description**: Making regenerative impact measurable, verifiable, and fundable
- **Visibility**: Public (recommended)

**Customization**:
- **Logo**: Upload from `packages/client/public/`
- **Favicon**: Same as logo
- **Primary Color**: Green (#10b981 or brand color)
- **Domain**: docs.greengoods.app (custom domain setup)

**Features to Enable**:
- [x] Search
- [x] Table of contents
- [x] Share buttons
- [ ] GitBook AI (optional)
- [ ] Authenticated access (optional - for private sections)

### Step 4: Test Preview

1. Use GitBook preview mode
2. Navigate through all sections
3. Test internal links
4. Verify images display (or placeholders)
5. Check mobile responsiveness
6. Test search functionality

### Step 5: Publish

1. Review all changes
2. Click "Publish"
3. Documentation goes live
4. Share with community!

---

## Post-Deployment

### Immediate Tasks

- [ ] Share docs URL in Telegram
- [ ] Tweet announcement
- [ ] Add link to greengoods.app
- [ ] Update GitHub README with docs link
- [ ] Monitor analytics

### First Week

- [ ] Collect user feedback
- [ ] Fix any reported issues
- [ ] Add missing screenshots
- [ ] Improve based on usage patterns

### Ongoing

- [ ] Update with new features
- [ ] Expand FAQ based on questions
- [ ] Add case studies
- [ ] Improve based on analytics

---

## Git Sync Workflow

### Making Updates

**From Local Development**:
```bash
# Edit files in docs/
git add docs/
git commit -m "docs: update gardener quickstart"
git push
```

**GitBook Auto-Updates**:
- Detects git push
- Rebuilds documentation
- Publishes changes automatically
- Usually < 2 minutes

### From GitBook Editor

1. Edit in GitBook WYSIWYG editor
2. Save changes
3. GitBook commits to GitHub
4. Two-way sync maintained

**Best Practice**: Edit in VS Code for technical docs, GitBook editor for content polish.

---

## Monitoring

### Analytics

**Track**:
- Page views
- Search queries
- Most visited pages
- User journey patterns

**Use to**:
- Improve popular pages
- Create content for common searches
- Optimize navigation
- Identify gaps

### Feedback

**Collect via**:
- GitHub Issues
- Telegram comments
- Twitter mentions
- GitBook comments (if enabled)

---

## Maintenance Schedule

### Daily

- Monitor for critical issues
- Respond to documentation questions

### Weekly

- Review analytics
- Update based on new features
- Fix reported issues
- Improve based on feedback

### Monthly

- Comprehensive review
- Update screenshots if UI changed
- Expand guides based on support patterns
- Add new examples

### Quarterly

- Major content review
- Restructure if needed
- Add new sections
- Archive outdated content

---

## Troubleshooting

### Git Sync Not Working

**Check**:
- `.gitbook.yaml` is valid YAML
- Branch is correct
- Paths are correct
- No merge conflicts

**Fix**:
- Verify GitBook connected to right repo/branch
- Check GitBook sync logs
- Manually trigger sync in GitBook settings

### Images Not Displaying

**Check**:
- Image paths are relative and correct
- Images exist in `.gitbook/assets/`
- File extensions are lowercase
- Images committed to git

### Search Not Working

**GitBook search**:
- Rebuilds on publish
- May take 5-10 minutes after deployment
- Check GitBook search settings

---

## Success Criteria

**Documentation is successful when**:
- ✅ Gardeners can onboard in < 5 minutes
- ✅ Operators understand garden management
- ✅ Evaluators can query data easily
- ✅ Developers can set up locally
- ✅ 80%+ of support questions answered in docs
- ✅ Community references docs regularly

---

## Resources

- **GitBook Docs**: [docs.gitbook.com](https://docs.gitbook.com)
- **Git Sync Guide**: [Git Sync Documentation](https://docs.gitbook.com/getting-started/git-sync)
- **Monorepo Guide**: [GitBook Monorepos](https://docs.gitbook.com/getting-started/git-sync/monorepos)
- **Content Structure**: [GitBook Content](https://docs.gitbook.com/creating-content/content-structure)

---

**Status**: ✅ Ready for GitBook Deployment

*Created: November 15, 2024*
