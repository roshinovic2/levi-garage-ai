// בודק את garage_customer (sql/003): המסד מזהה לקוח לפי המזהה האטום של הבוט,
// ומחזיר רק את הרכבים שלו.
//
//   node --env-file=levi-garage/.env.local 03-rollout/solution-3-agent/test/customer-context.mjs
//
// המזהה מחושב כאן **בדיוק כמו בבוט** (clientId ב-lib/garage.js במאגר הבוט):
// 'wa-' ועוד 16 תווי hex ראשונים של HMAC-SHA256 על המספר בפורמט 972...
// אם המסד מחשב אחרת, הבדיקה הראשונה נופלת.

import { createHmac } from "node:crypto"
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const wiring = Object.fromEntries(
  readFileSync(resolve(here, "../.env.wiring.local"), "utf8")
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].trim()]),
)
const TOKEN = wiring.GARAGE_BOT_TOKEN

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const secret = process.env.SUPABASE_SECRET_KEY

let pass = 0
let fail = 0
const ok = (name, cond, extra = "") => {
  if (cond) {
    pass++
    console.log(`PASS  ${name}`)
  } else {
    fail++
    console.log(`FAIL  ${name}${extra ? ` — ${extra}` : ""}`)
  }
}

// כמו בבוט, מילה במילה.
const clientId = (number) => `wa-${createHmac("sha256", TOKEN).update(String(number)).digest("hex").slice(0, 16)}`

const service = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers || {}) },
  })

const ask = async (secretValue, client) => {
  const res = await fetch(`${url}/rest/v1/rpc/garage_customer`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
    body: JSON.stringify({ p_secret: secretValue, p_client: client }),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

// מספרים בדויים מפורשים. שום דבר כאן לא שולח הודעה.
const ME = "972500000000" // כך הבוט רואה את השולח
const OTHER = "972500000009"
const day = 24 * 60 * 60 * 1000
const created = { jobs: [], bookings: [] }

async function booking(fields) {
  const [row] = await (await service(`/rest/v1/bookings`, { method: "POST", body: JSON.stringify({ status: "booked", plate: "8215376", ...fields }) })).json()
  created.bookings.push(row.id)
  return row
}
async function job(fields) {
  const [row] = await (await service(`/rest/v1/job_cards`, { method: "POST", body: JSON.stringify({ plate: "8215376", notes: "בדיקת זיהוי לקוח", ...fields }) })).json()
  created.jobs.push(row.id)
  return row
}

try {
  // התור נקבע עם מקפים, והבוט רואה 972...: אותו אדם.
  await booking({ cal_uid: "test-ctx-mine", drop_off_at: new Date(Date.now() + 2 * day).toISOString(), customer_name: "דנה כהן", customer_phone: "050-0000000", vehicle_make: "סקודה", vehicle_model: "FABIA" })
  await job({ status: "waiting_approval", customer_name: "דנה כהן", customer_phone: "+972 50-000-0000", vehicle_make: "מאזדה", vehicle_model: "3", plate: "74815302" })
  await booking({ cal_uid: "test-ctx-other", drop_off_at: new Date(Date.now() + 2 * day).toISOString(), customer_name: "יוסי", customer_phone: "050-0000009" })
  await booking({ cal_uid: "test-ctx-cancelled", status: "cancelled", drop_off_at: new Date(Date.now() + 3 * day).toISOString(), customer_phone: "050-0000000" })
  await job({ status: "delivered", delivered_at: new Date(Date.now() - 3 * day).toISOString(), customer_phone: "050-0000000" })

  let r = await ask(TOKEN, clientId(ME))
  const kinds = (r.body ?? []).map((x) => `${x.kind}:${x.status}`).sort()
  ok("המזהה שהבוט מחשב תואם למסד: שני הרכבים של השולח חוזרים", r.status === 200 && kinds.join(",") === "booking:booked,job:waiting_approval", JSON.stringify(kinds))
  ok("…עם שם פרטי בלבד", (r.body ?? []).every((x) => x.name === "דנה"))
  ok("…ושלוש ספרות מהלוחית, לא יותר", (r.body ?? []).every((x) => /^\d{3}$/.test(x.plate_tail)))
  ok("…ובלי טלפון בכלל", !JSON.stringify(r.body).includes("0000000") && !JSON.stringify(r.body).includes("phone"))
  ok("תור שבוטל וכרטיס שנמסר לפני שלושה ימים לא חוזרים", (r.body ?? []).length === 2)

  r = await ask(TOKEN, clientId(OTHER))
  ok("שולח אחר רואה רק את התור שלו", r.body?.length === 1 && r.body[0].name === "יוסי")

  r = await ask(TOKEN, clientId("972599999998"))
  ok("מי שאין לו תור ולא כרטיס: רשימה ריקה", Array.isArray(r.body) && r.body.length === 0)

  r = await ask(TOKEN, "wa-not-a-real-id")
  ok("מזהה בצורה לא נכונה: רשימה ריקה, לא שגיאה", r.status === 200 && Array.isArray(r.body) && r.body.length === 0)

  r = await ask("guess", clientId(ME))
  ok("בלי הטוקן הנכון: נחסם", r.status >= 400 && !Array.isArray(r.body))

  r = await ask(null, clientId(ME))
  ok("בלי טוקן בכלל: נחסם", r.status >= 400)

  const direct = await fetch(`${url}/rest/v1/rpc/set_garage_bot_token`, {
    method: "POST",
    headers: { apikey: anonKey, authorization: `Bearer ${anonKey}`, "content-type": "application/json" },
    body: JSON.stringify({ p_token: "x".repeat(40) }),
  })
  ok("מבחוץ אי אפשר להחליף את הטוקן", direct.status >= 400)
  r = await ask(TOKEN, clientId(ME))
  ok("…והטוקן הנכון עדיין עובד", r.body?.length === 2)
} finally {
  if (!process.env.KEEP_TEST_ROWS) {
    for (const id of created.jobs) await service(`/rest/v1/job_cards?id=eq.${id}`, { method: "DELETE" })
    for (const id of created.bookings) await service(`/rest/v1/bookings?id=eq.${id}`, { method: "DELETE" })
  }
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
