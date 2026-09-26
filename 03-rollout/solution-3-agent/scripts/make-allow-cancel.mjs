// מעדכן את המסנן בתרחיש קליטת התורים ב-Make, כך שגם ביטול יעבור.
//
//   node 03-rollout/solution-3-agent/scripts/make-allow-cancel.mjs
//
// למה סקריפט ולא ממשק: התרחיש מכיל את הסיסמה הפנימית של intake_booking.
// הסקריפט קורא את התרחיש, משנה רק את המסנן, ושומר — **בלי להדפיס את
// התרחיש או את הסיסמה**. מה שמודפס: המסנן לפני ואחרי, ותו לא.
//
// דורש MAKE_API_TOKEN בקובץ .env.wiring.local (הרשאות scenarios:read,
// scenarios:write). אחרי ההרצה אפשר למחוק את המפתח ב-Make.

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const localFile = resolve(here, "../.env.wiring.local")
const local = new Map()
if (existsSync(localFile)) {
  for (const line of readFileSync(localFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) local.set(m[1], m[2].trim())
  }
}

const token = local.get("MAKE_API_TOKEN")
if (!token) {
  console.error(`✗ חסר MAKE_API_TOKEN ב-${localFile}`)
  process.exit(1)
}

const ZONE = "https://eu1.make.com/api/v2"
const SCENARIO = 7538765 // "מוסך לוי — תור חדש (Cal.com ← משרד התחבורה)"
const OLD_NAME = "רק תור חדש עם מספר רישוי"
const NEW_NAME = "תור חדש או שינוי מועד (עם מספר רישוי), או ביטול"

const headers = { authorization: `Token ${token}`, "content-type": "application/json" }

const got = await fetch(`${ZONE}/scenarios/${SCENARIO}/blueprint`, { headers })
if (!got.ok) {
  console.error("✗ קריאת התרחיש נכשלה:", got.status)
  process.exit(1)
}
const json = await got.json()
const blueprint = json?.response?.blueprint ?? json?.blueprint
if (!blueprint?.flow) {
  console.error("✗ לא נמצא blueprint בתשובה")
  process.exit(1)
}

// המודול הראשון אחרי ה-Webhook נושא את המסנן.
const mod = blueprint.flow.find((m) => m?.filter?.name === OLD_NAME || m?.filter?.name === NEW_NAME)
if (!mod) {
  console.error("✗ לא נמצא המסנן בתרחיש. אולי כבר שונה ביד?")
  process.exit(1)
}

const show = (f) => (f?.conditions ?? []).map((group) => group.map((c) => `${c.a} ${c.o}${c.b ? ` ${c.b}` : ""}`).join(" וגם ")).join("\n   או: ")
console.log(`מודול ${mod.id} (${mod.module}) — לפני:\n   ${show(mod.filter)}`)

// שינוי שני (26.9): שאילתת משרד התחבורה לא עוצרת את התרחיש כשהיא נכשלת.
// ביטול מגיע בלי מספר רישוי, השאילתה נכשלה, ו-Make עצר לפני השמירה — ובאותה
// דרך, תקלה במאגר הממשלתי בזמן תור חדש הייתה מאבדת את התור כולו. עכשיו התור
// נשמר בלי פרטי רכב, והביטול עובר.
const filterDone = mod.filter.name === NEW_NAME
const tolerantDone = mod.mapper?.stopOnHttpError === false
console.log(`עצירה על שגיאה בשאילתה: ${tolerantDone ? "כבויה" : "דלוקה"}`)

if (filterDone && tolerantDone) {
  console.log("\n✓ שני השינויים כבר קיימים. לא נגעתי בכלום.")
  process.exit(0)
}

if (!filterDone) {
  mod.filter = {
    name: NEW_NAME,
    conditions: [
      [{ a: "{{1.payload.responses.plate.value}}", o: "exist" }],
      [{ a: "{{1.triggerEvent}}", o: "text:equal", b: "BOOKING_CANCELLED" }],
    ],
  }
}
mod.mapper = { ...mod.mapper, stopOnHttpError: false }
console.log(`\nאחרי:\n   ${show(mod.filter)}\nעצירה על שגיאה בשאילתה: כבויה`)

const put = await fetch(`${ZONE}/scenarios/${SCENARIO}`, {
  method: "PATCH",
  headers,
  body: JSON.stringify({ blueprint: JSON.stringify(blueprint) }),
})
if (!put.ok) {
  console.error("\n✗ השמירה נכשלה:", put.status, (await put.text()).slice(0, 200))
  process.exit(1)
}
console.log("\n✓ נשמר. תור חדש ושינוי מועד עוברים כמו קודם, וביטול עובר גם בלי מספר רישוי.")
