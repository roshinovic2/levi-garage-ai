// בודק את התזכורות של מחר בצד המסד (sql/004): מי נתפס, פעם אחת בלבד, ומי לא.
//
//   node --env-file=levi-garage/.env.local 03-rollout/solution-3-agent/test/reminders.mjs
//
// שום הודעה לא נשלחת כאן: הבדיקה רק תופסת ורושמת, וקוראת את השורות בחזרה.
// בסוף היא מוחקת כל שורת תזכורת שנוצרה בזמן ההרצה, גם של תורים מנתוני הדמו.

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

const service = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json", prefer: "return=representation", ...(init.headers || {}) },
  })

const rpc = async (name, args, key = anonKey) => {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(args),
  })
  const text = await res.text()
  return { status: res.status, body: text ? JSON.parse(text) : null }
}

// מחר ומחרתיים ב-07:30, לפי **לוח השנה של ישראל**. חישוב לפי UTC נכשל אחרי
// חצות: "מחר ב-UTC" הוא עדיין היום בישראל.
const ymdIL = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" })
const inDays = (n) => {
  const ymd = ymdIL.format(new Date(Date.now() + n * 24 * 60 * 60 * 1000))
  return new Date(`${ymd}T07:30:00+03:00`).toISOString()
}

const started = new Date(Date.now() - 1000).toISOString()
const created = []
async function booking(uid, fields) {
  const [row] = await (
    await service(`/rest/v1/bookings`, {
      method: "POST",
      body: JSON.stringify({ cal_uid: uid, status: "booked", plate: "8215376", customer_phone: "050-0000000", whatsapp_consent: true, ...fields }),
    })
  ).json()
  created.push(row.id)
  return row
}
const idsOf = (list) => (Array.isArray(list) ? list.map((c) => c.id) : [])
const noticeFor = async (bookingId) =>
  (await (await service(`/rest/v1/customer_notices?booking_id=eq.${bookingId}&kind=eq.reminder&select=*`)).json())[0] ?? null

try {
  const due = await booking("test-rem-due", { drop_off_at: inDays(1), customer_name: "דנה כהן" })
  const noConsent = await booking("test-rem-noconsent", { drop_off_at: inDays(1), whatsapp_consent: false })
  const noPhone = await booking("test-rem-nophone", { drop_off_at: inDays(1), customer_phone: " " })
  const cancelled = await booking("test-rem-cancelled", { drop_off_at: inDays(1), status: "cancelled" })
  const later = await booking("test-rem-later", { drop_off_at: inDays(2) })

  let r = await rpc("claim_due_reminders", { p_secret: "guess" })
  ok("בלי הטוקן הנכון: נחסם", r.status >= 400)
  ok("…ולא נתפס כלום", (await noticeFor(due.id)) === null)

  r = await rpc("claim_due_reminders", { p_secret: TOKEN })
  const claimed = r.body ?? []
  const mine = claimed.find((c) => c.uid === "test-rem-due")
  ok("תור של מחר, עם הסכמה וטלפון: נתפס", Boolean(mine) && mine.send === true)
  ok("…עם השעה ומזהה התור ב-Cal.com, כדי שהבוט יבנה קישור לביטול", mine?.at && mine?.uid === "test-rem-due")
  ok("בלי הסכמה: לא נתפס", !claimed.some((c) => c.uid === "test-rem-noconsent"))
  ok("בלי טלפון: לא נתפס", !claimed.some((c) => c.uid === "test-rem-nophone"))
  ok("תור שבוטל: לא נתפס", !claimed.some((c) => c.uid === "test-rem-cancelled"))
  ok("תור של מחרתיים: עוד לא", !claimed.some((c) => c.uid === "test-rem-later"))

  r = await rpc("claim_due_reminders", { p_secret: TOKEN })
  ok("הרצה שנייה מיד אחרי: אף אחד לא נתפס פעמיים", !idsOf(r.body).includes(mine?.id))

  await rpc("finish_reminder", { p_secret: TOKEN, p_id: mine.id, p_status: "failed", p_reason: "unreachable" })
  ok("כישלון נרשם עם הסיבה", (await noticeFor(due.id))?.reason === "unreachable")
  r = await rpc("claim_due_reminders", { p_secret: TOKEN })
  ok("תזכורת שנכשלה נתפסת שוב בהרצה הבאה", idsOf(r.body).includes(mine.id))

  await rpc("finish_reminder", { p_secret: TOKEN, p_id: mine.id, p_status: "sent" })
  const n = await noticeFor(due.id)
  ok("נשלחה: נרשם, עם שעה", n?.status === "sent" && n?.sent_at !== null)
  r = await rpc("claim_due_reminders", { p_secret: TOKEN })
  ok("אחרי שנשלחה: לא נתפסת שוב", !idsOf(r.body).includes(mine.id))

  r = await rpc("finish_reminder", { p_secret: "guess", p_id: mine.id, p_status: "failed" })
  ok("בלי הטוקן אי אפשר לשנות תוצאה", r.status >= 400 && (await noticeFor(due.id))?.status === "sent")

  // finish_reminder נוגעת רק בתזכורות. שורה של "הרכב מוכן" נשארת כמו שהיא.
  const [job] = await (await service(`/rest/v1/job_cards`, { method: "POST", body: JSON.stringify({ plate: "9999997", status: "ready", notes: "בדיקת תזכורות" }) })).json()
  const [ready] = await (await service(`/rest/v1/customer_notices`, { method: "POST", body: JSON.stringify({ job_card_id: job.id, kind: "ready", status: "pending" }) })).json()
  await rpc("finish_reminder", { p_secret: TOKEN, p_id: ready.id, p_status: "sent" })
  const after = (await (await service(`/rest/v1/customer_notices?id=eq.${ready.id}&select=status`)).json())[0]
  ok("הדלת של התזכורות לא יכולה לסמן הודעה אחרת כנשלחה", after?.status === "pending")
  await service(`/rest/v1/job_cards?id=eq.${job.id}`, { method: "DELETE" })

  void noConsent, noPhone, cancelled, later
} finally {
  // כל שורת תזכורת שנוצרה בהרצה, כולל של תורי דמו של מחר, ואז התורים של הבדיקה.
  await service(`/rest/v1/customer_notices?kind=eq.reminder&created_at=gte.${encodeURIComponent(started)}`, { method: "DELETE" })
  for (const id of created) await service(`/rest/v1/bookings?id=eq.${id}`, { method: "DELETE" })
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
