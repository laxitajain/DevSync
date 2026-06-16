import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns the API health status", () => {
    const controller = new HealthController();

    expect(controller.check()).toEqual({
      status: "ok",
      service: "devsync-api"
    });
  });
});

