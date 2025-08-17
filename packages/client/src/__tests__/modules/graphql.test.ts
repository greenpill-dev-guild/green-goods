import { describe, it, expect } from "vitest";

import { easGraphQL, greenGoodsGraphQL } from "../../modules/graphql";

describe("modules/graphql", () => {
  it("exports query helpers", () => {
    expect(typeof easGraphQL).toBe("function");
    expect(typeof greenGoodsGraphQL).toBe("function");

    const q1 = easGraphQL(/* GraphQL */ `query Test { __typename }`);
    const q2 = greenGoodsGraphQL(/* GraphQL */ `query Test { __typename }`);

    expect(q1).toBeDefined();
    expect(q2).toBeDefined();
  });
});
