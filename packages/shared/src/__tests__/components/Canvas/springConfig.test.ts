import { describe, it, expect } from "vitest";
import { SPRING_CONFIGS } from "../../../components/Canvas/springConfig";

describe("SPRING_CONFIGS", () => {
  it("exports sheet config with mass, tension, friction", () => {
    expect(SPRING_CONFIGS.sheet).toEqual({ mass: 1, tension: 170, friction: 26 });
  });

  it("exports snappy config", () => {
    expect(SPRING_CONFIGS.snappy).toEqual({ mass: 0.8, tension: 300, friction: 28 });
  });

  it("exports gentle config", () => {
    expect(SPRING_CONFIGS.gentle).toEqual({ mass: 1.2, tension: 120, friction: 20 });
  });
});
