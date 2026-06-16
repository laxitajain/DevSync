import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module";
import { configureApp } from "./app.config";

function setupSwagger(app: Parameters<typeof configureApp>[0]) {
  const config = new DocumentBuilder()
    .setTitle("DevSync API")
    .setDescription(
      "Collaborative project management platform. Authenticate via /api/auth, " +
        "then pass the access token as a Bearer token."
    )
    .setVersion("1.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: { persistAuthorization: true }
  });
}

async function bootstrap() {
  // Buffer Nest's startup logs until the Pino logger is wired in, so even
  // bootstrap output is structured.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  configureApp(app);
  setupSwagger(app);

  const config = app.get(ConfigService);
  const port = config.get<number>("PORT", 4000);
  await app.listen(port);

  app.get(Logger).log(`DevSync API listening on port ${port}`);
}

void bootstrap();
