import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import type { Request, Response } from "express";
import { Observable } from "rxjs";
import { finalize } from "rxjs/operators";
import { httpRequestDuration, httpRequestsTotal } from "./metrics";

/**
 * Records request latency and counts for every HTTP request. We label by the
 * route *pattern* (e.g. `/tasks/:taskId`) rather than the concrete URL to keep
 * Prometheus label cardinality bounded.
 */
@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") {
      return next.handle();
    }

    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    const stopTimer = httpRequestDuration.startTimer();

    return next.handle().pipe(
      finalize(() => {
        const route = request.route?.path ?? request.path ?? "unknown";
        const labels = {
          method: request.method,
          route: typeof route === "string" ? route : "unknown",
          status: String(response.statusCode)
        };
        stopTimer(labels);
        httpRequestsTotal.inc(labels);
      })
    );
  }
}
