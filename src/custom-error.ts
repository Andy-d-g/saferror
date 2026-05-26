export interface CustomErrorOptions<T extends Record<string, unknown> = Record<string, unknown>> {
  info?: T;
  cause?: Error;
  message: string;
}

export default abstract class CustomError<
  T extends Record<string, unknown> = Record<string, unknown>,
> extends Error {
  info: T;
  uid: string;
  statusCode: number = 400;
  declare cause: Error | undefined;

  constructor(options: CustomErrorOptions<T>) {
    const { info, cause, message } = options;
    super(message, cause ? { cause } : undefined);
    this.info = info || ({} as T);
    this.uid = crypto.randomUUID();
    this.name = this.constructor.name;
    if (cause) this.cause = cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }

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

export function isCustomError(err: unknown): err is CustomError {
  return err instanceof CustomError;
}
