import { StorageService } from "./storage.service";

/**
 * Test double for `StorageService` so the e2e suite exercises upload/list/delete
 * logic without a live MinIO/S3. Signed URLs are deterministic placeholders.
 */
export class InMemoryStorageService extends StorageService {
  private readonly store = new Map<string, { body: Buffer; contentType: string }>();

  async put(key: string, body: Buffer, contentType: string) {
    this.store.set(key, { body, contentType });
  }

  async getSignedUrl(key: string) {
    return `memory://${key}`;
  }

  async delete(key: string) {
    this.store.delete(key);
  }
}
