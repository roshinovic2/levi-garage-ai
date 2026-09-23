// שני ציים להדגמה, מהסוג שמתואר בפרסונה: אינסטלציה, הובלות, קבלנים ומשרדים.
// הרצה: node --env-file=.env.local scripts/seed-demo-fleets.mjs
// ניקוי: node --env-file=.env.local scripts/seed-demo-fleets.mjs --clean

import { randomBytes } from "node:crypto"

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

const FLEETS = [
  {
    name: 'משתלות הגליל בע"מ',
    contact_name: "יוסי אלקיים",
    contact_phone: "0500000003",
    vehicles: [
      { plate: "3921574", nickname: "המסחרית הגדולה" },
      { plate: "6620418", nickname: "הטנדר של הצוות" },
      { plate: "7104852", nickname: "רכב המשרד" },
    ],
  },
  {
    name: "אלמוג הובלות",
    contact_name: "שירן אלמוג",
    contact_phone: "0500000004",
    vehicles: [
      { plate: "8215376", nickname: "הפאביה של המשרד" },
      { plate: "5748301", nickname: "הטוסון" },
    ],
  },
]

if (process.argv.includes("--clean")) {
  const res = await api(`/rest/v1/fleets?name=in.(${FLEETS.map((f) => `"${f.name}"`).join(",")})`, { method: "DELETE" })
  console.log(res.ok ? "הציים להדגמה נמחקו" : `שגיאה ${res.status}`)
  process.exit(0)
}

for (const fleet of FLEETS) {
  // אין אילוץ ייחודיות על שם הצי, ולכן קודם מחפשים ורק אחר כך יוצרים.
  const existing = await (await api(`/rest/v1/fleets?name=eq.${encodeURIComponent(fleet.name)}&select=id,token`)).json()
  let row = existing[0]

  if (!row) {
    const res = await api(`/rest/v1/fleets`, {
      method: "POST",
      headers: { prefer: "return=representation" },
      body: JSON.stringify({
        name: fleet.name,
        contact_name: fleet.contact_name,
        contact_phone: fleet.contact_phone,
        token: randomBytes(18).toString("hex"),
        active: true,
      }),
    })
    if (!res.ok) {
      console.error(`נכשל ${fleet.name}:`, res.status, await res.text())
      continue
    }
    row = (await res.json())[0]
  }

  await addVehicles(row, fleet)
}

async function addVehicles(row, fleet) {
  const keys = ["fleet_id", "plate", "nickname", "active"]
  const rows = fleet.vehicles.map((v) => ({ fleet_id: row.id, plate: v.plate, nickname: v.nickname, active: true }))
  const res = await api(`/rest/v1/fleet_vehicles?on_conflict=plate`, {
    method: "POST",
    headers: { prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((r) => Object.fromEntries(keys.map((k) => [k, r[k]])))),
  })
  console.log(
    res.ok
      ? `✓ ${fleet.name} · ${fleet.vehicles.length} רכבים · קישור: /fleet/${row.token}`
      : `✗ ${fleet.name}: ${res.status} ${await res.text()}`,
  )
}
