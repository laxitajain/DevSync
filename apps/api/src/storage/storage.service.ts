/**
 * Storage abstraction (used as the DI token). Implementations stream object
 * bytes to a backing store and hand back time-limited signed download URLs so
 * file contents never flow through the API after upload.
 */
export abstract class StorageService {
  abstract put(key: string, body: Buffer, contentType: string): Promise<void>;
  abstract getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>;
  abstract delete(key: string): Promise<void>;
}
