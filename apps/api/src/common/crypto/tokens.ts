import { createHash, randomBytes } from "crypto";

/**
 * Opaque secret tokens (refresh tokens, email/reset/invite tokens) follow one
 * rule: the raw value is shown to the client exactly once, and only a SHA-256
 * hash is ever persisted. A database leak then exposes hashes, not usable
 * tokens. These helpers centralize that contract.
 */
export function generateToken(bytes = 48): string {
  return randomBytes(bytes).toString("hex");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
