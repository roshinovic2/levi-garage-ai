// תור אחד להדגמת "הרכב מוכן", עם טלפון אמיתי של מי שהסכים לקבל את ההודעה.
//
// הרצה (מתוך levi-garage):
//   node --env-file=.env.local scripts/seed-demo-notice.mjs
//
// הטלפון נלקח מהמספר הראשון ב-GARAGE_NOTIFY_ALLOWED שבקובץ המקומי
// 03-rollout/solution-3-agent/.env.wiring.local, ולא מודפס. זו אותה רשימה
// שהבוט מכבד, ולכן אי אפשר ליצור כאן תור שההודעה שלו תגיע לזר.
// שם אופציונלי: DEMO_NAME באותו קובץ.
//
// אחרי ההרצה: דניאל רואה את התור בלוח היום, פותח כרטיס, ולוחץ "הרכב מוכן".
// הרצה חוזרת מוחקת את הכרטיס הקודם של התור הזה, כדי שאפשר יהיה להדגים שוב.

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const wiringFile = resolve(here, "../../03-rollout/solution-3-agent/.env.wiring.local")

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("חסר NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY")
  process.exit(1)
}

const local = new Map()
if (existsSync(wiringFile)) {
  for (const line of readFileSync(wiringFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) local.set(m[1], m[2].trim())
  }
}

const first = (local.get("GARAGE_NOTIFY_ALLOWED") || "").split(",")[0].replace(/\D/g, "")
if (!/^972\d{8,9}$/.test(first)) {
  console.error(`
✗ אין מספר תקין ב-GARAGE_NOTIFY_ALLOWED בקובץ:
  ${wiringFile}
  ספרות עם קידומת מדינה, למשל 9725XXXXXXXX. המספר הראשון ברשימה ישמש להדגמה.
`)
  process.exit(1)
}
// בטופס התור המספר נשמר כמו שהלקוח הקליד אותו, בפורמט מקומי.
const phone = `0${first.slice(3)}`

const api = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json", ...(init.headers || {}) },
  })

const UID = "demo-notice"

// כרטיס קודם של אותו תור נמחק, ואיתו גם רישום ההודעה (cascade).
const existing = await (await api(`/rest/v1/bookings?cal_uid=eq.${UID}&select=id`)).json()
if (existing[0]) await api(`/rest/v1/job_cards?booking_id=eq.${existing[0].id}`, { method: "DELETE" })

const res = await api(`/rest/v1/bookings?on_conflict=cal_uid`, {
  method: "POST",
  headers: { prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify({
    cal_uid: UID,
    status: "booked",
    drop_off_at: new Date(Date.now() - 20 * 60_000).toISOString(),
    customer_name: local.get("DEMO_NAME") || null,
    customer_phone: phone,
    whatsapp_consent: true,
    plate: "8215376",
    service: "טיפול תקופתי",
    notes: "תור להדגמת הודעת \"הרכב מוכן\"",
    vehicle_found: true,
    vehicle_make: "סקודה",
    vehicle_model: "FABIA",
    vehicle_year: 2012,
    engine_code: "CBZ",
    fuel: "בנזין",
  }),
})

if (!res.ok) {
  console.error("יצירת התור נכשלה:", res.status, await res.text())
  process.exit(1)
}

console.log(`✓ התור מוכן להדגמה (הטלפון לא מודפס).
  1. להתחבר כדניאל ולפתוח את "לוח היום"
  2. לפתוח כרטיס לסקודה FABIA
  3. בכרטיס: "הרכב מוכן" — ההודעה יוצאת לטלפון מהרשימה`)
