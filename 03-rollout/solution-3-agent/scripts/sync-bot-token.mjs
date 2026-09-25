// מעביר את GARAGE_BOT_TOKEN מהקובץ המקומי אל המסד (private.settings), כדי
// שהמסד יוכל לזהות לקוח לפי המזהה האטום שהבוט שולח (sql/003).
//
//   node --env-file=levi-garage/.env.local 03-rollout/solution-3-agent/scripts/sync-bot-token.mjs
//
// **הערך לא מודפס.** הוא נקרא מ-.env.wiring.local ונשלח לפונקציה שרק
// service_role יכול להריץ. להריץ שוב בכל פעם שהטוקן מתחלף.

import { existsSync, readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const localFile = resolve(here, "../.env.wiring.local")

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const secret = process.env.SUPABASE_SECRET_KEY
if (!url || !secret) {
  console.error("חסר NEXT_PUBLIC_SUPABASE_URL או SUPABASE_SECRET_KEY (להריץ עם --env-file=levi-garage/.env.local)")
  process.exit(1)
}

const local = new Map()
if (existsSync(localFile)) {
  for (const line of readFileSync(localFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) local.set(m[1], m[2].trim())
  }
}
const token = local.get("GARAGE_BOT_TOKEN")
if (!token) {
  console.error(`חסר GARAGE_BOT_TOKEN ב-${localFile}. קודם: node 03-rollout/solution-3-agent/scripts/wire-garage.mjs site`)
  process.exit(1)
}

const res = await fetch(`${url}/rest/v1/rpc/set_garage_bot_token`, {
  method: "POST",
  headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": "application/json" },
  body: JSON.stringify({ p_token: token }),
})
if (!res.ok) {
  console.error("✗ העדכון נכשל:", res.status, await res.text())
  process.exit(1)
}
console.log("✓ הטוקן עודכן במסד (לא מודפס)")
