import { config } from "./config.mjs";

async function call(method, route, body) {
  const res = await fetch(`${config.apiBaseUrl}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiToken}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${route} -> ${res.status}: ${text}`);
  return JSON.parse(text);
}

export async function getSeoSettings() {
  const rows = await call("GET", "/api/admin/seo-settings");
  return new Map(rows.map((row) => [row.path, row]));
}

export function saveSeoSetting(setting) {
  return call("PUT", "/api/admin/seo-settings", setting);
}
