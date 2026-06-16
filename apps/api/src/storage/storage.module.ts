import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { StorageService } from "./storage.service";
import { S3StorageService } from "./s3-storage.service";
import { InMemoryStorageService } from "./in-memory-storage.service";

@Global()
@Module({
  providers: [
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        process.env.NODE_ENV === "test"
          ? new InMemoryStorageService()
          : new S3StorageService(config)
    }
  ],
  exports: [StorageService]
})
export class StorageModule {}
