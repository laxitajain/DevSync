import { Module } from "@nestjs/common";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { loggerModuleOptions } from "./common/logging/logger.config";
import { MetricsModule } from "./metrics/metrics.module";
import { HttpMetricsInterceptor } from "./metrics/http-metrics.interceptor";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { WorkspacesModule } from "./workspaces/workspaces.module";
import { BoardsModule } from "./boards/boards.module";
import { ProjectsModule } from "./projects/projects.module";
import { TasksModule } from "./tasks/tasks.module";
import { SearchModule } from "./search/search.module";
import { FilesModule } from "./files/files.module";
import { StorageModule } from "./storage/storage.module";
import { RealtimeModule } from "./realtime/realtime.module";
import { RedisModule } from "./redis/redis.module";
import { REDIS_CLIENT } from "./redis/redis.constants";
import { RedisThrottlerStorage } from "./redis/redis-throttler.storage";
import { CacheModule } from "./cache/cache.module";
import { JobsModule } from "./jobs/jobs.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env", "../../.env"]
    }),
    LoggerModule.forRoot(loggerModuleOptions),
    MetricsModule,
    RedisModule,
    CacheModule,
    StorageModule,
    JobsModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [REDIS_CLIENT],
      useFactory: (redis) => ({
        errorMessage: "Too many requests. Please try again later.",
        skipIf: () => process.env.NODE_ENV === "test",
        storage:
          process.env.NODE_ENV === "test"
            ? undefined
            : new RedisThrottlerStorage(redis),
        throttlers: [
          {
            name: "default",
            limit: process.env.NODE_ENV === "test" ? 10_000 : 100,
            ttl: 60_000,
            blockDuration: 60_000
          }
        ]
      })
    }),
    PrismaModule,
    RealtimeModule,
    HealthModule,
    UsersModule,
    AuthModule,
    WorkspacesModule,
    ProjectsModule,
    BoardsModule,
    TasksModule,
    SearchModule,
    FilesModule
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpMetricsInterceptor
    }
  ]
})
export class AppModule {}

