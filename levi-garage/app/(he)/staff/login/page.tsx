import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { getStaff } from "@/lib/staff/session"
import { signIn } from "../actions"

export const metadata: Metadata = { title: "כניסת צוות | מוסך לוי ובניו", robots: { index: false, follow: false } }

// טופס שרת רגיל, בלי מצב בצד הלקוח. הוא עובד גם לפני שה-JavaScript נטען,
// וזה בדיוק המצב במוסך: טלפון בכיס, רשת חלשה, ואצבע אחת פנויה.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ e?: string }> }) {
  if (await getStaff()) redirect("/staff")
  const { e } = await searchParams

  return (
    <main className="staff-login">
      <div className="staff-login-box">
        <h1>כניסת צוות</h1>
        <p>אזור העבודה של המוסך. לקוחות לא צריכים להיכנס לכאן.</p>

        <form action={signIn} className="staff-form">
          <label htmlFor="email">אימייל</label>
          <input id="email" name="email" type="email" autoComplete="username" dir="ltr" required />

          <label htmlFor="password">סיסמה</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />

          {e && (
            <p className="staff-error" role="alert">
              האימייל או הסיסמה לא נכונים.
            </p>
          )}

          <button className="btn" type="submit">כניסה</button>
        </form>
      </div>
    </main>
  )
}
