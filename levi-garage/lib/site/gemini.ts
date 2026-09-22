import "server-only"

import crypto from "node:crypto"
import fs from "node:fs"

// Gemini דרך Vertex AI עם service account, כדי שהחיוב יירד מהקרדיט של GCP.
// מקור המפתח: GEMINI_SA_JSON (תוכן ה-JSON, ל-Vercel) או GEMINI_SA (נתיב לקובץ, לפיתוח מקומי).

type ServiceAccount = { client_email: string; private_key: string; project_id: string }

let cached: { token: string; exp: number; project: string } | null = null

function loadServiceAccount(): ServiceAccount {
  const inline = process.env.GEMINI_SA_JSON
  if (inline) return JSON.parse(inline)
  const path = process.env.GEMINI_SA
  if (path) return JSON.parse(fs.readFileSync(path, "utf8"))
  throw new Error("Gemini is not configured (GEMINI_SA_JSON or GEMINI_SA)")
}

async function accessToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached
  const sa = loadServiceAccount()
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error("Gemini auth failed")
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000, project: sa.project_id }
  return cached
}

export async function generateJson<T>(opts: {
  model?: string
  system: string
  contents: { role: "user" | "model"; text: string }[]
  schema: object
  temperature?: number
}): Promise<T> {
  const { token, project } = await accessToken()
  const model = opts.model ?? "gemini-2.5-flash"
  const res = await fetch(
    `https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: opts.system }] },
        contents: opts.contents.map((c) => ({ role: c.role, parts: [{ text: c.text }] })),
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: opts.temperature ?? 0.2,
          maxOutputTokens: 800,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )
  const json = await res.json()
  if (json.error) throw new Error(`Gemini ${json.error.code}`)
  const text = json.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("")
  if (!text) throw new Error("Gemini empty response")
  return JSON.parse(text) as T
}
