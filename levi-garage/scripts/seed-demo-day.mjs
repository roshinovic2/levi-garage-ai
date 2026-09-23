// יום עבודה להדגמה: כמה תורים לבוקר של היום, כדי שלוח הצוות לא יהיה ריק.
// הרצה: node --env-file=.env.local scripts/seed-demo-day.mjs
// ניקוי: node --env-file=.env.local scripts/seed-demo-day.mjs --clean
//
// כל השורות מסומנות ב-cal_uid שמתחיל ב-demo-, כדי שאפשר יהיה למחוק אותן בפקודה אחת
// ולא לבלבל אותן עם תורים אמיתיים שמגיעים מ-Cal.com.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("חסר NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY")
  process.exit(1)
}

const api = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json", ...(init.headers || {}) },
  })

if (process.argv.includes("--clean")) {
  for (const table of ["job_cards", "bookings"]) {
    const filter = table === "bookings" ? "cal_uid=like.demo-*" : "notes=like.הדגמה*"
    const res = await api(`/rest/v1/${table}?${filter}`, { method: "DELETE" })
    console.log(`${table}: ${res.ok ? "נוקה" : `שגיאה ${res.status}`}`)
  }
  process.exit(0)
}

const at = (hour, minute) => {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const DAY = [
  {
    cal_uid: "demo-day-1",
    plate: "8215376",
    customer_name: "רונית ברק",
    customer_phone: "0500000001",
    whatsapp_consent: true,
    service: "טיפול תקופתי",
    drop_off_at: at(7, 15),
    vehicle_found: true,
    vehicle_make: "סקודה צ'כיה",
    vehicle_model: "FABIA",
    vehicle_year: 2012,
    engine_code: "CBZ",
    fuel: "בנזין",
    tires: "185/60 R14",
    test_valid_until: "2026-12-31",
  },
  {
    cal_uid: "demo-day-2",
    plate: "5748301",
    customer_name: "עומר כהן",
    customer_phone: "0500000002",
    whatsapp_consent: true,
    service: "הכנה וליווי לטסט",
    drop_off_at: at(7, 45),
    vehicle_found: true,
    vehicle_make: "יונדאי",
    vehicle_model: "TUCSON",
    vehicle_year: 2017,
    engine_code: "G4NA",
    fuel: "בנזין",
  },
  {
    cal_uid: "demo-day-3",
    plate: "3921574",
    customer_name: "משתלות הגליל בע\"מ",
    customer_phone: "0500000003",
    whatsapp_consent: false,
    service: "טיפול תקופתי",
    drop_off_at: at(8, 30),
    vehicle_found: true,
    vehicle_make: "רנו",
    vehicle_model: "MASTER",
    vehicle_year: 2019,
    fuel: "דיזל",
  },
]

// PostgREST דורש שלכל האובייקטים בהכנסה מרובה יהיו אותם מפתחות בדיוק.
const keys = [...new Set(DAY.flatMap(Object.keys))]
const rows = DAY.map((b) => {
  const row = { status: "booked" }
  for (const k of keys) row[k] = b[k] ?? null
  return row
})

const res = await api(`/rest/v1/bookings?on_conflict=cal_uid`, {
  method: "POST",
  headers: { prefer: "resolution=merge-duplicates,return=representation" },
  body: JSON.stringify(rows),
})

if (!res.ok) {
  console.error("נכשל:", res.status, await res.text())
  process.exit(1)
}

for (const b of await res.json()) {
  console.log(`✓ ${b.plate} · ${b.customer_name} · ${new Date(b.drop_off_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`)
}
