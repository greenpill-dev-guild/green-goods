/**
 * Garden reporting lab fixtures: the photos the lab's records draw.
 *
 * The lab's records name a photo by key (waste, edu, banner, agro); the stories hand the
 * lab these fixture photos for those keys. They are file URLs served by Storybook itself,
 * not inlined data: the Hub's work card asks its image gateway for a size by appending a
 * query (`?w=400&h=300`), which a file URL takes and a data URL does not. Nothing reaches
 * another host, and each record's dialog says its photo is a sample image.
 */
import agroforestry from "./fixture-art/agroforestry-coffee.jpg";
import communityGarden from "./fixture-art/community-garden.jpg";
import compostBins from "./fixture-art/compost-bins.jpg";
import outdoorClassroom from "./fixture-art/outdoor-classroom.jpg";

export const REPORTING_LAB_MEDIA = {
  waste: compostBins,
  edu: outdoorClassroom,
  banner: communityGarden,
  agro: agroforestry,
} as const;
