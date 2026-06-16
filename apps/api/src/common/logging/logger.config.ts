import { randomUUID } from "crypto";
import type { IncomingMessage, ServerResponse } from "http";
import type { Params } from "nestjs-pino";

/**
 * Centralized structured-logging configuration (Pino via nestjs-pino).
 *
 * Goals:
 * - One JSON log line per request in non-dev environments (machine-parseable).
 * - Every log line carries a `requestId` so a single request can be traced
 *   across the access log, business logs, and the error filter.
 * - Inbound `x-request-id` headers are honored (so a gateway/load balancer can
 *   stitch traces together) and always echoed back on the response.
 * - Secrets in headers are redacted before they ever reach disk.
 * - Tests stay quiet; local dev gets pretty, single-line output.
 */
function resolveLevel(): string {
  if (process.env.NODE_ENV === "test") {
    return "silent";
  }
  if (process.env.LOG_LEVEL) {
    return process.env.LOG_LEVEL;
  }
  return process.env.NODE_ENV === "production" ? "info" : "debug";
}

const usePretty =
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "test" &&
  process.env.LOG_PRETTY !== "false";

export const loggerModuleOptions: Params = {
  pinoHttp: {
    level: resolveLevel(),
    // Reuse an upstream request id when present, otherwise mint one. Always
    // surface it on the response so clients can quote it in bug reports.
    genReqId: (req: IncomingMessage, res: ServerResponse) => {
      const header = req.headers["x-request-id"];
      const existing = Array.isArray(header) ? header[0] : header;
      const id = existing && existing.length > 0 ? existing : randomUUID();
      res.setHeader("x-request-id", id);
      return id;
    },
    customProps: (req) => ({ requestId: (req as IncomingMessage & { id?: string }).id }),
    // Health checks and the metrics scrape are high-frequency and low-signal.
    autoLogging: {
      ignore: (req: IncomingMessage) => req.url === "/metrics" || req.url === "/api/health"
    },
    redact: {
      paths: ["req.headers.authorization", "req.headers.cookie", 'req.headers["set-cookie"]'],
      remove: true
    },
    transport: usePretty
      ? {
          target: "pino-pretty",
          options: {
            singleLine: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname"
          }
        }
      : undefined
  }
};
