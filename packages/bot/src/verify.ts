export async function verifySignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string,
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(publicKey),
    { name: "NODE-ED25519", namedCurve: "NODE-ED25519" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    "NODE-ED25519",
    key,
    hexToBytes(signature),
    new TextEncoder().encode(timestamp + body),
  );
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}
