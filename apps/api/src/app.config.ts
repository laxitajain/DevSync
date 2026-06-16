import { INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";

/**
 * Applies every cross-cutting concern (security headers, cookie parsing, CORS,
 * validation, error shaping, route prefix) to a Nest app instance.
 *
 * Both the production bootstrap and the e2e test harness call this, so tests
 * exercise the same request pipeline that real clients hit.
 */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get<string>("WEB_ORIGIN", "http://localhost:3000"),
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    exposedHeaders: ["X-Request-Id"],
    credentials: true
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );
  app.useGlobalFilters(new HttpExceptionFilter(app.get(Logger)));
  // `/metrics` stays at the root for conventional Prometheus scraping; every
  // other route is namespaced under `/api`.
  app.setGlobalPrefix("api", { exclude: ["metrics"] });

  return app;
}
