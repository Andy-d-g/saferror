import CustomError from "./custom-error";

/**
 * Serializes any error-like value into a plain object safe for structured
 * logging and JSON serialization.
 *
 * - For {@link CustomError}: preserves `uid`, `info`, `stack`, and the full `cause` chain.
 * - For native `Error`: returns `name`, `message`, and `stack`.
 * - For anything else: returns `{ raw: String(err) }`.
 *
 * @param err - any value to serialize
 * @returns A plain object representation of the error.
 *
 * @example
 * const [err] = await safeTry(() => db.find(id));
 * if (err) logger.error(serializeError(err));
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
