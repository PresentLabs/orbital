import { createDecipheriv, createHash } from "node:crypto";
/** Reject plaintext writes through Payload's own REST API and admin panel too. */
export function validateEncryptedAccess(value: unknown, secret: string) {
  if (
    typeof value !== "string" ||
    secret.length < 32 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value)
  )
    return false;
  try {
    const raw = Buffer.from(value, "base64");
    if (raw.length < 30) return false;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      createHash("sha256").update(secret).digest(),
      raw.subarray(0, 12),
    );
    decipher.setAuthTag(raw.subarray(-16));
    const decoded = JSON.parse(
      Buffer.concat([
        decipher.update(raw.subarray(12, -16)),
        decipher.final(),
      ]).toString("utf8"),
    );
    return (
      ["title", "category", "url", "username", "password", "notes"].every(
        (k) => typeof decoded[k] === "string",
      ) && decoded.title.length > 0
    );
  } catch {
    return false;
  }
}
