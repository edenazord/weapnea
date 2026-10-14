import { config } from "./config.mjs";

export async function chatJson({ system, user }) {
  const res = await fetch(`${config.deepseekBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.deepseekApiKey}`,
    },
    body: JSON.stringify({
      model: config.deepseekModel,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  const text = await res.text();
  if (!res.ok) throw new Error(`DeepSeek ${res.status}: ${text}`);
  const content = JSON.parse(text).choices?.[0]?.message?.content;
  if (!content) throw new Error("DeepSeek: risposta vuota");
  return JSON.parse(content);
}
