import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { VoiceButton } from "@/components/staff/voice-button"

export const metadata: Metadata = { title: "הליפט שלי | מוסך לוי ובניו", robots: { index: false, follow: false } }

// דף המכונאי. מסך אחד, כפתור אחד, ואפס הקלדה: הוא רואה את הרכב שעל הליפט שלו,
// לוחץ ומדבר. הרכב נקבע לפי שיוך הליפט בטבלת הצוות, ולא לפי מה שנאמר בהקלטה.

export default async function LiftPage() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const { data: cards } = await supabase
    .from("job_cards")
    .select("id, plate, vehicle_make, vehicle_model, vehicle_year, engine_code, status, lift")
    .in("status", ["open", "in_progress", "waiting_approval"])
    .order("opened_at", { ascending: true })

  const mine = (cards ?? []).filter((c) => (staff.lift ? c.lift === staff.lift : true))

  return (
    <main className="staff-wrap lift-page">
      <header className="staff-top">
        <div>
          <Link className="staff-back" href="/staff">לוח היום</Link>
          <h1>{staff.lift ? `ליפט ${staff.lift}` : "הרכבים בעבודה"}</h1>
          <p>{staff.full_name}</p>
        </div>
      </header>

      {mine.length === 0 ? (
        <p className="staff-empty">
          {staff.lift
            ? `אין כרגע רכב על ליפט ${staff.lift}. כשפותחים כרטיס ומשייכים אותו לליפט הזה, הוא יופיע כאן.`
            : "אין כרגע רכבים בעבודה."}
        </p>
      ) : (
        <ul className="lift-list">
          {mine.map((c) => (
            <li key={c.id} className="lift-car">
              <div className="lift-car-head">
                <span className="plate-chip num" dir="ltr">{c.plate}</span>
                <div>
                  <b>
                    {[c.vehicle_make, c.vehicle_model].filter(Boolean).join(" ") || "רכב"}
                    {c.vehicle_year ? `, ${c.vehicle_year}` : ""}
                  </b>
                  {c.engine_code && <span className="staff-meta"> מנוע {c.engine_code}</span>}
                </div>
              </div>

              {c.status === "waiting_approval" ? (
                <p className="job-note">ממתינים לתשובת הלקוח על מה שכבר נשלח.</p>
              ) : null}

              <VoiceButton jobId={c.id} />

              <Link className="lift-link" href={`/staff/job/${c.id}`}>הכרטיס המלא</Link>
            </li>
          ))}
        </ul>
      )}

      <p className="lift-hint">
        מדברים כרגיל, בערבית או בעברית. אומרים מה נמצא, ואם יש מחיר, אומרים אותו.
        <b> לא שולחים ללקוח כלום</b>: דניאל רואה את הטיוטה ומחליט.
      </p>
    </main>
  )
}
