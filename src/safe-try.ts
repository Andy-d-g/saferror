import CustomError from "./custom-error";
import { UnknownError } from "./unknown-error";

export type Result<T = null, E extends CustomError = CustomError> = Promise<[E] | [null, T]>;

/**
 * Universal safe execution wrapper.
 * Handles both sync functions (that may throw) and async functions (that may reject).
 * Returns an [err, result] tuple — never throws.
 *
 * @param fn - sync or async function to execute
 * @param errorFactory - optional factory to create a typed error from the caught cause
 *
 * @example
 * // Without factory — wraps in generic CustomError
 * const [err, data] = await safeTry(() => JSON.parse(input));
 *
 * @example
 * // With factory — wraps in specific error type
 * const [err, response] = await safeTry(
 *   () => model.invoke(messages),
 *   (cause) => new AiGenerationError("Generation failed", cause),
 * );
 */
export function safeTry<T, E extends CustomError = CustomError>(
  fn: () => T | Promise<T>,
  errorFactory?: (cause?: Error) => E,
): Result<T, E> {
  return Promise.try(fn)
    .then((res) => [null, res] as [null, T])
    .catch((err) => {
      // If already a CustomError of expected type, pass through
      if (err instanceof CustomError) return [err as E];

      const cause = err instanceof Error ? err : new Error(String(err));
      const message = cause.message;

      if (errorFactory) {
        return [errorFactory(cause)];
      }

      return [new UnknownError({ message, cause }) as E];
    }) as Result<T, E>;
}
