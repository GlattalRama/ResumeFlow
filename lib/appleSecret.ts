// Server-only. Apple does not issue a static OAuth client secret: the secret
// IS a short-lived ES256 JWT signed with the "Sign in with Apple" private key
// (Apple Developer portal → Certificates, Identifiers & Profiles → Keys).
// This generates and caches one per server instance.
import { createPrivateKey, sign } from "crypto";

// Apple allows up to 6 months; 30 days is far beyond any serverless instance
// lifetime while keeping the blast radius of a leaked secret small.
const SECRET_TTL_SECONDS = 60 * 60 * 24 * 30;

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

let cached: { secret: string; expiresAt: number } | null = null;

export function generateAppleClientSecret(): string {
  const now = Math.floor(Date.now() / 1000);
  if (cached && now < cached.expiresAt - 3600) return cached.secret;

  const teamId = process.env.APPLE_TEAM_ID ?? "";
  const keyId = process.env.APPLE_KEY_ID ?? "";
  const clientId = process.env.APPLE_CLIENT_ID ?? "";
  // The .p8 file contents; Vercel env vars flatten newlines to literal "\n".
  const pem = (process.env.APPLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId }));
  const payload = b64url(
    JSON.stringify({
      iss: teamId,
      iat: now,
      exp: now + SECRET_TTL_SECONDS,
      aud: "https://appleid.apple.com",
      sub: clientId,
    })
  );
  const data = `${header}.${payload}`;
  // JWTs carry the raw r||s ES256 signature (ieee-p1363), not DER.
  const signature = sign("sha256", Buffer.from(data), {
    key: createPrivateKey(pem),
    dsaEncoding: "ieee-p1363",
  });
  const secret = `${data}.${b64url(signature)}`;
  cached = { secret, expiresAt: now + SECRET_TTL_SECONDS };
  return secret;
}
