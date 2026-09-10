import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import CustomError, { isCustomError } from "../custom-error";
import { UnknownError } from "../unknown-error";

describe("CustomError", () => {
  it("should create an error with message", () => {
    const error = new UnknownError({ message: "Something went wrong" });
    expect(error.message).toBe("Something went wrong");
    expect(error.name).toBe("UnknownError");
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(CustomError);
  });

  it("should generate a unique uid", () => {
    const a = new UnknownError({ message: "a" });
    const b = new UnknownError({ message: "b" });
    expect(a.uid).toBeTruthy();
    expect(b.uid).toBeTruthy();
    expect(a.uid).not.toBe(b.uid);
  });

  it("should have default statusCode of 400", () => {
    const error = new UnknownError({ message: "bad request" });
    expect(error.statusCode).toBe(400);
  });

  it("should allow subclass to override statusCode", () => {
    class NotFoundError extends CustomError {
      override statusCode = 404;
      constructor(message: string) {
        super({ message });
      }
    }
    const error = new NotFoundError("not found");
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe("NotFoundError");
    expect(error).toBeInstanceOf(CustomError);
  });

  it("should store info metadata", () => {
    const error = new UnknownError({
      message: "validation failed",
      info: { field: "email", rule: "required" },
    });
    expect(error.info).toEqual({ field: "email", rule: "required" });
  });

  it("should default info to empty object", () => {
    const error = new UnknownError({ message: "test" });
    expect(error.info).toEqual({});
  });

  it("should store native ES2022 cause", () => {
    const original = new Error("original error");
    const error = new UnknownError({ message: "wrapper", cause: original });
    expect(error.cause).toBe(original);
  });

  it("should not set cause when not provided", () => {
    const error = new UnknownError({ message: "no cause" });
    expect(error.cause).toBeUndefined();
  });

  it("should preserve prototype chain with instanceof", () => {
    class FooError extends CustomError {
      constructor() {
        super({ message: "foo" });
      }
    }
    class BarError extends FooError {
      constructor() {
        super();
      }
    }
    const bar = new BarError();
    expect(bar).toBeInstanceOf(BarError);
    expect(bar).toBeInstanceOf(FooError);
    expect(bar).toBeInstanceOf(CustomError);
    expect(bar).toBeInstanceOf(Error);
  });

  it("toString should include name and message", () => {
    const error = new UnknownError({ message: "test error" });
    expect(error.toString()).toContain("UnknownError");
    expect(error.toString()).toContain("test error");
  });

  it("toString should include info when present", () => {
    const error = new UnknownError({
      message: "with info",
      info: { key: "value" },
    });
    const str = error.toString();
    expect(str).toContain('"key"');
    expect(str).toContain('"value"');
  });

  it("toString should include cause when present", () => {
    const cause = new Error("root cause");
    const error = new UnknownError({ message: "wrapper", cause });
    expect(error.toString()).toContain("root cause");
  });
});

describe("isCustomError", () => {
  it("should return true for CustomError instances", () => {
    expect(isCustomError(new UnknownError({ message: "test" }))).toBe(true);
  });

  it("should return true for subclass instances", () => {
    class MyError extends CustomError {
      constructor() {
        super({ message: "sub" });
      }
    }
    expect(isCustomError(new MyError())).toBe(true);
  });

  it("should return false for plain Error", () => {
    expect(isCustomError(new Error("plain"))).toBe(false);
  });

  it("should return false for non-Error values", () => {
    expect(isCustomError("string")).toBe(false);
    expect(isCustomError(42)).toBe(false);
    expect(isCustomError(null)).toBe(false);
    expect(isCustomError(undefined)).toBe(false);
    expect(isCustomError({})).toBe(false);
  });
});

/**
 * Regression guard: `generateUUID()` runs inside the CustomError constructor, so a
 * throw there escapes `safeTry` and breaks the library's never-throw guarantee.
 * Constructing an error must succeed even with no Web Crypto at all.
 */
describe("CustomError construction without Web Crypto", () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");

  beforeEach(() => {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
  });

  it("should not throw when constructing an error", () => {
    expect(() => new UnknownError({ message: "no crypto" })).not.toThrow();
  });

  it("should still assign a well-formed uid", () => {
    const error = new UnknownError({ message: "no crypto" });
    expect(error.uid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("should assign distinct uids across instances", () => {
    const a = new UnknownError({ message: "a" });
    const b = new UnknownError({ message: "b" });
    expect(a.uid).not.toBe(b.uid);
  });

  it("should preserve message, cause and toString output", () => {
    const cause = new Error("root cause");
    const error = new UnknownError({ message: "outer", cause });
    expect(error.message).toBe("outer");
    expect(error.cause).toBe(cause);
    expect(error.toString()).toContain(`[uid=${error.uid}]`);
  });
});
