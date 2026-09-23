// מחזיר את ההדגמה למצב פתיחה: יום עבודה עם שלושה תורים שממתינים, בלי כרטיסים פתוחים.
// הרצה לפני הצגה: node --env-file=.env.local scripts/reset-demo.mjs
//
// לא נוגע בצוות ובציים, ולא במה שאינו של ההדגמה.

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

// כרטיסי העבודה גוררים איתם ממצאים, אישורים וקבצים (on delete cascade).
const del = await api(`/rest/v1/job_cards?id=gt.0`, { method: "DELETE" })
console.log(del.ok ? "· כרטיסי העבודה נמחקו, יחד עם הממצאים והאישורים" : `✗ מחיקת כרטיסים: ${del.status}`)

const back = await api(`/rest/v1/bookings?cal_uid=like.demo-*`, {
  method: "PATCH",
  headers: { prefer: "return=representation" },
  body: JSON.stringify({ status: "booked" }),
})
const rows = back.ok ? await back.json() : []
console.log(back.ok ? `· ${rows.length} תורים חזרו למצב "ממתין"` : `✗ איפוס תורים: ${back.status}`)

console.log("\nעכשיו להריץ: node --env-file=.env.local scripts/seed-demo-day.mjs (כדי שהשעות יהיו של היום)")
