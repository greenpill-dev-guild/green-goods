// Crops and converts the captures to webp for docs/static/img/screenshots.
// The crop boxes below are the record of how each published image was cut from its frame.
// Usage, from the repository root:
//   node .plans/active/community-docs-revamp/artifacts/convert-captures.mjs "$PWD" <pngDir> <webpDir>
// Look at every result before copying it into docs/static: a crop that fit one build can miss
// on the next.
import { createRequire } from "node:module";
import path from "node:path";
const [root, pngDir, outDir] = process.argv.slice(2);
const require = createRequire(`${root}/docs/package.json`);
const sharp = require("sharp");
// Desktop sources are 2880x1800 (1440x900 at 2x); crop boxes are given in that frame.
// width: target width after resize (keeps aspect). Phone sources are 780x1688.
const jobs = [
  { src: "client-sign-in.png", out: "client-sign-in.webp", crop: { left: 0, top: 440, width: 780, height: 900 } },
  { src: "client-join-garden.png", out: "client-join-garden.webp", crop: { left: 0, top: 1100, width: 780, height: 588 } },
  { src: "client-filters.png", out: "client-garden-filters.webp", crop: { left: 0, top: 240, width: 780, height: 1448 } },
  { src: "client-cookie-jar-claim.png", out: "client-cookie-jar-claim.webp", crop: { left: 0, top: 0, width: 780, height: 900 } },
  { src: "admin-access-review.png", out: "admin-request-steward-access.webp", crop: { left: 960, top: 200, width: 960, height: 1400 }, width: 960 },
  { src: "admin-members-clean.png", out: "admin-community-members.webp", width: 2000 },
  { src: "admin-hub-queue.png", out: "admin-hub.webp", width: 2000 },
  { src: "admin-garden-settings.png", out: "admin-edit-garden.webp", crop: { left: 560, top: 32, width: 1120, height: 1408 }, width: 1120 },
  { src: "admin-hubworkqueue-data.png", out: "admin-review-queue.webp", crop: { left: 0, top: 0, width: 2880, height: 700 }, width: 2000 },
  { src: "admin-review-form.png", out: "admin-review-form.webp", crop: { left: 864, top: 32, width: 1152, height: 1080 }, width: 1152 },
  { src: "admin-review-reject.png", out: "admin-reject-work.webp", crop: { left: 960, top: 450, width: 960, height: 900 }, width: 960 },
  { src: "admin-create-assessment.png", out: "admin-create-assessment.webp", width: 2000 },
  { src: "admin-assessments-tab.png", out: "admin-assessments-tab.webp", crop: { left: 0, top: 0, width: 2880, height: 1100 }, width: 2000 },
  { src: "admin-jar-panel.png", out: "admin-cookie-jars.webp", crop: { left: 0, top: 0, width: 2880, height: 1060 }, width: 2000 },
];
for (const job of jobs) {
  let img = sharp(path.join(pngDir, job.src));
  if (job.crop) img = img.extract(job.crop);
  if (job.width) img = img.resize({ width: job.width });
  const info = await img.webp({ quality: 82 }).toFile(path.join(outDir, job.out));
  console.log(`${job.out} ${info.width}x${info.height} ${Math.round(info.size / 1024)}KB`);
}
