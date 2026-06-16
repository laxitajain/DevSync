import { TEST_DATABASE_URL } from "./database";

// Must run before the Prisma client is constructed by Nest's DI container.
// @nestjs/config (dotenv) will not override an already-set process.env value,
// so this wins over the .env file and keeps tests on the isolated schema.
process.env.DATABASE_URL = TEST_DATABASE_URL;

import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/app.config";
import { PrismaService } from "../../src/prisma/prisma.service";

export type TestContext = {
  app: INestApplication;
  prisma: PrismaService;
};

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();

  return { app, prisma: app.get(PrismaService) };
}
