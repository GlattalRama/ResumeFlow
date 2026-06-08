// Symmetric encryption for secrets stored at rest (currently the user's BYOK
// AI API key, kept in their Google Drive appData). Uses AES-256-GCM with a key
// derived from AUTH_SECRET, so the raw key is never readable in Drive — even
// though that folder is already private to the user + app.
//
// Node-only (uses `crypto`). Import from server code (API routes), never from
// middleware or client components.
import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto";
import { authSecret } from "./googleConfig";

function secretKey(): Buffer {
  const secret = authSecret();
  if (!secret) {
    throw new Error(
      "AUTH_SECRET (or NEXTAUTH_SECRET) must be set to encrypt stored secrets."
    );
  }
  // Derive a fixed 32-byte key from the (variable-length) secret.
  return createHash("sha256").update(secret).digest();
}

// Encrypt a UTF-8 string. Output layout: base64( iv(12) | authTag(16) | ciphertext ).
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", secretKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), enc]).toString("base64");
}

// Decrypt a value produced by encrypt(). Throws if the data is tampered with
// or the AUTH_SECRET changed.
export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", secretKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
