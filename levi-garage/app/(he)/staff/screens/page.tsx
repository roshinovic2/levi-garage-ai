import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"

import { createClient } from "@/lib/supabase/server"
import { requireManager } from "@/lib/staff/session"
import { fmtDate } from "@/lib/staff/format"
import { TopBar } from "@/components/staff/top-bar"
import { CopyLink } from "@/components/staff/copy-link"
import { addDisplay, rotateDisplayToken, setDisplayActive } from "../actions"

export const metadata: Metadata = { title: "המסכים התלויים | מוסך לוי ובניו", robots: { index: false, follow: false } }

// המסכים שתלויים על הקיר, וניהול הקישורים שלהם.
//
// הדף הזה קיים בגלל שאלה אחת: "זה משהו שמוסכניק אמור לעשות?". הטוקן הוא כל
// ההגנה של מסך חדר ההמתנה, וכל עוד הדרך היחידה לבטל אותו הייתה פקודת SQL,
// בפועל אף אחד לא היה מבטל אותו לעולם.
//
// רק מנהל עבודה ובעלים נכנסים לכאן, וזה נאכף גם במסד במדיניות על displays.

export default async function ScreensPage() {
  const staff = await requireManager()
  const supabase = await createClient()

  const { data: displays } = await supabase
    .from("displays")
    .select("id, name, token, active, created_at")
    .order("created_at")

  // את הכתובת המלאה בונים מהבקשה עצמה, כדי שהיא תהיה נכונה גם מקומית וגם בייצור.
  const h = await headers()
  const origin = `https://${h.get("x-forwarded-host") ?? h.get("host")}`.replace("https://localhost", "http://localhost")

  return (
    <main className="staff-wrap">
      <TopBar staff={staff} current="other" />

      <header className="board-head">
        <h1>המסכים התלויים</h1>
        <p>פותחים את הכתובת פעם אחת על המסך עצמו ומשאירים. הוא מתרענן לבד.</p>
      </header>

      <section className="staff-section" aria-labelledby="wall-title">
        <h2 id="wall-title">לוח הסדנה</h2>
        <p className="staff-meta">
          הטלוויזיה בסדנה. היא מאחורי ההתחברות של הצוות, ולכן אין לה קישור נפרד: נכנסים פעם אחת עם משתמש של
          המוסך ונשארים מחוברים.
        </p>
        <p className="fleet-link">
          <Link href="/staff/wall" target="_blank" rel="noreferrer">
            פתיחת לוח הסדנה
          </Link>
        </p>
      </section>

      <section className="staff-section" aria-labelledby="lobby-title">
        <h2 id="lobby-title">חדר ההמתנה</h2>
        <p className="staff-meta">
          המסך הזה פתוח בלי התחברות, ולכן <b>הכתובת עצמה היא המפתח</b>. הוא מראה שלוש ספרות אחרונות ודגם בלבד,
          ושני מצבים: בעבודה, או מוכן לאיסוף. אם מישהו צילם את הכתובת או שהמסך הוחלף, מנפיקים קישור חדש
          והישן מפסיק לעבוד מיד.
        </p>

        {(displays ?? []).length === 0 ? (
          <p className="staff-empty">אין עדיין מסך מוגדר.</p>
        ) : (
          <ul className="screens">
            {(displays ?? []).map((d) => (
              <li key={d.id} className={d.active ? "screen-card" : "screen-card off"}>
                <div className="screen-head">
                  <b>{d.name}</b>
                  <span className="staff-meta">
                    {d.active ? "פעיל" : "כבוי"} · נוצר ב-{fmtDate(d.created_at)}
                  </span>
                </div>

                {d.active ? (
                  <CopyLink url={`${origin}/lobby/${d.token}`} />
                ) : (
                  <p className="staff-meta">מסך כבוי מציג "הקישור לא בתוקף", גם למי שיש לו את הכתובת הישנה.</p>
                )}

                <div className="screen-actions">
                  <form action={rotateDisplayToken}>
                    <input type="hidden" name="display_id" value={d.id} />
                    <button className="btn quiet" type="submit">
                      הנפקת קישור חדש
                    </button>
                  </form>
                  <form action={setDisplayActive}>
                    <input type="hidden" name="display_id" value={d.id} />
                    <input type="hidden" name="active" value={d.active ? "0" : "1"} />
                    <button className="btn quiet" type="submit">
                      {d.active ? "כיבוי המסך" : "הדלקת המסך"}
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form action={addDisplay} className="screen-add">
          <label htmlFor="new-screen">הוספת מסך נוסף</label>
          <div>
            <input id="new-screen" name="name" placeholder="למשל: הדלפק הקדמי" maxLength={40} required />
            <button className="btn" type="submit">
              הוספה
            </button>
          </div>
        </form>
      </section>
    </main>
  )
}
