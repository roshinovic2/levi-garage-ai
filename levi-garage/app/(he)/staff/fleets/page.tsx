import type { Metadata } from "next"
import Link from "next/link"

import { createClient } from "@/lib/supabase/server"
import { requireStaff } from "@/lib/staff/session"

export const metadata: Metadata = { title: "ציים | מוסך לוי ובניו", robots: { index: false, follow: false } }

// החלפת האקסל של רונית: מי הרכבים של כל חברה, וכמה נצבר החודש.
// זה לא מוציא חשבונית, אבל זה מה שהיא צריכה כדי להוציא אותה בלי לרדוף אחרי מספרים.

const shekel = (n: number) => `${Number(n || 0).toLocaleString("he-IL")} ש"ח`

export default async function FleetsPage() {
  await requireStaff()
  const supabase = await createClient()

  const { data: fleets } = await supabase
    .from("fleets")
    .select("id, name, contact_name, token, active, fleet_vehicles(plate, nickname, active)")
    .eq("active", true)
    .order("name")

  const plates = (fleets ?? []).flatMap((f) =>
    (f.fleet_vehicles as { plate: string; active: boolean }[]).filter((v) => v.active).map((v) => v.plate),
  )

  // כמה אושר החודש, לכל רכב של כל צי
  const { data: history } = plates.length
    ? await supabase.from("vehicle_history").select("plate, approved_total, opened_at, status").in("plate", plates)
    : { data: [] }

  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const byPlate = new Map<string, { total: number; visits: number; open: boolean }>()
  for (const row of history ?? []) {
    const cur = byPlate.get(row.plate) ?? { total: 0, visits: 0, open: false }
    cur.visits += 1
    if (new Date(row.opened_at) >= monthStart) cur.total += Number(row.approved_total || 0)
    if (!["delivered", "cancelled"].includes(row.status)) cur.open = true
    byPlate.set(row.plate, cur)
  }

  return (
    <main className="staff-wrap">
      <header className="staff-top">
        <div>
          <Link className="staff-back" href="/staff">לוח היום</Link>
          <h1>ציים</h1>
          <p>החברות שעובדות איתנו בחשבון חודשי</p>
        </div>
      </header>

      {(fleets ?? []).length === 0 ? (
        <p className="staff-empty">עוד לא הוגדרו ציים.</p>
      ) : (
        <ul className="fleet-list">
          {(fleets ?? []).map((f) => {
            const cars = (f.fleet_vehicles as { plate: string; nickname: string | null; active: boolean }[]).filter((v) => v.active)
            const month = cars.reduce((sum, c) => sum + (byPlate.get(c.plate)?.total ?? 0), 0)
            const inGarage = cars.filter((c) => byPlate.get(c.plate)?.open).length

            return (
              <li key={f.id} className="fleet-card">
                <div className="fleet-head">
                  <h2>{f.name}</h2>
                  <span className="staff-meta">
                    {cars.length} רכבים
                    {f.contact_name ? ` · ${f.contact_name}` : ""}
                    {inGarage ? ` · ${inGarage} אצלנו עכשיו` : ""}
                  </span>
                </div>

                <div className="fleet-month">
                  <span>אושר החודש</span>
                  <b className="num">{shekel(month)}</b>
                </div>

                <ul className="fleet-cars">
                  {cars.map((c) => (
                    <li key={c.plate}>
                      <Link href={`/staff/vehicle/${c.plate}`}>
                        <span className="plate-chip num" dir="ltr">{c.plate}</span>
                        <span>{c.nickname || "רכב"}</span>
                        <span className="staff-meta">
                          {byPlate.get(c.plate)?.visits ?? 0} ביקורים
                          {byPlate.get(c.plate)?.open ? " · אצלנו עכשיו" : ""}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="fleet-link">
                  הקישור של מנהל הצי:{" "}
                  <a href={`/fleet/${f.token}`} target="_blank" rel="noreferrer">
                    /fleet/{f.token.slice(0, 8)}…
                  </a>
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
