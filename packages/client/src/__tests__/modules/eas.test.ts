import { describe, it } from "vitest";

import {
  getGardenAssessments,
  getWorks,
  getWorkApprovals,
} from "../../modules/eas";

describe("eas", () => {
  it("should get garden assessments", async () => {
    const gardenAssessments = await getGardenAssessments();

    console.log(gardenAssessments);
  });

  // it("should get works", async () => {
  //   const works = await getWorks();

  //   console.log(works);
  // });

  // it("should get work approvals", async () => {
  //   const workApprovals = await getWorkApprovals();

  //   console.log(workApprovals);
  // });
});
