import type { Metadata } from "next"

import { createClient } from "@/lib/supabase/server"
import { AutoRefresh } from "@/components/staff/auto-refresh"

export const metadata: Metadata = { title: "הרכבים שלנו היום | מוסך לוי ובניו", robots: { index: false, follow: false } }

// המסך בחדר ההמתנה. הוא תלוי מול אנשים שאינם לקוחות שלנו גם כן: מי שמלווה,
// מי שנכנס לשאול משהו, ושליח שעובר. לכן כל מה שהוא מראה הוא שלוש ספרות
// אחרונות ודגם, ושום דבר מעבר לזה.
//
// מה במפורש לא כאן, וזה לא קיצור דרך אלא החלטה:
//   · שם, טלפון, מספר רישוי מלא.
//   · מחירים וממצאים.
//   · "ממתין לאישור הלקוח" — זה היה מכריז פומבית שאדם מסוים התבקש לשלם
//     ועוד לא אישר, מול חדר מלא אנשים.
//   · שעונים. העיכוב שלנו לא מוצג לאדם שנפגע ממנו, בלי הסבר ובלי מי שיענה.
//
// הסינון לא נעשה כאן אלא בפונקציה lobby_view במסד: הדף הזה לא מחובר, ולכן
// אסור לו לגעת בטבלאות בכלל. גם מי שיקרא את קוד הדף לא ימצא דרך לשדה אחר.

type Row = { plate_last3: string; vehicle: string | null; state: "working" | "ready" }

export default async function LobbyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const supabase = await createClient()
  const [{ data: name }, { data }] = await Promise.all([
    supabase.rpc("lobby_name", { p_token: token }),
    supabase.rpc("lobby_view", { p_token: token }),
  ])
  const rows = (data ?? []) as Row[]

  // מסך שלא מזוהה אומר את זה. אחרת טוקן שהוקלד לא נכון היה מציג "אין כרגע
  // רכבים במוסך", ומי שתלה אותו היה מאמין לו.
  if (!name) {
    return (
      <main className="lobby">
        <header className="lobby-head">
          <h1>מוסך לוי ובניו</h1>
          <p>הקישור של המסך הזה לא בתוקף. הצוות בדלפק יכול להנפיק קישור חדש.</p>
        </header>
      </main>
    )
  }

  const ready = rows.filter((r) => r.state === "ready")
  const working = rows.filter((r) => r.state === "working")

  return (
    <main className="lobby">
      <AutoRefresh seconds={30} />

      <header className="lobby-head">
        <h1>מוסך לוי ובניו</h1>
        <p>הרכבים שאצלנו עכשיו, לפי שלוש הספרות האחרונות של מספר הרישוי.</p>
      </header>

      {rows.length === 0 ? (
        <p className="lobby-empty">אין כרגע רכבים במוסך.</p>
      ) : (
        <div className="lobby-grid">
          <section aria-labelledby="l-ready">
            <h2 id="l-ready">מוכן לאיסוף</h2>
            {ready.length === 0 ? (
              <p className="lobby-empty">עוד אף רכב לא סיים.</p>
            ) : (
              <ul className="lobby-cars">
                {ready.map((r) => (
                  <li key={r.plate_last3 + r.vehicle} className="lobby-car ready">
                    <span className="num" dir="ltr">
                      ···{r.plate_last3}
                    </span>
                    <b>{r.vehicle || "רכב"}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="l-working">
            <h2 id="l-working">בעבודה</h2>
            {working.length === 0 ? (
              <p className="lobby-empty">אין כרגע רכב בעבודה.</p>
            ) : (
              <ul className="lobby-cars">
                {working.map((r) => (
                  <li key={r.plate_last3 + r.vehicle} className="lobby-car">
                    <span className="num" dir="ltr">
                      ···{r.plate_last3}
                    </span>
                    <b>{r.vehicle || "רכב"}</b>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}

      <footer className="lobby-foot">
        הרכב שלכם לא ברשימה, או שיש שאלה? הצוות בדלפק ישמח לעזור.
      </footer>
    </main>
  )
}
