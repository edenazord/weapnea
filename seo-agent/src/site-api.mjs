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

export const getBlogArticles = () => call("GET", "/api/blog?published=true");

export const getEvents = () => call("GET", "/api/events");

// Non blocca l'agente se il backend non e' raggiungibile.
export const logActivity = (kind, data, at) =>
  call("POST", "/api/admin/seo-agent/log", {
    kind,
    record_id: data.id,
    data,
    at,
  }).catch((err) => console.warn(`Registro remoto non aggiornato: ${err.message}`));
