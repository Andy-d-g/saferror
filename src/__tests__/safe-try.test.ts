import { describe, it, expect, beforeEach, afterEach } from "vite-plus/test";
import { safeTry } from "../safe-try";
import CustomError from "../custom-error";
import { UnknownError } from "../unknown-error";

class TestError extends CustomError {
  override statusCode = 422;
  constructor(message: string, cause?: Error) {
    super({ message, cause });
  }
}

describe("safeTry", () => {
  describe("with sync functions", () => {
    it("should return [null, result] on success", async () => {
      const [err, result] = await safeTry(() => 42);
      expect(err).toBeNull();
      expect(result).toBe(42);
    });

    it("should return [error] when function throws", async () => {
      const [err, result] = await safeTry(() => {
        throw new Error("sync throw");
      });
      expect(err).toBeTruthy();
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("sync throw");
      expect(result).toBeUndefined();
    });

    it("should handle JSON.parse success", async () => {
      const [err, result] = await safeTry(() => JSON.parse('{"key":"value"}'));
      expect(err).toBeNull();
      expect(result).toEqual({ key: "value" });
    });

    it("should handle JSON.parse failure", async () => {
      const [err] = await safeTry(() => JSON.parse("invalid json"));
      expect(err).toBeTruthy();
      expect(err).toBeInstanceOf(CustomError);
    });
  });

  describe("with async functions", () => {
    it("should return [null, result] on resolved promise", async () => {
      const [err, result] = await safeTry(async () => "async value");
      expect(err).toBeNull();
      expect(result).toBe("async value");
    });

    it("should return [error] on rejected promise", async () => {
      const [err] = await safeTry(async () => {
        throw new Error("async reject");
      });
      expect(err).toBeTruthy();
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("async reject");
    });
  });

  describe("with error factory", () => {
    it("should use factory to create typed error", async () => {
      const [err] = await safeTry(
        () => {
          throw new Error("original");
        },
        (cause) => new TestError("wrapped error", cause),
      );
      expect(err).toBeInstanceOf(TestError);
      expect(err!.message).toBe("wrapped error");
      expect(err!.statusCode).toBe(422);
      expect(err!.cause).toBeInstanceOf(Error);
      expect((err!.cause as Error).message).toBe("original");
    });

    it("should use factory for async errors", async () => {
      const [err] = await safeTry(
        async () => {
          throw new Error("async original");
        },
        (cause) => new TestError("async wrapped", cause),
      );
      expect(err).toBeInstanceOf(TestError);
      expect(err!.message).toBe("async wrapped");
    });

    it("should pass non-Error rejection to factory as wrapped Error", async () => {
      const [err] = await safeTry(
        async () => Promise.reject("not an error"),
        (cause) => new TestError("wrapped non-error", cause),
      );
      expect(err).toBeInstanceOf(TestError);
      expect(err!.cause).toBeInstanceOf(Error);
      expect((err!.cause as Error).message).toBe("not an error");
    });

    it("should not use factory when CustomError is thrown", async () => {
      const original = new UnknownError({ message: "already custom" });
      const [err] = await safeTry(
        () => {
          throw original;
        },
        () => new TestError("should not be used"),
      );
      expect(err).toBe(original);
      expect(err!.message).toBe("already custom");
    });
  });

  describe("fallback when Promise.try is unavailable", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let saved: unknown;

    beforeEach(() => {
      saved = (Promise as any).try;
      (Promise as any).try = undefined;
    });

    afterEach(() => {
      (Promise as any).try = saved;
    });

    it("should return [null, result] for sync success", async () => {
      const [err, result] = await safeTry(() => 42);
      expect(err).toBeNull();
      expect(result).toBe(42);
    });

    it("should return [error] when sync function throws", async () => {
      const [err] = await safeTry(() => {
        throw new Error("sync throw without Promise.try");
      });
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("sync throw without Promise.try");
    });

    it("should return [null, result] for async success", async () => {
      const [err, result] = await safeTry(async () => "async without Promise.try");
      expect(err).toBeNull();
      expect(result).toBe("async without Promise.try");
    });

    it("should return [error] when async function rejects", async () => {
      const [err] = await safeTry(async () => {
        throw new Error("async reject without Promise.try");
      });
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("async reject without Promise.try");
    });

    it("should use error factory in fallback path", async () => {
      const [err] = await safeTry(
        () => {
          throw new Error("original");
        },
        (cause) => new TestError("wrapped", cause),
      );
      expect(err).toBeInstanceOf(TestError);
      expect(err!.message).toBe("wrapped");
    });

    it("should pass through CustomError without wrapping in fallback path", async () => {
      const original = new UnknownError({ message: "already custom" });
      const [err] = await safeTry(() => {
        throw original;
      });
      expect(err).toBe(original);
    });
  });

  describe("edge cases", () => {
    it("should handle non-Error throws (string)", async () => {
      const [err] = await safeTry(() => {
        throw "string error";
      });
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("string error");
    });

    it("should handle non-Error throws (number)", async () => {
      const [err] = await safeTry(() => {
        throw 404;
      });
      expect(err).toBeInstanceOf(CustomError);
      expect(err!.message).toBe("404");
    });

    it("should handle undefined return", async () => {
      const [err, result] = await safeTry(() => undefined);
      expect(err).toBeNull();
      expect(result).toBeUndefined();
    });

    it("should handle null return", async () => {
      const [err, result] = await safeTry(() => null);
      expect(err).toBeNull();
      expect(result).toBeNull();
    });

    it("should pass through CustomError subclass without wrapping", async () => {
      const original = new TestError("direct throw");
      const [err] = await safeTry(() => {
        throw original;
      });
      expect(err).toBe(original);
      expect(err).toBeInstanceOf(TestError);
    });
  });
});

/**
 * Regression guard for the production failure seen on Mobile Safari 17.6:
 * `TypeError: Promise.try is not a function`.
 *
 * `Promise.try` needs Safari/iOS 18.2+ and `crypto.randomUUID` needs a secure
 * context, but build targets like `safari16.4` only transpile syntax, never
 * runtime APIs. These tests pin the whole legacy environment so a future change
 * cannot reintroduce an unguarded modern API on the safeTry path.
 */
describe("legacy runtime regression (iOS <= 18.1)", () => {
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  let savedTry: unknown;

  beforeEach(() => {
    savedTry = (Promise as unknown as Record<string, unknown>).try;
    (Promise as unknown as Record<string, unknown>).try = undefined;
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    (Promise as unknown as Record<string, unknown>).try = savedTry;
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
  });

  it("should not reference Promise.try when it is unavailable", async () => {
    // Accessing the property at all would throw in the broken build.
    expect((Promise as unknown as Record<string, unknown>).try).toBeUndefined();
    const [err, result] = await safeTry(() => "ok");
    expect(err).toBeNull();
    expect(result).toBe("ok");
  });

  it("should resolve sync success without any modern API", async () => {
    const [err, result] = await safeTry(() => 1 + 1);
    expect(err).toBeNull();
    expect(result).toBe(2);
  });

  it("should resolve async success without any modern API", async () => {
    const [err, result] = await safeTry(async () => "async ok");
    expect(err).toBeNull();
    expect(result).toBe("async ok");
  });

  it("should convert a sync throw into an error tuple, never a raised throw", async () => {
    let raised: unknown = null;
    let tuple: [CustomError] | [null, never] | undefined;
    try {
      tuple = await safeTry(() => {
        throw new Error("legacy sync boom");
      });
    } catch (e) {
      raised = e;
    }
    expect(raised).toBeNull();
    expect(tuple![0]).toBeInstanceOf(CustomError);
    expect(tuple![0]!.message).toBe("legacy sync boom");
  });

  it("should convert an async rejection into an error tuple", async () => {
    const [err] = await safeTry(async () => {
      throw new Error("legacy async boom");
    });
    expect(err).toBeInstanceOf(UnknownError);
    expect(err!.message).toBe("legacy async boom");
  });

  it("should still build a usable uid on the error path", async () => {
    const [err] = await safeTry(() => {
      throw new Error("needs uid");
    });
    expect(typeof err!.uid).toBe("string");
    expect(err!.uid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("should still apply the error factory", async () => {
    const [err] = await safeTry(
      () => {
        throw new Error("original");
      },
      (cause) => new TestError("wrapped in legacy env", cause),
    );
    expect(err).toBeInstanceOf(TestError);
    expect(err!.message).toBe("wrapped in legacy env");
    expect(err!.cause!.message).toBe("original");
  });
});
