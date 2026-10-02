import { Injectable } from "@angular/core";

type LogContext = Record<string, unknown>;

@Injectable({ providedIn: "root" })
export class LoggerService {
  /**
   * Logs a recoverable problem worth noticing.
   * @param message Short description of what happened.
   * @param context Extra structured detail for debugging.
   */
  warn(message: string, context?: LogContext): void {
    console.warn(message, ...(context ? [context] : []));
  }

  /**
   * Logs a failure.
   * @param message Short description of what failed.
   * @param context Extra structured detail, such as the original error.
   */
  error(message: string, context?: LogContext): void {
    console.error(message, ...(context ? [context] : []));
  }
}
