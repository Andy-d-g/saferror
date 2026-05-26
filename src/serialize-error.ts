import CustomError from "./custom-error";

/**
 * Serialize any error-like value into a plain object suitable for structured
 * logging. Preserves the full chain of information from CustomError
 * (`uid`, `info`, `cause`) without flattening to a single string.
 */
export function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof CustomError) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      uid: err.uid,
      info: err.info,
      stack: err.stack,
    };
    if (err.cause instanceof Error) {
      out.cause = {
        name: err.cause.name,
        message: err.cause.message,
        stack: err.cause.stack,
      };
    } else if (err.cause != null) {
      out.cause = err.cause;
    }
    return out;
  }
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  return { raw: String(err) };
}
