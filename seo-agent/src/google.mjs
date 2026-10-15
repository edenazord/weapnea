import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
export const SCOPE_READONLY = "https://www.googleapis.com/auth/webmasters.readonly";
export const SCOPE_WRITE = "https://www.googleapis.com/auth/webmasters";
const cachedTokens = new Map();

export async function getAccessToken(keyFile, scope = SCOPE_READONLY) {
  const cached = cachedTokens.get(scope);
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.value;

  const key = JSON.parse(await readFile(keyFile, "utf8"));
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(
    JSON.stringify({ alg: "RS256", typ: "JWT" }),
  ).toString("base64url");
  const claims = Buffer.from(
    JSON.stringify({
      iss: key.client_email,
      scope,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  ).toString("base64url");
  const unsigned = `${header}.${claims}`;
  const signature = createSign("RSA-SHA256")
    .update(unsigned)
    .sign(key.private_key)
    .toString("base64url");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`autenticazione Google fallita: ${JSON.stringify(data)}`);

  cachedTokens.set(scope, {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

export async function searchAnalytics({
  siteUrl,
  keyFile,
  startDate,
  endDate,
  dimensions,
  rowLimit = 25000,
}) {
  if (!keyFile) throw new Error("GOOGLE_SERVICE_ACCOUNT_FILE non impostata");
  const token = await getAccessToken(keyFile);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ startDate, endDate, dimensions, rowLimit }),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(`Search Console ${res.status}: ${JSON.stringify(data)}`);
  return data.rows ?? [];
}
