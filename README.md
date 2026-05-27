# saferror

[![npm version](https://img.shields.io/npm/v/saferror.svg?style=flat-square)](https://www.npmjs.com/package/saferror)
[![CI](https://github.com/andyguillaume/saferror/actions/workflows/ci.yml/badge.svg)](https://github.com/andyguillaume/saferror/actions/workflows/ci.yml)
[![npm downloads](https://img.shields.io/npm/dm/saferror.svg?style=flat-square)](https://www.npmjs.com/package/saferror)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg?style=flat-square)](LICENSE)
[![Node.js >=18](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)](https://nodejs.org)
[![Browser](https://img.shields.io/badge/browser-supported-brightgreen?style=flat-square)](https://caniuse.com/cryptography)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

> Type-safe, structured error handling for TypeScript. Stop catching `unknown`, start catching what you actually expect.

---

## Why saferror?

JavaScript's native `try/catch` forces you to work with `unknown` — there's no type information, no structured context, and no consistent shape. Errors thrown from third-party libraries, async operations, or your own code all look the same at the catch site.

**saferror** gives you:

- **Typed errors** with a consistent shape — `message`, `uid`, `statusCode`, `info`, `cause`
- **`safeTry`** — a zero-overhead wrapper that replaces `try/catch` with an `[error, result]` tuple, fully typed
- **`serializeError`** — turn any error (native or custom) into a plain object safe for logging and JSON serialization
- **No thrown errors** in your application logic — if you want them, they're opt-in

---

## Installation

```bash
npm install saferror
```

```bash
yarn add saferror
```

```bash
pnpm add saferror
```

> **Requirements:** Node.js ≥ 18.0.0, TypeScript ≥ 5.0, or any modern browser (Chrome 11+, Firefox 21+, Safari 6.1+).

---

## Quick Start

```ts
import { safeTry, CustomError, UnknownError, serializeError, isCustomError } from "saferror";

// 1. Define your typed errors
class DatabaseError extends CustomError {
  override statusCode = 503;
}

class NotFoundError extends CustomError {
  override statusCode = 404;
}

// 2. Use safeTry instead of try/catch — never throws, always returns a tuple
const [err, user] = await safeTry(
  () => db.findUser(id),
  (cause) => new DatabaseError({ message: "Failed to fetch user", cause, info: { userId: id } }),
);

if (err) {
  console.error(serializeError(err)); // structured log-ready object
  return;
}

console.log(user); // typed, non-null ✓
```

---

## API Reference

### `CustomError` (abstract class)

The base class for all your application errors. Extend it to create typed, structured errors.

```ts
abstract class CustomError<T extends Record<string, unknown> = Record<string, unknown>> extends Error {
  uid: string;           // Auto-generated UUID — uses crypto.randomUUID when available, falls back to crypto.getRandomValues
  statusCode: number;    // Default: 400. Override per subclass.
  info: T;               // Arbitrary structured metadata
  cause?: Error;         // Native ES2022 cause chain
}
```

#### Defining custom errors

```ts
import { CustomError } from "saferror";

// Simple error
class PaymentError extends CustomError {
  override statusCode = 402;
}

// Typed info metadata
interface ValidationInfo {
  field: string;
  rule: string;
  received: unknown;
}

class ValidationError extends CustomError<ValidationInfo> {
  override statusCode = 422;
}

// Usage
throw new ValidationError({
  message: "Invalid email address",
  info: { field: "email", rule: "format", received: "not-an-email" },
});
```

#### Constructor options

| Option    | Type     | Required | Description                                      |
|-----------|----------|----------|--------------------------------------------------|
| `message` | `string` | ✅        | Human-readable error description                 |
| `info`    | `T`      | ❌        | Structured metadata. Defaults to `{}`            |
| `cause`   | `Error`  | ❌        | The underlying error that triggered this one     |

#### `toString()`

Produces a multi-line human-readable string including name, message, uid, info, and the full cause chain:

```
ValidationError: Invalid email address [uid=3f1a9c2d-...]
  info: {"field":"email","rule":"format","received":"not-an-email"}
  cause: Original parse error
  Error: Original parse error
      at ...
```

---

### `safeTry`

A universal async/sync wrapper that never throws. Returns an `[error, result]` tuple.

```ts
function safeTry<T, E extends CustomError = CustomError>(
  fn: () => T | Promise<T>,
  errorFactory?: (cause?: Error) => E,
): Result<T, E>
```

**The tuple shape:**
- `[null, T]` on success — error is null, result is typed
- `[E]` on failure — result is undefined, error is typed

#### Without a factory — wraps in `UnknownError`

```ts
const [err, parsed] = await safeTry(() => JSON.parse(rawInput));

if (err) {
  // err is UnknownError (a CustomError), never plain Error
  console.log(err.message); // "Unexpected token ..."
  return;
}

console.log(parsed); // typed as the return type of JSON.parse
```

#### With a factory — wraps in your typed error

```ts
class AiError extends CustomError {
  override statusCode = 500;
}

const [err, response] = await safeTry(
  () => openai.chat.completions.create(payload),
  (cause) => new AiError({ message: "AI generation failed", cause }),
);
```

#### Sync functions work too

```ts
const [err, result] = await safeTry(() => riskySync());
```

#### CustomErrors pass through untouched

If the function throws a `CustomError`, `safeTry` returns it as-is without re-wrapping, even if a factory is provided:

```ts
const original = new PaymentError({ message: "Insufficient funds" });

const [err] = await safeTry(
  () => { throw original; },
  () => new DatabaseError({ message: "won't be used" }),
);

err === original; // true — passed through directly
```

#### Non-Error throws are normalized

```ts
const [err] = await safeTry(() => { throw "something went wrong"; });

err?.message; // "something went wrong" — string is wrapped in Error first
```

---

### `Result<T, E>` type

The return type of `safeTry`. A Promise resolving to either a success or an error tuple.

```ts
type Result<T = null, E extends CustomError = CustomError> = Promise<[E] | [null, T]>;
```

Use it to type functions that return safe results:

```ts
import { type Result, CustomError } from "saferror";

class FetchError extends CustomError {}

async function fetchUser(id: string): Result<User, FetchError> {
  return safeTry(
    () => api.getUser(id),
    (cause) => new FetchError({ message: "User fetch failed", cause, info: { id } }),
  );
}

// Call site — destructured, fully typed
const [err, user] = await fetchUser("user_123");
```

---

### `serializeError`

Converts any error value into a plain object safe for structured logging (e.g. Pino, Winston, Datadog).

```ts
function serializeError(err: unknown): Record<string, unknown>
```

| Input type     | Output fields                                                     |
|----------------|-------------------------------------------------------------------|
| `CustomError`  | `name`, `message`, `uid`, `info`, `stack`, `cause` (if present)   |
| `Error`        | `name`, `message`, `stack`                                        |
| anything else  | `{ raw: String(err) }`                                            |

```ts
import { serializeError } from "saferror";

const [err] = await safeTry(() => db.query(sql));

if (err) {
  logger.error(serializeError(err));
  // {
  //   name: "DatabaseError",
  //   message: "Connection refused",
  //   uid: "a1b2c3d4-...",
  //   info: { host: "localhost", port: 5432 },
  //   stack: "DatabaseError: Connection refused\n    at ...",
  //   cause: { name: "Error", message: "ECONNREFUSED", stack: "..." }
  // }
}
```

---

### `isCustomError`

Type guard to check if a value is a `CustomError` instance (or any subclass).

```ts
function isCustomError(err: unknown): err is CustomError
```

```ts
try {
  riskyThirdPartyCall();
} catch (err) {
  if (isCustomError(err)) {
    // err is CustomError — access .uid, .info, .statusCode safely
    console.log(err.uid);
  } else {
    // handle plain Error or unknown
  }
}
```

---

### `UnknownError`

The concrete `CustomError` subclass used internally by `safeTry` when no factory is provided. You can also use it directly for errors of uncertain origin.

```ts
class UnknownError extends CustomError {
  constructor(options: CustomErrorOptions) {
    super(options);
  }
}
```

---

## Patterns & Recipes

### Pattern: Service layer with typed results

```ts
// services/user.service.ts
import { safeTry, type Result, CustomError } from "saferror";

export class UserNotFoundError extends CustomError {
  override statusCode = 404;
}

export class UserDbError extends CustomError {
  override statusCode = 503;
}

export async function getUser(id: string): Result<User, UserNotFoundError | UserDbError> {
  const [dbErr, row] = await safeTry(
    () => db.users.findUnique({ where: { id } }),
    (cause) => new UserDbError({ message: "DB read failed", cause, info: { id } }),
  );

  if (dbErr) return [dbErr];
  if (!row) return [new UserNotFoundError({ message: `User ${id} not found`, info: { id } })];

  return [null, row];
}
```

```ts
// handlers/user.handler.ts
const [err, user] = await getUser(req.params.id);

if (err) {
  res.status(err.statusCode).json({ error: err.message, ref: err.uid });
  return;
}

res.json(user);
```

---

### Pattern: Chaining errors with cause

```ts
class ConfigError extends CustomError { override statusCode = 500; }
class AppStartupError extends CustomError { override statusCode = 500; }

const [configErr, config] = await safeTry(
  () => loadConfig("./config.json"),
  (cause) => new ConfigError({ message: "Failed to load config", cause }),
);

if (configErr) {
  throw new AppStartupError({
    message: "Application failed to start",
    cause: configErr,       // chain the original error
    info: { phase: "init" },
  });
}
```

---

### Pattern: Logging every error uniformly

```ts
import { serializeError, isCustomError } from "saferror";

function logError(err: unknown, context?: Record<string, unknown>) {
  const serialized = serializeError(err);

  logger.error({
    ...serialized,
    ...context,
    // uid is present for CustomErrors — use it to correlate logs with user-facing error refs
    ref: isCustomError(err) ? err.uid : undefined,
  });
}
```

---

### Pattern: Express error middleware

```ts
import { isCustomError, serializeError } from "saferror";
import type { Request, Response, NextFunction } from "express";

export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction) {
  logger.error(serializeError(err));

  if (isCustomError(err)) {
    res.status(err.statusCode).json({
      error: err.message,
      ref: err.uid,           // Return uid so users can report issues
    });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
```

---

## TypeScript Notes

- All exports are fully typed with generic type parameters
- `CustomError<T>` is generic over the `info` shape — get autocomplete on `.info` fields
- `Result<T, E>` propagates your error type through the entire call chain
- `isCustomError` is a proper type guard — TypeScript narrows the type after the `if` block
- `safeTry` infers the return type of `fn` automatically — no manual annotation needed

---

## Contributing

Contributions are welcome! Here's how to get started:

```bash
git clone https://github.com/andyguillaume/saferror.git
cd saferror
npm install
```

### Development workflow

```bash
npm test           # run tests once
npm run test:watch # run tests in watch mode
npm run typecheck  # TypeScript type check (no emit)
npm run build      # build to dist/
```

### Submitting changes

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/my-feature`
3. Write tests first (TDD) — tests live in `src/__tests__/`
4. Implement your change
5. Run `npm test` and `npm run typecheck` — both must pass
6. Open a pull request against `main`

### Reporting bugs

Please open an issue at [github.com/andyguillaume/saferror/issues](https://github.com/andyguillaume/saferror/issues) and include:
- Node.js version (`node --version`)
- TypeScript version (`tsc --version`)
- A minimal reproduction

---

## Changelog

See [GitHub Releases](https://github.com/andyguillaume/saferror/releases).

---

## License

[ISC](LICENSE) © [Andy Guillaume](mailto:andy.guillaume75@gmail.com)
