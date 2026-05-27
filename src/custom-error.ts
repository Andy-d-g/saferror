import { generateUUID } from "./generate-uuid";

/** Options for constructing a {@link CustomError}. */
export interface CustomErrorOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  /** Arbitrary metadata attached to the error for structured logging. */
  info?: T;
  /** The underlying error that caused this one. */
  cause?: Error;
  /** Human-readable error message. */
  message: string;
}

/**
 * Abstract base class for all application errors.
 * Extend it to create typed, structured errors with a consistent shape.
 *
 * @example
 * class DatabaseError extends CustomError {
 *   override statusCode = 503;
 * }
 */
export default abstract class CustomError<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  /** Arbitrary metadata attached to the error. */
  info: T;
  /** Unique identifier for this error instance, useful for log correlation. */
  uid: string;
  /** HTTP-style status code — override in subclasses to set a specific value. */
  statusCode: number = 400;
  declare cause: Error | undefined;

  constructor(options: CustomErrorOptions<T>) {
    const { info, cause, message } = options;
    super(message, cause ? { cause } : undefined);
    this.info = info || ({} as T);
    this.uid = generateUUID();
    this.name = this.constructor.name;
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Returns a human-readable multi-line string representation of the error,
   * including `uid`, `info`, and the full cause chain.
   */
  override toString() {
    const parts = [`${this.name}: ${this.message} [uid=${this.uid}]`];
    if (Object.keys(this.info).length) {
      parts.push(`  info: ${JSON.stringify(this.info)}`);
    }
    if (this.cause instanceof Error) {
      parts.push(`  cause: ${this.cause.message}`);
      if (this.cause.stack) parts.push(this.cause.stack);
    } else if (this.cause) {
      parts.push(`  cause: ${JSON.stringify(this.cause)}`);
    }
    return parts.join("\n");
  }
}

/**
 * Type guard — returns `true` if `err` is an instance of {@link CustomError}.
 *
 * @param err - any value to check
 */
export function isCustomError(err: unknown): err is CustomError {
  return err instanceof CustomError;
}
