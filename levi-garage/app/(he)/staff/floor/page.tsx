import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { elapsed, fmtMinutes, fmtTime, minutesSince } from "@/lib/staff/format"
import { TopBar } from "@/components/staff/top-bar"
import { Since } from "@/components/staff/since"

export const metadata: Metadata = { title: "מפת המוסך | מוסך לוי ובניו", robots: { index: false, follow: false } }

// התמונה שחסרה: לא רשימת משימות, אלא איפה כל רכב נמצא פיזית וכמה זמן הוא שם.
// לוח היום עונה על "מה לעשות עכשיו". המסך הזה עונה על "למה אין לי מקום",
// ועל השאלה שנשאלת בטלפון עשר פעמים ביום: איפה הרכב של כהן.
//
// אין כאן אף כפתור שמשנה משהו. זה מסך שמסתכלים בו, ולכן אפשר להשאיר אותו
// פתוח על הדלפק בלי לחשוש שמישהו ילחץ על משהו בטעות.

const LIFTS = [1, 2, 3, 4] as const

// מתי זמן הופך ל"יותר מדי". המספרים האלה הם החלטה ולא מדידה, ולכן הם כאן
// במקום אחד: אחרי שבוע עבודה אמיתי משנים אותם בשורה אחת.
const TOO_LONG = { lift: 240, noLift: 30, customer: 120, ready: 120 }

const statusLabel: Record<string, string> = {
  open: "נפתח כרטיס",
  in_progress: "בעבודה",
  waiting_approval: "מחכה לתשובת הלקוח",
  ready: "מוכן למסירה",
}

type Card = {
  id: number
  plate: string
  vehicle_make: string | null
  vehicle_model: string | null
  vehicle_year: number | null
  status: string
  lift: number | null
  opened_at: string
  lift_since: string | null
  status_since: string
  customer_name: string | null
}

function carName(c: Card) {
  const name = [c.vehicle_make, c.vehicle_model].filter(Boolean).join(" ")
  return (name || "רכב") + (c.vehicle_year ? `, ${c.vehicle_year}` : "")
}

export default async function FloorPage() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const [{ data: cards }, { data: crew }, { data: booked }] = await Promise.all([
    supabase
      .from("job_cards")
      .select(
        "id, plate, vehicle_make, vehicle_model, vehicle_year, status, lift, opened_at, lift_since, status_since, customer_name",
      )
      .not("status", "in", "(delivered,cancelled)")
      .order("opened_at", { ascending: true }),
    // מכונאי רואה רק את עצמו בטבלת הצוות, ולכן השמות מופיעים לדניאל ולא לו.
    // זה בכוונה: מי עובד איפה זה מידע של ניהול.
    supabase.from("staff").select("id, full_name, lift").eq("active", true),
    supabase
      .from("bookings")
      .select("id, plate, customer_name, service, drop_off_at")
      .gte("drop_off_at", today.toISOString())
      .lt("drop_off_at", tomorrow.toISOString())
      .in("status", ["booked", "rescheduled"])
      .order("drop_off_at", { ascending: true }),
  ])

  const all = (cards ?? []) as Card[]
  const onLifts = all.filter((c) => c.lift !== null).length
  // תאים ולא רכבים: שני רכבים שמשויכים בטעות לאותו ליפט לא מפנים תא שלישי.
  const freeLifts = LIFTS.length - new Set(all.filter((c) => c.lift !== null).map((c) => c.lift)).size
  const waitingForLift = all.filter((c) => c.lift === null && c.status !== "ready")
  const ready = all.filter((c) => c.status === "ready")
  const arriving = booked ?? []

  const mechanicsAt = (lift: number) => (crew ?? []).filter((s) => s.lift === lift).map((s) => s.full_name)

  return (
    <main className="staff-wrap">
      <TopBar staff={staff} current="floor" />

      <header className="board-head">
        <h1>מפת המוסך</h1>
        <p>איפה כל רכב נמצא עכשיו, וכמה זמן הוא שם. השעונים מתקדמים לבד.</p>
      </header>

      <div className="board-counts" aria-label="סיכום">
        <span>
          <b className="num">{all.length}</b> {all.length === 1 ? "רכב אצלנו" : "רכבים אצלנו"}
        </span>
        <span>
          <b className="num">{onLifts}</b> על ליפט
        </span>
        <span className={waitingForLift.length ? "hot" : ""}>
          <b className="num">{waitingForLift.length}</b> {waitingForLift.length === 1 ? "ממתין לליפט" : "ממתינים לליפט"}
        </span>
        <span>
          <b className="num">{freeLifts}</b> {freeLifts === 1 ? "ליפט פנוי" : "ליפטים פנויים"}
        </span>
      </div>

      <section className="staff-section" aria-labelledby="bays-title">
        <h2 id="bays-title">ארבעת הליפטים</h2>
        <p className="board-why">מה שמסומן בכתום עומד יותר מדי זמן, ולכן שווה לבדוק אותו לפני השאר.</p>

        <ul className="floor-grid">
          {LIFTS.map((n) => {
            const here = all.filter((c) => c.lift === n)
            const crewHere = mechanicsAt(n)
            // לכל מצב יש שעון אחר שמעניין. רכב שמחכה ללקוח נמדד מרגע השליחה,
            // רכב גמור מרגע שסומן כמוכן, ורכב בעבודה לפי הזמן על הליפט עצמו.
            // בלי ההפרדה הזאת כמעט כל תא היה נצבע בכתום, וכתום שתמיד דולק
            // הוא כתום שאף אחד לא מסתכל עליו.
            const stuck = here.some((c) =>
              c.status === "waiting_approval"
                ? minutesSince(c.status_since) > TOO_LONG.customer
                : c.status === "ready"
                  ? minutesSince(c.status_since) > TOO_LONG.ready
                  : c.lift_since
                    ? minutesSince(c.lift_since) > TOO_LONG.lift
                    : false,
            )

            return (
              <li key={n} className={`floor-bay${here.length ? " busy" : ""}${stuck ? " hot" : ""}`}>
                <h3>
                  <span>ליפט {n}</span>
                  {/* מכונאי לא רואה את שורות הצוות של האחרים, ולכן עבורו הרשימה
                      תמיד תיראה ריקה. עדיף לא לכתוב שורה מאשר לכתוב "בלי מכונאי"
                      על ליפט שיש עליו מישהו. */}
                  {staff.role !== "mechanic" ? (
                    <small>{crewHere.length ? crewHere.join(", ") : "בלי מכונאי קבוע"}</small>
                  ) : staff.lift === n ? (
                    <small>אני כאן</small>
                  ) : null}
                </h3>

                {here.length === 0 ? (
                  <p className="floor-free">פנוי</p>
                ) : (
                  here.map((c) => (
                    <div key={c.id} className="floor-car">
                      <Link href={`/staff/job/${c.id}`}>
                        <span className="plate-chip num" dir="ltr">{c.plate}</span>
                        <b>{carName(c)}</b>
                      </Link>
                      <span className="staff-meta">{statusLabel[c.status] ?? c.status}</span>
                      <p className="floor-clocks">
                        <span>
                          על הליפט{" "}
                          <Since iso={c.lift_since ?? c.opened_at} initial={elapsed(c.lift_since ?? c.opened_at)} />
                        </span>
                        <span>
                          אצלנו <Since iso={c.opened_at} initial={elapsed(c.opened_at)} />
                        </span>
                      </p>
                    </div>
                  ))
                )}

                {here.length > 1 && (
                  <p className="floor-warn">שני רכבים משויכים לאותו ליפט. אחד מהם כנראה כבר לא שם.</p>
                )}
              </li>
            )
          })}
        </ul>
      </section>

      <section className="staff-section" aria-labelledby="waiting-title">
        <h2 id="waiting-title">ממתינים לליפט</h2>
        {waitingForLift.length === 0 ? (
          <p className="staff-empty">אין רכב שמחכה בחוץ. לכל מי שנפתח לו כרטיס יש ליפט.</p>
        ) : (
          <ul className="board-rows">
            {waitingForLift.map((c) => (
              <li key={c.id}>
                <span className="plate-chip num" dir="ltr">{c.plate}</span>
                <div>
                  <b>{carName(c)}</b>
                  <span className="staff-meta">
                    {c.customer_name || "ללא שם"} · נכנס ב-{fmtTime(c.opened_at)}
                  </span>
                </div>
                <span className="floor-wait">
                  מחכה{" "}
                  <Since
                    iso={c.opened_at}
                    initial={elapsed(c.opened_at)}
                    className={minutesSince(c.opened_at) > TOO_LONG.noLift ? "hot" : ""}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="staff-section" aria-labelledby="ready-title">
        <h2 id="ready-title">גמורים, ועדיין אצלנו</h2>
        {ready.length === 0 ? (
          <p className="staff-empty">אין רכב שסיים וממתין ללקוח.</p>
        ) : (
          <>
            <p className="board-why">רכב גמור שנשאר במוסך תופס מקום. הזמן כאן נספר מהרגע שסומן כמוכן.</p>
            <ul className="board-rows">
              {ready.map((c) => (
                <li key={c.id}>
                  <span className="plate-chip num" dir="ltr">{c.plate}</span>
                  <div>
                    <b>{carName(c)}</b>
                    <span className="staff-meta">
                      {c.customer_name || "ללא שם"}
                      {c.lift ? ` · עדיין על ליפט ${c.lift}` : " · לא על ליפט"}
                    </span>
                  </div>
                  <span className="floor-wait">
                    מוכן כבר{" "}
                    <Since
                      iso={c.status_since}
                      initial={elapsed(c.status_since)}
                      className={minutesSince(c.status_since) > TOO_LONG.ready ? "hot" : ""}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className="staff-section" aria-labelledby="soon-title">
        <h2 id="soon-title">אמורים להגיע היום</h2>
        {arriving.length === 0 ? (
          <p className="staff-empty">אין עוד תורים להיום.</p>
        ) : (
          <ul className="board-rows">
            {arriving.map((b) => {
              const diff = minutesSince(b.drop_off_at)
              return (
                <li key={b.id}>
                  <span className="plate-chip num" dir="ltr">{b.plate}</span>
                  <div>
                    <b>{b.customer_name || "ללא שם"}</b>
                    <span className="staff-meta">
                      {fmtTime(b.drop_off_at)} · {b.service || "ללא שירות"}
                    </span>
                  </div>
                  <span className={diff > 10 ? "floor-wait hot" : "floor-wait"}>
                    {diff > 0 ? `מאחר ב-${fmtMinutes(diff)}` : `בעוד ${fmtMinutes(-diff)}`}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </main>
  )
}
