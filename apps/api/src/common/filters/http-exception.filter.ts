import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  LoggerService
} from "@nestjs/common";
import { Request, Response } from "express";

/**
 * Single place that shapes every error the API returns and decides how it is
 * logged. The response body is intentionally stable (clients and e2e tests
 * depend on `statusCode` + `error`), and now also carries the `requestId` and
 * `path` so a failing call can be matched to a log line.
 *
 * Logging policy:
 * - 5xx (including unexpected non-HttpException throws) -> error, with stack.
 * - 4xx -> warn (operationally interesting, but not our fault).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger?: LoggerService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : "Internal server error";

    const requestId = (request as Request & { id?: string }).id;

    const body = {
      statusCode: status,
      error: exceptionResponse,
      requestId,
      path: request.originalUrl ?? request.url,
      timestamp: new Date().toISOString()
    };

    this.log(status, exception, body.path, requestId);

    response.status(status).json(body);
  }

  private log(status: number, exception: unknown, path: string, requestId?: string) {
    if (!this.logger) {
      return;
    }

    const context = "HttpExceptionFilter";
    const meta = { requestId, path, statusCode: status };

    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const stack = exception instanceof Error ? exception.stack : undefined;
      const message = exception instanceof Error ? exception.message : "Unhandled exception";
      this.logger.error({ ...meta, err: exception }, stack ?? message, context);
    } else {
      const message =
        exception instanceof HttpException ? exception.message : "Request failed";
      this.logger.warn({ ...meta }, `${message} (${status})`, context);
    }
  }
}
