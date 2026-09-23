import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff, roleLabel } from "@/lib/staff/session"
import { openJobCard, signOut } from "./actions"

export const metadata: Metadata = { title: "לוח היום | מוסך לוי ובניו", robots: { index: false, follow: false } }

const statusLabel: Record<string, string> = {
  open: "נפתח",
  in_progress: "בעבודה",
  waiting_approval: "ממתין לאישור הלקוח",
  ready: "מוכן",
  delivered: "נמסר",
  cancelled: "בוטל",
}

function time(iso: string | null) {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })
}

export default async function StaffBoard() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000)

  const [{ data: cards }, { data: booked }] = await Promise.all([
    supabase
      .from("job_cards")
      .select("id, plate, vehicle_make, vehicle_model, vehicle_year, status, lift, opened_at, customer_name")
      .not("status", "in", "(delivered,cancelled)")
      .order("opened_at", { ascending: true }),
    supabase
      .from("bookings")
      .select("id, plate, customer_name, service, drop_off_at, status, vehicle_make, vehicle_model")
      .gte("drop_off_at", today.toISOString())
      .lt("drop_off_at", tomorrow.toISOString())
      .in("status", ["booked", "rescheduled"])
      .order("drop_off_at", { ascending: true }),
  ])

  const waiting = (cards ?? []).filter((c) => c.status === "waiting_approval")

  return (
    <main className="staff-wrap">
      <header className="staff-top">
        <div>
          <h1>לוח היום</h1>
          <p>
            {staff.full_name} · {roleLabel[staff.role]}
            {staff.lift ? ` · ליפט ${staff.lift}` : ""}
          </p>
        </div>
        <form action={signOut}>
          <button className="btn quiet" type="submit">יציאה</button>
        </form>
      </header>

      {waiting.length > 0 && (
        <section className="staff-alert" aria-label="ממתינים לאישור">
          <b>{waiting.length} רכבים ממתינים לתשובת הלקוח.</b>
          <span>כל עוד אין תשובה, הליפט תפוס.</span>
        </section>
      )}

      <section className="staff-section" aria-labelledby="open-cards">
        <h2 id="open-cards">על הליפטים עכשיו</h2>
        {(cards ?? []).length === 0 ? (
          <p className="staff-empty">אין כרטיסים פתוחים. כשרכב מגיע, פותחים לו כרטיס מהרשימה למטה.</p>
        ) : (
          <ul className="staff-cards">
            {(cards ?? []).map((c) => (
              <li key={c.id} className={`staff-card status-${c.status}`}>
                <Link href={`/staff/job/${c.id}`}>
                  <span className="plate-chip num" dir="ltr">{c.plate}</span>
                  <b>{[c.vehicle_make, c.vehicle_model].filter(Boolean).join(" ") || "רכב"}{c.vehicle_year ? `, ${c.vehicle_year}` : ""}</b>
                  <span className="staff-meta">
                    {c.lift ? `ליפט ${c.lift} · ` : ""}נפתח ב-{time(c.opened_at)}
                  </span>
                  <span className={`staff-status status-${c.status}`}>{statusLabel[c.status] ?? c.status}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="staff-section" aria-labelledby="today-bookings">
        <h2 id="today-bookings">תורים להיום</h2>
        {(booked ?? []).length === 0 ? (
          <p className="staff-empty">אין תורים להיום שעדיין לא נפתח להם כרטיס.</p>
        ) : (
          <ul className="staff-bookings">
            {(booked ?? []).map((b) => (
              <li key={b.id}>
                <div>
                  <span className="plate-chip num" dir="ltr">{b.plate}</span>
                  <b>{b.customer_name || "ללא שם"}</b>
                  <span className="staff-meta">
                    {time(b.drop_off_at)} · {b.service || "ללא שירות"}
                    {b.vehicle_make ? ` · ${b.vehicle_make} ${b.vehicle_model ?? ""}` : ""}
                  </span>
                </div>
                <form action={openJobCard}>
                  <input type="hidden" name="booking_id" value={b.id} />
                  <label className="sr-only" htmlFor={`lift-${b.id}`}>ליפט</label>
                  <select id={`lift-${b.id}`} name="lift" defaultValue={staff.lift ?? ""}>
                    <option value="">בלי ליפט</option>
                    {[1, 2, 3, 4].map((n) => (
                      <option key={n} value={n}>ליפט {n}</option>
                    ))}
                  </select>
                  <button className="btn" type="submit">הרכב הגיע</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
