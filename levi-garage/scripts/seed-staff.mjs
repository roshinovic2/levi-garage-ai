// יוצר את משתמשי הצוות להדגמה, ואת שורות ה-staff שלהם.
// הרצה: node --env-file=.env.local scripts/seed-staff.mjs
//
// אידמפוטנטי: אפשר להריץ שוב ושוב. משתמש שכבר קיים לא נוצר מחדש, והשורה שלו מתעדכנת.
// הסיסמה להדגמה מגיעה מ-STAFF_DEMO_PASSWORD, ואם אין, נוצרת סיסמה אקראית שמודפסת פעם אחת.

import { randomBytes } from "node:crypto"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("חסר NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY")
  process.exit(1)
}

const password = process.env.STAFF_DEMO_PASSWORD || `Levi-${randomBytes(4).toString("hex")}!`

const TEAM = [
  { email: "daniel@levi-garage.demo", full_name: "דניאל לוי", role: "manager", lift: null, lang: "he" },
  { email: "avi@levi-garage.demo", full_name: "אבי לוי", role: "owner", lift: null, lang: "he" },
  { email: "samer@levi-garage.demo", full_name: "סאמר", role: "mechanic", lift: 2, lang: "ar" },
  { email: "alex@levi-garage.demo", full_name: "אלכס", role: "mechanic", lift: 3, lang: "ru" },
]

const admin = (path, init = {}) =>
  fetch(`${url}${path}`, {
    ...init,
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  })

async function findUser(email) {
  const res = await admin(`/auth/v1/admin/users?per_page=200`)
  if (!res.ok) throw new Error(`list users: ${res.status} ${await res.text()}`)
  const { users } = await res.json()
  return users.find((u) => u.email === email) || null
}

async function upsertUser(person) {
  const existing = await findUser(person.email)
  if (existing) {
    // מיישר את הסיסמה, כדי שההדגמה תמיד תעבוד עם מה שכתוב ב-README.
    const res = await admin(`/auth/v1/admin/users/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    })
    if (!res.ok) throw new Error(`update ${person.email}: ${res.status} ${await res.text()}`)
    return existing.id
  }
  const res = await admin(`/auth/v1/admin/users`, {
    method: "POST",
    body: JSON.stringify({ email: person.email, password, email_confirm: true }),
  })
  if (!res.ok) throw new Error(`create ${person.email}: ${res.status} ${await res.text()}`)
  return (await res.json()).id
}

async function upsertStaffRow(id, person) {
  const res = await admin(`/rest/v1/staff?on_conflict=id`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      id,
      full_name: person.full_name,
      role: person.role,
      lift: person.lift,
      lang: person.lang,
      active: true,
    }),
  })
  if (!res.ok) throw new Error(`staff row ${person.email}: ${res.status} ${await res.text()}`)
}

for (const person of TEAM) {
  const id = await upsertUser(person)
  await upsertStaffRow(id, person)
  console.log(`✓ ${person.full_name} (${person.role}${person.lift ? `, ליפט ${person.lift}` : ""}) - ${person.email}`)
}

console.log(
  process.env.STAFF_DEMO_PASSWORD
    ? "\nהסיסמה נלקחה מ-STAFF_DEMO_PASSWORD."
    : `\nסיסמה להדגמה (נוצרה עכשיו, שמור אותה): ${password}`
)
