import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"
import { VoiceButton } from "@/components/staff/voice-button"
import { setMyLift, takeCar } from "../actions"

export const metadata: Metadata = { title: "הליפט שלי | מוסך לוי ובניו", robots: { index: false, follow: false } }

// דף המכונאי. מסך אחד, כפתור אחד, ואפס הקלדה: הוא רואה את הרכב שעל הליפט שלו,
// לוחץ ומדבר. הרכב נקבע לפי שיוך הליפט בטבלת הצוות, ולא לפי מה שנאמר בהקלטה.
//
// רכב שנפתח בלי ליפט מופיע כאן בנפרד. בלי זה הוא היה נעלם מכל המכונאים,
// ואף אחד לא היה יודע שהוא מחכה.

function Car({
  card,
  canTake,
}: {
  card: { id: number; plate: string; vehicle_make: string | null; vehicle_model: string | null; vehicle_year: number | null; engine_code: string | null; status: string }
  canTake?: boolean
}) {
  return (
    <li className="lift-car">
      <div className="lift-car-head">
        <span className="plate-chip num" dir="ltr">{card.plate}</span>
        <div>
          <b>
            {[card.vehicle_make, card.vehicle_model].filter(Boolean).join(" ") || "רכב"}
            {card.vehicle_year ? `, ${card.vehicle_year}` : ""}
          </b>
          {card.engine_code && <span className="staff-meta"> מנוע {card.engine_code}</span>}
        </div>
      </div>

      {card.status === "waiting_approval" && <p className="job-note">ממתינים לתשובת הלקוח על מה שכבר נשלח.</p>}

      {canTake ? (
        <form action={takeCar} className="lift-take">
          <input type="hidden" name="job_id" value={card.id} />
          <button className="btn" type="submit">קח לליפט שלי</button>
        </form>
      ) : (
        <VoiceButton jobId={card.id} />
      )}

      <Link className="lift-link" href={`/staff/job/${card.id}`}>הכרטיס המלא</Link>
    </li>
  )
}

export default async function LiftPage() {
  const staff = await requireStaff()
  const supabase = await createClient()

  const { data: cards } = await supabase
    .from("job_cards")
    .select("id, plate, vehicle_make, vehicle_model, vehicle_year, engine_code, status, lift")
    .in("status", ["open", "in_progress", "waiting_approval"])
    .order("opened_at", { ascending: true })

  const all = cards ?? []
  const mine = staff.lift ? all.filter((c) => c.lift === staff.lift) : all
  const unassigned = staff.lift ? all.filter((c) => c.lift === null) : []
  const elsewhere = staff.lift ? all.filter((c) => c.lift !== null && c.lift !== staff.lift).length : 0

  return (
    <main className="staff-wrap lift-page">
      <header className="staff-top">
        <div>
          <Link className="staff-back" href="/staff">לוח היום</Link>
          <h1>{staff.lift ? `ליפט ${staff.lift}` : "עמדת אבחון"}</h1>
          <p>{staff.full_name}</p>
        </div>

        {/* במוסך יש 4 ליפטים ויותר מכונאים מזה, והעמדה מתחלפת במהלך היום. */}
        <form action={setMyLift} className="lift-picker">
          <label htmlFor="my-lift">איפה אני עובד עכשיו</label>
          <select id="my-lift" name="lift" defaultValue={staff.lift ?? ""}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>ליפט {n}</option>
            ))}
            <option value="">עמדת אבחון</option>
          </select>
          <button className="btn quiet" type="submit">עדכון</button>
        </form>
      </header>

      {mine.length > 0 ? (
        <ul className="lift-list">
          {mine.map((c) => (
            <Car key={c.id} card={c} />
          ))}
        </ul>
      ) : (
        <p className="staff-empty">
          {staff.lift ? `אין כרגע רכב על ליפט ${staff.lift}.` : "לא בחרת ליפט, ולכן רואים כאן את כל הרכבים בעבודה."}
          {elsewhere > 0 && ` ${elsewhere === 1 ? "רכב אחד נמצא" : `${elsewhere} רכבים נמצאים`} על ליפטים אחרים.`}
          {unassigned.length === 0 && " כשדניאל פותח כרטיס ומשייך אותו לליפט הזה, הוא יופיע כאן."}
        </p>
      )}

      {unassigned.length > 0 && (
        <section className="staff-section" aria-labelledby="unassigned-title">
          <h2 id="unassigned-title">רכבים בלי ליפט</h2>
          <p className="staff-meta">נפתח להם כרטיס, אבל לא נבחר ליפט. מי שלוקח אותם, לוקח גם את הדיווח.</p>
          <ul className="lift-list">
            {unassigned.map((c) => (
              <Car key={c.id} card={c} canTake />
            ))}
          </ul>
        </section>
      )}

      <p className="lift-hint">
        מדברים כרגיל, בערבית או בעברית. אומרים מה נמצא, ואם יש מחיר, אומרים אותו.
        <b> לא שולחים ללקוח כלום</b>: דניאל רואה את הטיוטה ומחליט.
      </p>
    </main>
  )
}
