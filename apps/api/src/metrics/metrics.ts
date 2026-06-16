import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

/**
 * A dedicated Prometheus registry (instead of the global default) keeps the
 * exported metric set explicit and makes the module safe to instantiate more
 * than once in tests without "metric already registered" errors.
 */
export const registry = new Registry();

registry.setDefaultLabels({ service: "devsync-api" });
collectDefaultMetrics({ register: registry });

export const httpRequestDuration = new Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status"] as const,
  // Tuned for a typical API: sub-ms cached reads through slow DB writes.
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [registry]
});

export const httpRequestsTotal = new Counter({
  name: "http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status"] as const,
  registers: [registry]
});
