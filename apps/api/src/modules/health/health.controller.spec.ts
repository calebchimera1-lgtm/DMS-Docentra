import { Test, TestingModule } from "@nestjs/testing";
import { HealthCheckService } from "@nestjs/terminus";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  let controller: HealthController;
  const healthCheckServiceMock = { check: jest.fn().mockResolvedValue({ status: "ok" }) };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthCheckService, useValue: healthCheckServiceMock }],
    }).compile();

    controller = module.get(HealthController);
  });

  it("delegates to HealthCheckService", async () => {
    const result = await controller.check();
    expect(result).toEqual({ status: "ok" });
    expect(healthCheckServiceMock.check).toHaveBeenCalledWith([]);
  });
});
