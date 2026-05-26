import CustomError, { type CustomErrorOptions } from "./custom-error";

export class UnknownError extends CustomError {
  constructor(options: CustomErrorOptions) {
    super(options);
  }
}
