import { FileValidator } from "@nestjs/common";

/**
 * Validates a multipart file's reported MIME type against an allowlist regex.
 * A custom validator keeps behavior stable across Nest versions (the built-in
 * `FileTypeValidator` has changed its matching semantics between releases).
 */
export class AllowedMimeValidator extends FileValidator<{ pattern: RegExp }> {
  isValid(file?: unknown): boolean {
    const mimetype = (file as { mimetype?: string } | undefined)?.mimetype;
    return Boolean(mimetype && this.validationOptions.pattern.test(mimetype));
  }

  buildErrorMessage(): string {
    return "Unsupported file type";
  }
}
