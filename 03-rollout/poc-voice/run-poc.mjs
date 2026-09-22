// POC: הבנת הודעות קוליות של מכונאים בערבית מדוברת מעורבבת בעברית
// הרצה: node 03-rollout/poc-voice/run-poc.mjs [model]
// המפתח נטען מ-levi-garage/.env.local (GEMINI_API_KEY) ולא מודפס לעולם.
// ההקלטות עצמן (audio/) נשארות מקומיות, לא בגיט. נשמרות רק התוצאות.

import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const envFile = path.join(here, "../../levi-garage/.env.local")
const apiKey = fs.readFileSync(envFile, "utf8").match(/^GEMINI_API_KEY=(.*)$/m)?.[1].trim()
if (!apiKey) throw new Error("GEMINI_API_KEY missing in levi-garage/.env.local")

const model = process.argv[2] ?? "gemini-3.8-flash"

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

async function analyze(file) {
  const audio = fs.readFileSync(file).toString("base64")
  const started = Date.now()
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ inlineData: { mimeType: "audio/mp4", data: audio } }, { text: "נתח את ההודעה הקולית." }] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 },
    }),
  })
  const json = await res.json()
  if (json.error) throw new Error(`${json.error.code} ${json.error.message}`)
  return {
    result: JSON.parse(json.candidates[0].content.parts[0].text),
    ms: Date.now() - started,
    tokens: json.usageMetadata,
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

const out = []
for (const exp of expected) {
  const file = path.join(here, "audio", `${exp.id}.m4a`)
  try {
    const { result, ms, tokens } = await analyze(file)
    const g = grade(exp, result)
    out.push({ id: exp.id, expected: exp, result, grade: g, ms, tokens })
    console.log(`${exp.id}  ${g.pass ? "PASS" : "FAIL"}  intent=${result.intent} red=${result.red_list} conf=${result.confidence} ${ms}ms`)
  } catch (e) {
    out.push({ id: exp.id, expected: exp, error: String(e) })
    console.log(`${exp.id}  ERROR  ${e}`)
  }
}

const outFile = path.join(here, `results-${model}.json`)
fs.writeFileSync(outFile, JSON.stringify({ model, ranAt: new Date().toISOString(), results: out }, null, 2))
const passed = out.filter((o) => o.grade?.pass).length
console.log(`\n${model}: ${passed}/${out.length} passed -> ${path.basename(outFile)}`)
