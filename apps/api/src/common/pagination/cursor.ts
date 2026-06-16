import { BadRequestException } from "@nestjs/common";

export type CursorPayload = {
  value: string;
  id: string;
};

export function clampLimit(limit: number | undefined, fallback = 20, max = 100) {
  if (!limit) {
    return fallback;
  }

  return Math.min(Math.max(limit, 1), max);
}

export function encodeCursor(payload: CursorPayload) {
  return Buffer.from(`${payload.value}|${payload.id}`, "utf8").toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separator = decoded.lastIndexOf("|");

  if (separator <= 0 || separator === decoded.length - 1) {
    throw new BadRequestException("Invalid cursor");
  }

  return {
    value: decoded.slice(0, separator),
    id: decoded.slice(separator + 1)
  };
}
