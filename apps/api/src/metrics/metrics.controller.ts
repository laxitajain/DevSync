import { Controller, Get, Header } from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { registry } from "./metrics";

/**
 * Prometheus scrape target. Excluded from the global `/api` prefix (see
 * `configureApp`) so it lives at the conventional `/metrics` path, and excluded
 * from Swagger since it is operational, not part of the public API.
 */
@ApiExcludeController()
@Controller("metrics")
export class MetricsController {
  @Get()
  @Header("Content-Type", registry.contentType)
  async scrape(): Promise<string> {
    return registry.metrics();
  }
}
