import CustomError, { type CustomErrorOptions } from "./custom-error";

/**
 * Concrete {@link CustomError} subclass used when no typed error class matches.
 * Wraps unexpected throws and rejections so they always have a consistent shape.
 */
export class UnknownError extends CustomError {
  constructor(options: CustomErrorOptions) {
    super(options);
  }
}
