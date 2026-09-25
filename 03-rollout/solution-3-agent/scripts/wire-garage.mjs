// מחבר את בוט הוואטסאפ לאתר המוסך: מגדיר את משתני הסביבה בשני הפרויקטים
// ב-Vercel, בפקודה אחת לכל צד.
//
//   node 03-rollout/solution-3-agent/scripts/wire-garage.mjs site
//   node 03-rollout/solution-3-agent/scripts/wire-garage.mjs bot
//
// **שום ערך לא מודפס ולא נכנס לריפו.** מה שסודי נקרא מקובץ מקומי
// (.env.wiring.local, שכבר ב-gitignore), ונשלח ל-Vercel דרך stdin ולא
// כארגומנט — ארגומנטים נראים ברשימת התהליכים של המערכת.
//
// מה שצריך לפני ההרצה: להיות מחובר ל-Vercel (`npx vercel login`, או
// VERCEL_TOKEN במשתני הסביבה), ושכל תיקייה תהיה מקושרת לפרויקט שלה
// (`npx vercel link`).

import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import { existsSync, readFileSync, appendFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const repo = resolve(here, "../../..")
const localFile = resolve(here, "../.env.wiring.local")

const target = process.argv[2]
if (!["site", "bot"].includes(target)) {
  console.error("שימוש: node wire-garage.mjs site|bot")
  process.exit(1)
}

// ---------- מה סודי, ומה לא ----------
//
// GARAGE_PHONE הוא הטלפון **הבדוי** של המוסך, ולכן הוא כתוב כאן בגלוי:
// הבוט מציג אותו ללקוחות, והעסק מדומה. המספר האמיתי היחיד בכל המערך הוא
// NEXT_PUBLIC_WHATSAPP_NUMBER, כי אליו הוואטסאפ באמת מגיע — והוא לא נכתב
// בשום קובץ בריפו.
const PUBLIC = {
  GARAGE_BOOKING_URL: "https://cal.com/levi-garage/drop-off",
  GARAGE_PHONE: "04-0000000",
}

const local = new Map()
if (existsSync(localFile)) {
  for (const line of readFileSync(localFile, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/)
    if (m) local.set(m[1], m[2].trim())
  }
}

function need(name, hint) {
  const v = local.get(name)
  if (!v) {
    console.error(`\n✗ חסר ${name} בקובץ:\n  ${localFile}\n  ${hint}\n`)
    process.exit(1)
  }
  return v
}

// קודם מוודאים שיש את כל מה שצריך, ורק אחר כך מייצרים טוקן. אחרת הרצה
// שנכשלת על ערך חסר הייתה משאירה אחריה קובץ עם טוקן שלא שימש לכלום.
const siteUrl = need("SITE_URL", 'למשל: SITE_URL=https://levi-garage.vercel.app  (בלי "/" בסוף)')

const waNumber =
  target === "site"
    ? need(
        "NEXT_PUBLIC_WHATSAPP_NUMBER",
        "המספר שאליו הוואטסאפ באמת מגיע, ספרות בלבד עם קידומת מדינה. למשל: 9725XXXXXXXX",
      )
    : null

const botDir = target === "bot" ? need("BOT_DIR", String.raw`הנתיב למאגר של הבוט. למשל: BOT_DIR=C:\projects\Personal-Bot`) : null

// גם הקישור נבדק לפני שנוצר טוקן. Vercel CLI מגרסה 54 כותב repo.json
// לפרויקט שמחובר לגיט, ו-project.json לפרויקט שלא. שניהם תקינים.
const dir = target === "site" ? resolve(repo, "levi-garage") : botDir
const linked = [".vercel/project.json", ".vercel/repo.json"].some((f) => existsSync(resolve(dir, f)))
if (!linked) {
  console.error(`
✗ התיקייה לא מקושרת לפרויקט ב-Vercel:
  ${dir}
  להריץ שם: npx vercel link
`)
  process.exit(1)
}

// הטוקן חייב להיות **זהה** בשני הצדדים: הבוט שולח אותו בכותרת, והאתר משווה.
// הוא נוצר פעם אחת ונשמר מקומית, כדי שההרצה השנייה תשתמש באותו ערך.
let token = local.get("GARAGE_BOT_TOKEN")
if (!token) {
  token = randomBytes(24).toString("hex")
  appendFileSync(localFile, `${existsSync(localFile) ? "\n" : ""}GARAGE_BOT_TOKEN=${token}\n`, "utf8")
  console.log("· נוצר GARAGE_BOT_TOKEN חדש ונשמר מקומית (לא מודפס, לא בריפו)")
}

const plan =
  target === "site"
    ? {
        dir,
        vars: { GARAGE_BOT_TOKEN: token, NEXT_PUBLIC_WHATSAPP_NUMBER: waNumber },
      }
    : {
        dir,
        vars: {
          GARAGE_ASK_URL: `${siteUrl.replace(/\/+$/, "")}/api/ask`,
          GARAGE_BOT_TOKEN: token,
          ...PUBLIC,
        },
      }

function vercel(args, stdin) {
  return new Promise((done) => {
    // shell: true נחוץ כדי להריץ npx בווינדוס, והוא מדפיס אזהרת deprecation.
    // כאן זה בטוח: כל הארגומנטים הם מחרוזות קבועות שאנחנו כותבים, ולא קלט
    // מהמשתמש. **הערך הסודי לא עובר כאן בכלל** — הוא נכנס דרך stdin למטה,
    // וזו בדיוק הסיבה: ארגומנטים נראים ברשימת התהליכים של המערכת.
    const p = spawn("npx", ["vercel", ...args], { cwd: plan.dir, shell: true, stdio: ["pipe", "pipe", "pipe"] })
    let err = ""
    p.stderr.on("data", (d) => (err += d))
    p.stdout.on("data", () => {})
    if (stdin !== undefined) {
      p.stdin.write(stdin)
      p.stdin.end()
    }
    p.on("close", (code) => done({ code, err }))
  })
}

console.log(`\nמגדיר ${Object.keys(plan.vars).length} משתנים ב-${target} (${plan.dir})\n`)

let failed = 0
for (const [name, value] of Object.entries(plan.vars)) {
  // מסירים קודם, כי vercel env add על שם קיים נכשל. כישלון כאן זה בסדר:
  // המשמעות היא שהמשתנה פשוט לא היה מוגדר.
  await vercel(["env", "rm", name, "production", "--yes"])
  const { code, err } = await vercel(["env", "add", name, "production"], value)
  if (code === 0) {
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.log(`  ✗ ${name} — ${err.split("\n").find((l) => l.includes("Error")) ?? `קוד ${code}`}`)
  }
}

console.log(
  failed === 0
    ? `\nהכול הוגדר. עכשיו צריך לפרוס מחדש כדי שהערכים ייכנסו לתוקף:\n  cd ${plan.dir} && npx vercel deploy --prod --yes\n`
    : `\n${failed} משתנים נכשלו. בדרך כלל זה אומר שהחיבור ל-Vercel פג: npx vercel login\n`,
)
process.exit(failed ? 1 : 0)
