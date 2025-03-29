import { describe, it } from "vitest";

import {
  getActions,
  // getGardeners,
  getGardens,
} from "../../modules/greengoods";

describe("greengoods", () => {
  it("should get gardens", async () => {
    const gardens = await getGardens();

    console.log(gardens);
  });

  // it("should get gardeners", async () => {
  //   const gardeners = await getGardeners();
  // });

  it("should get actions", async () => {
    const actions = await getActions();
    console.log(actions);
  });
});
