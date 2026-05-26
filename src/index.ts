import CustomError, { isCustomError, type CustomErrorOptions } from "./custom-error";
import { safeTry, type Result } from "./safe-try";
import { serializeError } from "./serialize-error";
import { UnknownError } from "./unknown-error";

export {
  safeTry,
  isCustomError,
  CustomError,
  UnknownError,
  serializeError,
  type Result,
  type CustomErrorOptions,
};
