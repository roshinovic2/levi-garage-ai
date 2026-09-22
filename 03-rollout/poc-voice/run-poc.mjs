// POC: הבנת הודעות קוליות של מכונאים בערבית מדוברת מעורבבת בעברית
// הרצה: node 03-rollout/poc-voice/run-poc.mjs [model]
// אימות: GEMINI_SA (Vertex) או GEMINI_API_KEY מ-levi-garage/.env.local. סודות לא מודפסים לעולם.
// ההקלטות עצמן (audio/) נשארות מקומיות, לא בגיט. נשמרות רק התוצאות.

import crypto from "node:crypto"
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, "../../levi-garage/.env.local")
const envText = fs.existsSync(envFile) ? fs.readFileSync(envFile, "utf8") : ""
const fromEnvFile = (name) => envText.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1].trim()

// שתי דרכים לגשת ל-Gemini:
// 1. Vertex AI (מועדף, משתמש בקרדיט של GCP): GEMINI_SA = נתיב לקובץ JSON של service account
// 2. AI Studio (גיבוי): GEMINI_API_KEY
const saPath = process.env.GEMINI_SA ?? fromEnvFile("GEMINI_SA")
const apiKey = fromEnvFile("GEMINI_API_KEY")
if (!saPath && !apiKey) throw new Error("set GEMINI_SA (service-account JSON path) or GEMINI_API_KEY")

// ראשון שזמין מנצח; אפשר לכפות מודל אחד מה-argv
const models = process.argv[2] ? [process.argv[2]] : saPath ? ["gemini-3-pro", "gemini-2.5-pro"] : ["gemini-3.8-flash"]

// טוקן OAuth מ-service account (JWT חתום, בלי ספריות חיצוניות)
let cached
async function vertexToken() {
  if (cached && cached.exp > Date.now() + 60_000) return cached.token
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
  if (!json.access_token) throw new Error(`token: ${json.error} ${json.error_description ?? ""}`)
  cached = { token: json.access_token, exp: Date.now() + json.expires_in * 1000, project: sa.project_id }
  return cached.token
}

async function endpoint(model) {
  if (!saPath) return { url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, headers: { "x-goog-api-key": apiKey } }
  const token = await vertexToken()
  return {
    url: `https://aiplatform.googleapis.com/v1/projects/${cached.project}/locations/global/publishers/google/models/${model}:generateContent`,
    headers: { Authorization: `Bearer ${token}` },
  }
}

// מפתח התשובות: מה נאמר בכל הקלטה, ומה חייב לצאת ממנה
const expected = [
  { id: "01", said: "בטוסון יש נזילה במשאבת המים. חייבים להחליף, אחרת המנוע יתחמם ויהרס. מקורי 800, חלופי 550. אם מאשרים עכשיו, מוכן היום ב-15:00", intent: "repair_report", mustInclude: ["800", "550"], redList: false },
  { id: "02", said: "המאזדה 3 שהגיעה לטיפול 30 אלף: הדיסקים והרפידות מקדימה גמורים. צריך להחליף הכול, בערך 1,050 כולל עבודה", intent: "repair_report", mustInclude: ["1050"], redList: false },
  { id: "03", said: "בקיה, הרצועה סדוקה. לא דחוף היום, אבל כדאי להחליף. 250 ₪. תשאלו את הלקוח (עם רעש רקע)", intent: "repair_report", mustInclude: ["250"], redList: false },
  { id: "04", said: "חיברתי סורק לפיג'ו 208, יש P0301. מה זה ומאיפה להתחיל לבדוק?", intent: "knowledge_question", mustInclude: ["P0301"], redList: false },
  { id: "05", said: "איפה פילטר המזגן בקיה פיקנטו 2019, ואיך מוציאים אותו?", intent: "knowledge_question", mustInclude: ["2019"], redList: false },
  { id: "06", said: "איזה שמן שמים בסקודה אוקטביה 1.4 טורבו, וכמה ליטר? (עם רעש רקע)", intent: "knowledge_question", mustInclude: ["1.4"], redList: false },
  { id: "07", said: "יש חוט שרוף ליד המחשב של הרכב. אני רוצה לחתוך אותו ולנתק את המחשב, בסדר?", intent: "red_list_action", mustInclude: [], redList: true },
  { id: "08", said: "הלקוח של הפולו אישר או לא? תגיד לי מהר, אני מחכה עם הגלגל בחוץ! (מהר, עם רעש)", intent: "status_question", mustInclude: [], redList: false },
]

const systemPrompt = `אתה שכבת ההבנה של עוזר הוואטסאפ של "מוסך לוי ובניו".
מכונאי שלח הודעה קולית, בדרך כלל בערבית מדוברת (ניב צפוני/פלסטיני) מעורבבת במונחי מוסך בעברית.
משימות:
1. תמלל בדיוק כפי שנאמר (ערבית בכתב ערבי, מילים עבריות בכתב עברי).
2. תרגם לעברית.
3. סווג את הכוונה:
   - repair_report: המכונאי מדווח על תקלה/תיקון שדורש אישור לקוח
   - knowledge_question: שאלה מקצועית (אבחון, איפה נמצא חלק, איזה שמן)
   - status_question: שאלה על מצב רכב/לקוח/אישור
   - red_list_action: הכוונה לבצע פעולה מסוכנת: חיתוך/גישור חוטים, ניתוק/תכנות מחשב רכב, כריות אוויר, מתח גבוה, פתיחת מערכת דלק, פריקת גז מזגן
   - other
4. חלץ רכב (יצרן/דגם/שנה), ממצא, אפשרויות עם מחירים בש"ח (מספרים בלבד), זמן מסירה ודחיפות.
5. אם intent=repair_report: נסח הודעת וואטסאפ קצרה וברורה בעברית ללקוח: מה נמצא, מה יקרה אם לא מתקנים (רק אם נאמר או מתבקש מההקשר), האפשרויות והמחירים כפי שנאמרו (אל תמציא מחיר, אל תוסיף מע"מ), זמן מסירה אם נאמר, ובסוף: "השיבו 1 לאישור, 2 לדחייה, 3 לשיחה עם המוסך". אחרת null.
6. red_list=true אם יש כוונה לפעולה מהרשימה האדומה.
7. דרג ביטחון 0–1, ורשום חלקים לא ברורים. אל תנחש: אם משהו לא נשמע, רשום אותו ב-unclear_parts.`

const schema = {
  type: "OBJECT",
  properties: {
    transcript_original: { type: "STRING" },
    translation_he: { type: "STRING" },
    intent: { type: "STRING", enum: ["repair_report", "knowledge_question", "status_question", "red_list_action", "other"] },
    vehicle: { type: "OBJECT", properties: { make: { type: "STRING", nullable: true }, model: { type: "STRING", nullable: true }, year: { type: "INTEGER", nullable: true } } },
    finding_he: { type: "STRING", nullable: true },
    options: { type: "ARRAY", items: { type: "OBJECT", properties: { label_he: { type: "STRING" }, price_ils: { type: "NUMBER", nullable: true } }, required: ["label_he"] } },
    ready_time: { type: "STRING", nullable: true },
    urgency: { type: "STRING", nullable: true, enum: ["urgent", "recommended", "not_urgent"] },
    customer_message_he: { type: "STRING", nullable: true },
    red_list: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    unclear_parts: { type: "ARRAY", items: { type: "STRING" } },
  },
  required: ["transcript_original", "translation_he", "intent", "red_list", "confidence", "options", "unclear_parts"],
}

async function analyze(file, model) {
  const audio = fs.readFileSync(file).toString("base64")
  const started = Date.now()
  const { url, headers } = await endpoint(model)
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/mp4", data: audio } }, { text: "נתח את ההודעה הקולית." }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
    }),
  })
  const json = await res.json()
  if (json.error) throw Object.assign(new Error(`${json.error.code} ${json.error.message}`), { code: json.error.code })
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("")
  if (!text) throw new Error(`empty response (${json.candidates?.[0]?.finishReason})`)
  return { result: JSON.parse(text), ms: Date.now() - started, tokens: json.usageMetadata }
}

// בוחר את המודל הראשון ברשימה שקיים בפרויקט (404 = לא זמין, עוברים לבא)
async function pickModel(firstFile) {
  for (const m of models) {
    try {
      return { model: m, first: await analyze(firstFile, m) }
    } catch (e) {
      if (e.code === 404 && m !== models.at(-1)) { console.log(`${m} unavailable, falling back`); continue }
      throw e
    }
  }
}

function grade(exp, r) {
  const blob = JSON.stringify(r).replace(/,/g, "")
  const checks = {
    intent: r.intent === exp.intent,
    redList: r.red_list === exp.redList,
    details: exp.mustInclude.every((s) => blob.includes(s)),
  }
  return { ...checks, pass: Object.values(checks).every(Boolean) }
}

const file = (id) => path.join(here, "audio", `${id}.m4a`)
const { model, first } = await pickModel(file(expected[0].id))
console.log(`model: ${model} via ${saPath ? "Vertex AI" : "AI Studio"}`)

const out = []
for (const exp of expected) {
  try {
    const { result, ms, tokens } = exp === expected[0] ? first : await analyze(file(exp.id), model)
    const g = grade(exp, result)
    out.push({ id: exp.id, expected: exp, result, grade: g, ms, tokens })
    console.log(`${exp.id}  ${g.pass ? "PASS" : "FAIL"}  intent=${result.intent} red=${result.red_list} conf=${result.confidence} ${ms}ms`)
  } catch (e) {
    out.push({ id: exp.id, expected: exp, error: String(e) })
    console.log(`${exp.id}  ERROR  ${e}`)
  }
}

const outFile = path.join(here, `results-${model}.json`)
fs.writeFileSync(outFile, JSON.stringify({ model, via: saPath ? "vertex" : "ai-studio", ranAt: new Date().toISOString(), results: out }, null, 2))
const passed = out.filter((o) => o.grade?.pass).length
console.log(`
${model}: ${passed}/${out.length} passed -> ${path.basename(outFile)}`)
