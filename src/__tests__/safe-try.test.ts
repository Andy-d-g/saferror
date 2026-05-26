import { describe, it, expect } from "vite-plus/test";
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
