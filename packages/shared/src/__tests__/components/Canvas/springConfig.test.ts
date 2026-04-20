import { describe, it, expect } from "vitest";
import { SPRING_CONFIGS } from "../../../components/Canvas/springConfig";

describe("SPRING_CONFIGS", () => {
  it("exports positive spring values for each motion token", () => {
    for (const config of Object.values(SPRING_CONFIGS)) {
      expect(config.mass).toBeGreaterThan(0);
      expect(config.tension).toBeGreaterThan(0);
      expect(config.friction).toBeGreaterThan(0);
    }
  });

  it("keeps sheet motion between snappy and gentle responsiveness", () => {
    expect(SPRING_CONFIGS.snappy.tension).toBeGreaterThan(SPRING_CONFIGS.sheet.tension);
    expect(SPRING_CONFIGS.sheet.tension).toBeGreaterThan(SPRING_CONFIGS.gentle.tension);
    expect(SPRING_CONFIGS.snappy.friction).toBeGreaterThanOrEqual(SPRING_CONFIGS.sheet.friction);
    expect(SPRING_CONFIGS.sheet.friction).toBeGreaterThan(SPRING_CONFIGS.gentle.friction);
    expect(SPRING_CONFIGS.gentle.mass).toBeGreaterThan(SPRING_CONFIGS.sheet.mass);
  });

  it("places recession between sheet snap and gentle ambient motion", () => {
    expect(SPRING_CONFIGS.sheet.tension).toBeGreaterThan(SPRING_CONFIGS.recession.tension);
    expect(SPRING_CONFIGS.recession.tension).toBeGreaterThan(SPRING_CONFIGS.gentle.tension);
    expect(SPRING_CONFIGS.recession.mass).toBeGreaterThan(SPRING_CONFIGS.sheet.mass);
    expect(SPRING_CONFIGS.gentle.mass).toBeGreaterThan(SPRING_CONFIGS.recession.mass);
  });
});
