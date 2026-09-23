import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { hourInIsrael } from "@/lib/staff/format"
import { TopBar } from "@/components/staff/top-bar"

export const metadata: Metadata = { title: "מדדים | מוסך לוי ובניו", robots: { index: false, follow: false } }

// ששת המדדים שהלקוח עצמו קבע, ומה שהמערכת באמת יודעת לומר על כל אחד.
// שלושה מהם נמדדים כאן מנתוני אמת, ושלושה לא. במקום להמציא מספר, כתוב
// מה חסר כדי למדוד אותם. זה עדיף על דשבורד שנראה מלא ולא אומר כלום.

const shekel = (n: number) => `${Math.round(Number(n || 0)).toLocaleString("he-IL")} ש"ח`
const pct = (part: number, whole: number) => (whole === 0 ? null : Math.round((part / whole) * 100))

function minutesBetween(a: string, b: string) {
  return Math.max(0, (new Date(b).getTime() - new Date(a).getTime()) / 60000)
}


export default async function DashboardPage() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const since = new Date()
  since.setDate(since.getDate() - 30)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const [{ data: cards }, { data: approvals }, { data: findings }, { data: fleetTotals }] = await Promise.all([
    supabase.from("job_cards").select("id, status, opened_at, ready_at, delivered_at").gte("opened_at", since.toISOString()),
    supabase.from("approvals").select("id, sent_at, decided_at, decision, price_chosen").gte("sent_at", since.toISOString()),
    supabase.from("findings").select("id, status, sent_at").gte("created_at", since.toISOString()),
    supabase.from("fleet_vehicles").select("plate, fleets(name)").eq("active", true),
  ])

  // 1. רכבים שנמסרו עד 16:00
  const delivered = (cards ?? []).filter((c) => c.delivered_at)
  const onTime = delivered.filter((c) => hourInIsrael(c.delivered_at!) < 16)

  // 2. כמה זמן הליפט ממתין לתשובת הלקוח
  const decided = (approvals ?? []).filter((a) => a.decided_at)
  const waitMinutes = decided.map((a) => minutesBetween(a.sent_at, a.decided_at!))
  const avgWait = waitMinutes.length ? waitMinutes.reduce((s, m) => s + m, 0) / waitMinutes.length : null
  const stillWaiting = (approvals ?? []).filter((a) => !a.decided_at)

  // 5. אישורים בכתב
  const sent = (findings ?? []).filter((f) => f.sent_at)
  const inWriting = decided.length

  // 4. מה נצבר לציים החודש
  const fleetPlates = new Set((fleetTotals ?? []).map((f) => f.plate))
  const monthApproved = decided
    .filter((a) => a.decision === "approved" && new Date(a.decided_at!) >= monthStart)
    .reduce((s, a) => s + Number(a.price_chosen || 0), 0)

  const measured = [
    {
      title: "רכבים שנמסרו עד 16:00",
      target: "היעד: כל הרכבים",
      value: delivered.length === 0 ? "אין עדיין מסירות" : `${onTime.length} מתוך ${delivered.length}`,
      note: delivered.length === 0 ? "המדד יתחיל לרוץ ברגע שיימסר הרכב הראשון דרך המערכת." : `${pct(onTime.length, delivered.length)}% מהמסירות ב-30 הימים האחרונים.`,
    },
    {
      title: "המתנה לתשובת הלקוח",
      target: "היעד: פחות מ-30 דקות ליפט מת ביום",
      value: avgWait === null ? "אין עדיין נתונים" : avgWait < 1 ? "פחות מדקה בממוצע" : `${Math.round(avgWait)} דקות בממוצע`,
      note:
        stillWaiting.length > 0
          ? `${stillWaiting.length === 1 ? "רכב אחד ממתין" : `${stillWaiting.length} רכבים ממתינים`} לתשובה כרגע. כל עוד אין תשובה, הליפט תפוס.`
          : "אין כרגע רכב שממתין לתשובה.",
    },
    {
      title: "אישורים בכתב",
      target: "היעד: אפס ויכוחים בקופה",
      value: sent.length === 0 ? "אין עדיין שליחות" : `${inWriting} מתוך ${sent.length}`,
      note:
        sent.length === 0
          ? "כל הודעה שנשלחת ללקוח נשמרת עם הנוסח המדויק, מה שנבחר, וחותמת זמן."
          : `${pct(inWriting, sent.length)}% מההודעות שנשלחו כבר הוכרעו, והנוסח נשמר.`,
    },
  ]

  const notMeasured = [
    {
      title: "שיחות והודעות אחרי 17:00",
      target: "היעד: אפס",
      why: "השיחות מגיעות לטלפון האישי של אבי, והמערכת לא רואה אותן. נמדוד את זה כשבוט הוואטסאפ של המוסך יענה במקומו, כי אז נדע כמה פניות הוא סגר לבד.",
    },
    {
      title: "חוב פתוח של הציים",
      target: "היעד: ירידה של 50%, וגבייה תוך 30 עד 40 יום",
      why: `אנחנו יודעים מה אושר, לא מה חויב ומה שולם. החשבוניות יוצאות בתוכנה הישנה. מה שכן ידוע: ${shekel(monthApproved)} אושרו החודש, ו-${fleetPlates.size} רכבי צי רשומים אצלנו.`,
    },
    {
      title: "המוסך עובד בלי אבי",
      target: "היעד: פחות מ-3 שיחות אליו ביומיים",
      why: "המדד הזה נמדד בחיים ולא במסך: כמה פעמים מישהו התקשר לאבי. מה שהמערכת כן משנה הוא שדניאל יכול לשלוח מחיר בעצמו, ושההיסטוריה של הרכב פתוחה לכל מכונאי.",
    },
  ]

  return (
    <main className="staff-wrap">
      <TopBar staff={staff} current="dashboard" />

      <header className="board-head">
        <div>
          <h1>מדדים</h1>
          <p>ששת המדדים שאבי קבע, ומה שהמערכת יודעת לומר על כל אחד. 30 ימים אחרונים.</p>
        </div>
      </header>

      <section className="staff-section" aria-labelledby="measured-title">
        <h2 id="measured-title">נמדד מנתוני אמת</h2>
        <ul className="kpis">
          {measured.map((k) => (
            <li key={k.title} className="kpi">
              <span className="kpi-title">{k.title}</span>
              <b className="kpi-value">{k.value}</b>
              <span className="kpi-target">{k.target}</span>
              <p className="kpi-note">{k.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="staff-section" aria-labelledby="not-measured-title">
        <h2 id="not-measured-title">עדיין לא נמדד, וזו הסיבה</h2>
        <ul className="kpis honest">
          {notMeasured.map((k) => (
            <li key={k.title} className="kpi">
              <span className="kpi-title">{k.title}</span>
              <span className="kpi-target">{k.target}</span>
              <p className="kpi-note">{k.why}</p>
            </li>
          ))}
        </ul>
      </section>

      <p className="lift-hint">
        המספרים כאן מגיעים מהכרטיסים ומהאישורים במערכת, ולא מהערכה.
        כל עוד המוסך עובד גם בנייר, הם מתארים רק את מה שעבר דרך המערכת.
      </p>
    </main>
  )
}
