/**
 * Validates a Cloudflare Access JWT.
 * CF injects the CF-Access-Jwt-Assertion header automatically when the app is
 * behind an Access policy. We verify the token signature against the public
 * JWKS endpoint so forged tokens are rejected.
 *
 * Docs: https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */

interface JwtHeader {
  kid: string;
  alg: string;
}

interface JwtPayload {
  aud: string | string[];
  exp: number;
  iat: number;
  sub: string;
  email?: string;
}

function base64UrlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function getPublicKeys(teamDomain: string): Promise<JsonWebKey[]> {
  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch CF Access JWKS");
  const data = (await res.json()) as { keys: JsonWebKey[] };
  return data.keys;
}

export async function validateCfAccessJwt(
  token: string,
  aud: string,
  teamDomain: string,
): Promise<JwtPayload> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid JWT format");

  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];
  const header: JwtHeader = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(headerB64)),
  );
  const payload: JwtPayload = JSON.parse(
    new TextDecoder().decode(base64UrlDecode(payloadB64)),
  );

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Token expired");
  }

  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!audiences.includes(aud)) {
    throw new Error("Token audience mismatch");
  }

  const keys = await getPublicKeys(teamDomain);
  const jwk = keys.find((k) => (k as { kid?: string }).kid === header.kid);
  if (!jwk) throw new Error("No matching public key found");

  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(sigB64);

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    signingInput,
  );

  if (!valid) throw new Error("Invalid JWT signature");

  return payload;
}
