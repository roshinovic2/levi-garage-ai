// יצירת תמונות לאתר עם Gemini (Nano Banana Pro) דרך Vertex AI
// הרצה: node scripts/gen-image.mjs <out.png> <aspect 16:9|4:5|1:1...> "<prompt>" [model]
// אימות: GEMINI_SA (נתיב ל-JSON של service account) מ-.env.local או מהסביבה. סודות לא מודפסים.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const envText = fs.readFileSync(path.join(here, "../.env.local"), "utf8")
const saPath = process.env.GEMINI_SA ?? envText.match(/^GEMINI_SA=(.*)$/m)?.[1].trim()
if (!saPath) throw new Error("GEMINI_SA missing")

const [out, aspect, prompt, modelArg] = process.argv.slice(2)
if (!out || !aspect || !prompt) throw new Error('usage: gen-image.mjs out.png 16:9 "prompt" [model]')
const models = modelArg ? [modelArg] : ["gemini-3-pro-image-preview", "gemini-3-pro-image", "gemini-2.5-flash-image"]

async function token() {
  const sa = JSON.parse(fs.readFileSync(saPath, "utf8"))
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url")
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  })}`
  const sig = crypto.createSign("RSA-SHA256").update(unsigned).sign(sa.private_key, "base64url")
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${sig}` }),
  })
  const json = await res.json()
  if (!json.access_token) throw new Error(`token: ${json.error}`)
  return { token: json.access_token, project: sa.project_id }
}

const { token: t, project } = await token()
for (const model of models) {
  const res = await fetch(`https://aiplatform.googleapis.com/v1/projects/${project}/locations/global/publishers/google/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } },
    }),
  })
  const json = await res.json()
  if (json.error) {
    console.log(`${model}: ${json.error.code} ${json.error.message.slice(0, 120)}`)
    if (json.error.code === 404 && model !== models.at(-1)) continue
    process.exit(1)
  }
  const img = json.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)?.inlineData
  if (!img) { console.log(`${model}: no image (${json.candidates?.[0]?.finishReason})`); process.exit(1) }
  fs.writeFileSync(out, Buffer.from(img.data, "base64"))
  console.log(`${model}: saved ${out}`)
  break
}
