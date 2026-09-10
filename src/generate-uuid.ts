/**
 * Generates a UUID v4 string.
 *
 * Resolution order:
 * 1. `crypto.randomUUID()` — Chrome 92+, Firefox 95+, Safari 15.4+, Node 19+ (secure contexts only).
 * 2. `crypto.getRandomValues()` — Chrome 11+, Firefox 21+, Safari 6.1+, and insecure contexts,
 *    where `randomUUID` is unavailable but Web Crypto is present.
 * 3. `Math.random()` — last resort for environments with no Web Crypto at all.
 *
 * Steps 1 and 2 are cryptographically random. Step 3 is **not**, and exists only so this
 * function can never throw: it is called from the {@link CustomError} constructor, so a
 * throw here would escape `safeTry` and break the library's never-throw guarantee.
 * `uid` is a log-correlation identifier, not a security token — collision resistance is
 * what matters for it, not unpredictability.
 *
 * @returns A UUID v4 string in the format `xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx`.
 */
export function generateUUID(): string {
  const webCrypto = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;

  if (typeof webCrypto?.randomUUID === "function") {
    return webCrypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof webCrypto?.getRandomValues === "function") {
    webCrypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant bits
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
