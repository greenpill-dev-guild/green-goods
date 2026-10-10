import {mkdir, readFile, writeFile} from "node:fs/promises";
import path from "node:path";

import {leadSentence, markdownTwin, renderLlmsIndex, twinPath} from "../scripts/llms.mjs";

/**
 * Publishes a Markdown twin of every doc page and an llms.txt index of them, so an agent can read
 * the whole site without rendering it. The hand-written guidance in static/llms.txt stays at the
 * top of the index.
 */
export default function llmsTwinsPlugin(context) {
  let docs = [];
  return {
    name: "green-goods-llms-twins",
    async allContentLoaded({allContent}) {
      const loaded = allContent["docusaurus-plugin-content-docs"]?.default;
      if (!loaded) throw new Error("llms-twins: the docs plugin content is missing");
      docs = loaded.loadedVersions
        .flatMap((version) => version.docs)
        .filter((doc) => !doc.unlisted && !doc.draft);
    },
    async postBuild({outDir, siteConfig}) {
      // The integration pages render their deployment facts through a component; the twins carry
      // the same facts as Markdown so the page reads whole without rendering.
      const projections = JSON.parse(
        await readFile(path.join(context.siteDir, "src/data/integration-projections.json"), "utf8"),
      );
      const onboarding = JSON.parse(await readFile(path.join(context.siteDir, "src/data/onboarding.json"), "utf8"));
      const pages = [];
      for (const doc of docs) {
        const source = path.join(context.siteDir, doc.source.replace(/^@site\//, ""));
        const twin = path.join(outDir, twinPath(doc.permalink));
        await mkdir(path.dirname(twin), {recursive: true});
        const markdown = markdownTwin(await readFile(source, "utf8"), doc.title, {
          integrations: projections.integrations,
          onboarding: onboarding.text,
        });
        await writeFile(twin, markdown);
        // Docusaurus's automatic excerpt can pick up a generated banner, so only a hand-written
        // frontmatter description is used as-is.
        const description = doc.frontMatter?.description ?? leadSentence(markdown);
        pages.push({title: doc.title, description, permalink: doc.permalink});
      }
      const header = await readFile(path.join(context.siteDir, "static/llms.txt"), "utf8");
      await writeFile(path.join(outDir, "llms.txt"), renderLlmsIndex({header, siteUrl: siteConfig.url, pages}));
    },
  };
}
