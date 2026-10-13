# Community Docs Revamp Artifacts

The scripts that produced this hub's screenshots and its rendered proof. They are kept so the
images can be retaken the same way and the proof can be repeated. Nothing in the repository runs
them: no package script, test, or CI job depends on this folder.

Run each from the repository root. They load Playwright and `sharp` from the workspace, so there
is nothing to install.

## Screenshots

`captures.json` lists the fourteen frames the community pages use. Each one is a Storybook fixture
story on the deployed Storybook, `design.greengoods.app`, at a phone size (390 by 844) or a desktop
size (1440 by 900), at double density.

```bash
node .plans/active/community-docs-revamp/artifacts/storybook-capture.mjs "$PWD" /tmp/gg-docs-png \
  .plans/active/community-docs-revamp/artifacts/captures.json
node .plans/active/community-docs-revamp/artifacts/convert-captures.mjs "$PWD" /tmp/gg-docs-png /tmp/gg-docs-webp
```

`convert-captures.mjs` holds the crop box for each image, which is the record of how a published
image was cut from its frame. Look at every result before copying it into
`docs/static/img/screenshots/`.

What to know before trusting a frame:

- **Fixture data only.** Every garden, person, and address in these stories is made up. Mock auth
  on a local server reads live gardens, so it is not a source for docs images.
- **The deployed Storybook does not say which commit built it.** A caption names the source and
  the capture date. It can lag `develop`.
- **Some stories render an error instead of the screen.** On 12 October 2026:
  `admin-workspaces-hub--work-detail` showed "Work not found";
  `admin-workflows-community-endowment--funded` showed "Garden not found";
  `admin-workspaces-community--yield-payouts` and `admin-workflows-community-payouts--allocated`
  showed "Couldn't read this garden's cookie jars"; and `admin-workspaces-community--endowment`
  showed a yield error with deposits disabled. The capture report lists the text each page showed,
  so read it.
- **Submit Work has stories for two steps only.** `client-work-submitwork--*` mock the flow at
  Media and Review, and the buttons do not move to another step. Start and Details have no story.
- **A scripted open leaves focus where the script left it.** The filter sheet and the reject
  dialog each show a focus ring on one control.
- **The Members frame is taken from the endowment story,** with the Members tab opened, because
  that story's header reads "39 DAI" where the members story shows a raw address.

## Rendered check

`rendered-check.mjs` loads a production docs build in headless Chromium at a desktop and a phone
width. It needs no server: every request to `http://docs.localhost` is answered from `docs/build`
on disk, with the host's clean-URL rules, and requests to any other host are blocked.

```bash
bun run --cwd docs build
node .plans/active/community-docs-revamp/artifacts/rendered-check.mjs "$PWD" "$PWD/docs/build" /tmp/gg-docs-rendered
```

It reports, for thirty pages at both widths: the response, the heading, horizontal overflow,
images that failed to load or have no alt text, figures without a caption, and page errors. It
then checks four redirects, fifteen anchors, three searches, and the Markdown twins, and saves a
few page images for a visual look. It is a report, not a gate: it always exits 0, so read what it
prints.

Label this evidence "clean-room Playwright, headless Chromium, local production build". It is not
the deployed site and not an authenticated session. The pages, redirects, and anchors it checks
are listed at the top of the script; add to those lists when a page moves or is added.
