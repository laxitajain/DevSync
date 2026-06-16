import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { StorageService } from "./storage.service";

const DEFAULT_URL_TTL_SECONDS = 60 * 15;

/**
 * S3-compatible storage. Targets MinIO in local dev (path-style addressing) and
 * works unchanged against AWS S3, Cloudflare R2, or DO Spaces by swapping env.
 *
 * The bucket is created lazily on first write so a not-yet-ready MinIO container
 * doesn't block API startup.
 */
export class S3StorageService extends StorageService {
  private readonly logger = new Logger(S3StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private bucketReady?: Promise<void>;

  constructor(config: ConfigService) {
    super();
    this.bucket = config.get<string>("S3_BUCKET", "devsync");
    this.client = new S3Client({
      endpoint: config.get<string>("S3_ENDPOINT", "http://localhost:9000"),
      region: config.get<string>("S3_REGION", "us-east-1"),
      forcePathStyle: config.get<string>("S3_FORCE_PATH_STYLE", "true") === "true",
      credentials: {
        accessKeyId: config.get<string>("S3_ACCESS_KEY_ID", "devsync"),
        secretAccessKey: config.get<string>("S3_SECRET_ACCESS_KEY", "devsync123")
      }
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.ensureBucket();
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType
      })
    );
  }

  getSignedUrl(key: string, expiresInSeconds = DEFAULT_URL_TTL_SECONDS) {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: expiresInSeconds }
    );
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  private ensureBucket() {
    if (!this.bucketReady) {
      this.bucketReady = this.client
        .send(new HeadBucketCommand({ Bucket: this.bucket }))
        .catch(async () => {
          this.logger.log(`Creating bucket "${this.bucket}"`);
          await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        })
        .then(() => undefined);
    }

    return this.bucketReady;
  }
}
